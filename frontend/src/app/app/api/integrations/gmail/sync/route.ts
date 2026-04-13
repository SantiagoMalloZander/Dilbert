/**
 * POST /app/api/integrations/gmail/sync
 *
 * Fetches emails sent/received since last_sync_at and runs the AI agent pipeline
 * on each email that belongs to a known contact.
 *
 * Deduplication: activities store a `<!-- gmail:{id} -->` marker in description.
 * Returns { imported, skipped, errors }.
 */
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { refreshGmailToken, fetchParsedEmails } from "@/lib/gmail";
import { runAgent } from "@/lib/agent/orchestrator";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  // ?force=true bypasses dedup — useful when activities failed to write on a previous run
  const force = new URL(request.url).searchParams.get("force") === "true";

  const userId = session.user.id;
  const companyId = session.user.companyId;
  const supabase = createAdminSupabaseClient();

  // Load stored credentials
  const { data: credRow } = await supabase
    .from("channel_credentials")
    .select("credentials, last_sync_at")
    .eq("user_id", userId)
    .eq("channel", "gmail")
    .maybeSingle();

  if (!credRow?.credentials) {
    return NextResponse.json({ error: "Gmail no conectado." }, { status: 400 });
  }

  const creds = credRow.credentials as Record<string, string>;
  const accessToken = await refreshGmailToken(creds.refreshToken);
  if (!accessToken) {
    return NextResponse.json({ error: "No se pudo renovar el token de Gmail." }, { status: 401 });
  }

  const vendorEmail = creds.gmailEmail ?? "";
  // force=true uses a 14-day window to catch previously-missed emails
  const lastSync = force
    ? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    : credRow.last_sync_at
      ? new Date(credRow.last_sync_at)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const afterDate = `${lastSync.getFullYear()}/${String(lastSync.getMonth() + 1).padStart(2, "0")}/${String(lastSync.getDate()).padStart(2, "0")}`;

  const [sentEmails, receivedEmails] = await Promise.all([
    fetchParsedEmails(accessToken, vendorEmail, `from:${vendorEmail} after:${afterDate}`, 25),
    fetchParsedEmails(accessToken, vendorEmail, `-from:${vendorEmail} after:${afterDate} -in:trash -in:draft`, 25),
  ]);

  const all = [...sentEmails, ...receivedEmails];
  const unique = [...new Map(all.map((e) => [e.id, e])).values()];

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const email of unique) {
    try {
      const marker = `<!-- gmail:${email.id} -->`;

      // Dedup: check if we already processed this email (skip in force mode)
      if (!force) {
        const { data: existing } = await supabase
          .from("activities")
          .select("id")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .like("description", `%${marker}%`)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }
      }

      // Find the external party's email
      const externalEmail = email.direction === "sent"
        ? email.toEmails[0]
        : email.fromEmail;

      if (!externalEmail || externalEmail === vendorEmail) {
        skipped++;
        continue;
      }

      // Only process emails where we can identify the contact (existing or AI-resolvable)
      // Use the email body as raw text for the agent, with the dedup marker embedded
      // Marker goes FIRST so it's always within the 600-char CRM snippet (dedup)
      const rawText = [
        marker,
        `Asunto: ${email.subject}`,
        `De: ${email.from}`,
        `Para: ${email.to}`,
        email.snippet,
      ].filter(Boolean).join("\n\n");

      const result = await runAgent({
        companyId,
        userId,
        source: "gmail",
        rawText,
        channelIdentifier: externalEmail.toLowerCase(),
        senderName: email.direction === "received" ? email.from.split("<")[0].trim() : undefined,
        occurredAt: email.date.toISOString(),
      });

      if (result.status === "ok" || result.status === "new_contact") {
        imported++;
        console.log(`[gmail/sync] email:${email.id} → ${result.status} contact:${result.contactId}`);
      } else {
        console.log(`[gmail/sync] email:${email.id} skipped → status:${result.status} summary:${result.summary}`);
        skipped++;
      }
    } catch (err) {
      console.error(`[gmail/sync] error processing email ${email.id}:`, err);
      errors++;
    }
  }

  // Update last_sync_at
  await supabase
    .from("channel_credentials")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("channel", "gmail");

  return NextResponse.json({ ok: true, imported, skipped, errors });
}
