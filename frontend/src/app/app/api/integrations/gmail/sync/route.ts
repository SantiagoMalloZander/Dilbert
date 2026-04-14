/**
 * POST /app/api/integrations/gmail/sync[?force=true]
 *
 * FAST — no AI. Paginates through ALL Gmail messages since last_sync_at
 * (or last 14 days if force=true) and queues them in gmail_queue.
 *
 * Each queued row stores the pre-built rawText so the /process endpoint
 * can run AI immediately without fetching from Gmail again.
 *
 * Returns { queued, skipped, total_found, has_more }
 * has_more=true means there are still messages in Gmail not yet fetched
 * (hit the 8s time budget) — call sync again to continue.
 */
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { refreshGmailToken, listAllGmailMessageIds, getGmailMessage } from "@/lib/gmail";

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

  const lastSyncRaw = force
    ? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    : credRow.last_sync_at
      ? new Date(credRow.last_sync_at)
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Gmail's after: filter is exclusive (after: means strictly after that date),
  // so subtract 1 day to avoid missing emails that arrived on the same day as last_sync_at.
  // Dedup via unique index on (user_id, email_id) prevents any actual duplicates.
  const lastSync = new Date(lastSyncRaw.getTime() - 24 * 60 * 60 * 1000);

  const after = `${lastSync.getFullYear()}/${String(lastSync.getMonth() + 1).padStart(2, "0")}/${String(lastSync.getDate()).padStart(2, "0")}`;

  // ── Get ALL message IDs (paginated, fast — one list call per 100 IDs) ─────
  const [sentIds, receivedIds] = await Promise.all([
    listAllGmailMessageIds(accessToken, `from:${vendorEmail} after:${after}`, 500),
    listAllGmailMessageIds(accessToken, `-from:${vendorEmail} after:${after} -in:trash -in:draft`, 500),
  ]);

  const allIds = [...new Map([...sentIds, ...receivedIds].map((m) => [m.id, m])).values()];

  // ── Dedup: skip IDs already in activities or already queued ───────────────
  // We only do this for already-imported (activities) — gmail_queue has a
  // unique index on (user_id, email_id) that handles queue dedup via upsert.
  let alreadyImportedIds = new Set<string>();
  if (!force) {
    // Batch check existing activities (look for the gmail marker pattern)
    const { data: existingActivities } = await supabase
      .from("activities")
      .select("description")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .not("description", "is", null)
      .like("description", "%<!-- gmail:%");

    alreadyImportedIds = new Set(
      (existingActivities ?? [])
        .map((a) => {
          const match = (a.description ?? "").match(/<!-- gmail:([^>]+) -->/);
          return match?.[1] ?? null;
        })
        .filter(Boolean) as string[]
    );
  }

  const toFetch = allIds.filter((m) => !alreadyImportedIds.has(m.id));
  const total_found = toFetch.length;

  // ── Fetch full message content in parallel batches of 10 ─────────────────
  // Budget: 8s. Each batch of 10 takes ~300ms → ~25 batches → ~250 emails.
  // If we exceed budget we stop and set has_more=true.
  const BATCH_SIZE = 10;
  const deadline = Date.now() + 7_500;
  let queued = 0;
  let skipped = 0;
  let has_more = false;

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    if (Date.now() > deadline) {
      has_more = true;
      break;
    }

    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const messages = await Promise.all(batch.map(({ id }) => getGmailMessage(accessToken, id)));

    for (const msg of messages) {
      if (!msg) { skipped++; continue; }

      const hdrs = msg.payload.headers;
      const getHdr = (name: string) =>
        hdrs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

      const from = getHdr("from");
      const to = getHdr("to");
      const subject = getHdr("subject") || "(Sin asunto)";
      const dateStr = getHdr("date");
      const date = dateStr ? new Date(dateStr) : new Date(parseInt(msg.internalDate));

      const fromEmails = Array.from(from.matchAll(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gi)).map((m) => m[0].toLowerCase());
      const toEmails = Array.from(to.matchAll(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gi)).map((m) => m[0].toLowerCase());
      const direction: "sent" | "received" = fromEmails.includes(vendorEmail) ? "sent" : "received";

      const externalEmail = direction === "sent" ? toEmails[0] : fromEmails[0];
      if (!externalEmail || externalEmail === vendorEmail) { skipped++; continue; }

      // Extract body text
      function extractText(parts: Array<{ mimeType: string; body?: { data?: string }; parts?: unknown[] }> | undefined): string {
        if (!parts) return "";
        for (const part of parts) {
          if (part.mimeType === "text/plain" && part.body?.data) {
            return Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
          }
          if (part.parts) {
            const found = extractText(part.parts as Parameters<typeof extractText>[0]);
            if (found) return found;
          }
        }
        for (const part of parts) {
          if (part.mimeType === "text/html" && part.body?.data) {
            return Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64")
              .toString("utf-8")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s{2,}/g, " ")
              .trim()
              .slice(0, 2000);
          }
        }
        return "";
      }

      const bodyText = extractText(msg.payload.parts) ||
        (msg.payload.body?.data
          ? Buffer.from(msg.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
          : "");

      const marker = `<!-- gmail:${msg.id} -->`;
      const rawText = [
        marker,
        `Asunto: ${subject}`,
        `De: ${from}`,
        `Para: ${to}`,
        bodyText.slice(0, 3000) || "(sin cuerpo)",
      ].filter(Boolean).join("\n\n");

      const senderName = direction === "received"
        ? from.split("<")[0].trim() || undefined
        : undefined;

      const { error } = await supabase
        .from("gmail_queue")
        .upsert({
          company_id: companyId,
          user_id: userId,
          email_id: msg.id,
          raw_text: rawText,
          external_email: externalEmail,
          sender_name: senderName ?? null,
          occurred_at: date.toISOString(),
          direction,
        }, { onConflict: "user_id,email_id", ignoreDuplicates: true });

      if (!error) queued++;
      else console.error("[gmail/sync] queue insert error", error.message);
    }
  }

  // Update last_sync_at on normal syncs
  if (!force) {
    await supabase
      .from("channel_credentials")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("channel", "gmail");
  }

  return NextResponse.json({ ok: true, queued, skipped, total_found, has_more });
}
