/**
 * POST /app/api/integrations/gmail/sync[?force=true]
 *
 * FAST — no AI here. Fetches emails from Gmail API and drops them into
 * gmail_queue. Returns immediately with how many were queued.
 *
 * The AI runs separately in /app/api/integrations/gmail/process (one
 * email at a time, called in a loop from the browser).
 *
 * ?force=true  → last 14 days, re-queues even if already in activities
 * (normal)     → since last_sync_at, skips already-imported emails
 */
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { refreshGmailToken, fetchParsedEmails } from "@/lib/gmail";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const force = new URL(request.url).searchParams.get("force") === "true";
  const userId = session.user.id;
  const companyId = session.user.companyId;
  const supabase = createAdminSupabaseClient();

  // ── Load credentials ──────────────────────────────────────────────────────
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

  const lastSync = force
    ? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    : credRow.last_sync_at
      ? new Date(credRow.last_sync_at)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const afterDate = `${lastSync.getFullYear()}/${String(lastSync.getMonth() + 1).padStart(2, "0")}/${String(lastSync.getDate()).padStart(2, "0")}`;

  // ── Fetch emails (no AI, just Gmail API calls — fast) ─────────────────────
  const MAX_PER_QUERY = 10;
  const [sentEmails, receivedEmails] = await Promise.all([
    fetchParsedEmails(accessToken, vendorEmail, `from:${vendorEmail} after:${afterDate}`, MAX_PER_QUERY),
    fetchParsedEmails(accessToken, vendorEmail, `-from:${vendorEmail} after:${afterDate} -in:trash -in:draft`, MAX_PER_QUERY),
  ]);

  const unique = [...new Map(
    [...sentEmails, ...receivedEmails].map((e) => [e.id, e])
  ).values()];

  let queued = 0;
  let skipped = 0;

  for (const email of unique) {
    const externalEmail = email.direction === "sent"
      ? email.toEmails[0]
      : email.fromEmail;

    if (!externalEmail || externalEmail === vendorEmail) {
      skipped++;
      continue;
    }

    // On normal sync, skip emails already in activities (already processed)
    if (!force) {
      const marker = `<!-- gmail:${email.id} -->`;
      const { data: existing } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .like("description", `%${marker}%`)
        .maybeSingle();
      if (existing) { skipped++; continue; }
    }

    const marker = `<!-- gmail:${email.id} -->`;
    const rawText = [
      marker,
      `Asunto: ${email.subject}`,
      `De: ${email.from}`,
      `Para: ${email.to}`,
      email.snippet,
    ].filter(Boolean).join("\n\n");

    const senderName = email.direction === "received"
      ? email.from.split("<")[0].trim() || undefined
      : undefined;

    // Upsert into queue — unique index on (user_id, email_id) prevents duplicates
    const { error } = await supabase
      .from("gmail_queue")
      .upsert({
        company_id: companyId,
        user_id: userId,
        email_id: email.id,
        raw_text: rawText,
        external_email: externalEmail.toLowerCase(),
        sender_name: senderName ?? null,
        occurred_at: email.date.toISOString(),
        direction: email.direction,
      }, { onConflict: "user_id,email_id", ignoreDuplicates: true });

    if (!error) queued++;
    else console.error("[gmail/sync] queue insert error", error.message);
  }

  // Update last_sync_at on normal syncs
  if (!force) {
    await supabase
      .from("channel_credentials")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("channel", "gmail");
  }

  return NextResponse.json({ ok: true, queued, skipped, total_found: unique.length });
}
