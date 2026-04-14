/**
 * POST /app/api/cron/gmail-sync
 *
 * Called by the Netlify scheduled function every 30 minutes.
 * Two-phase approach to stay within the 10s function timeout:
 *   Phase 1 — Sync: For each vendor with active Gmail, paginate new message IDs
 *             and queue them in gmail_queue (fast, no AI).
 *   Phase 2 — Process: Drain the queue one email at a time (AI + CRM write)
 *             until the 8s time budget is exhausted.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { refreshGmailToken, listAllGmailMessageIds, getGmailMessage } from "@/lib/gmail";
import { runAgent } from "@/lib/agent/orchestrator";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = request.headers.get("Authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const deadline = Date.now() + 8_000;

  // ── Find all vendors with active Gmail ─────────────────────────────────────
  const { data: rows } = await supabase
    .from("channel_credentials")
    .select("id, user_id, company_id, credentials, last_sync_at")
    .eq("channel", "gmail")
    .eq("status", "connected");

  if (!rows?.length) {
    return NextResponse.json({ ok: true, synced: 0, message: "No vendors with Gmail connected" });
  }

  // ── Phase 1: Sync new emails into the queue for each vendor ────────────────
  let totalQueued = 0;
  const syncResults: Array<{ userId: string; queued: number; error?: string }> = [];

  for (const row of rows) {
    if (Date.now() > deadline) break; // out of time

    try {
      const creds = row.credentials as Record<string, string>;
      const accessToken = await refreshGmailToken(creds.refreshToken);

      if (!accessToken) {
        await supabase
          .from("channel_credentials")
          .update({ status: "error" })
          .eq("id", row.id);
        syncResults.push({ userId: row.user_id, queued: 0, error: "token_refresh_failed" });
        continue;
      }

      const vendorEmail = creds.gmailEmail ?? "";
      // Cron always syncs today only (yesterday's date so Gmail's exclusive
      // after: filter captures all emails sent/received today).
      const lastSync = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const after = `${lastSync.getFullYear()}/${String(lastSync.getMonth() + 1).padStart(2, "0")}/${String(lastSync.getDate()).padStart(2, "0")}`;

      // Get all new message IDs since last sync
      const [sentIds, receivedIds] = await Promise.all([
        listAllGmailMessageIds(accessToken, `from:${vendorEmail} after:${after}`, 200),
        listAllGmailMessageIds(accessToken, `-from:${vendorEmail} after:${after} -in:trash -in:draft`, 200),
      ]);
      const allIds = [...new Map([...sentIds, ...receivedIds].map((m) => [m.id, m])).values()];

      if (!allIds.length) {
        await supabase
          .from("channel_credentials")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", row.id);
        syncResults.push({ userId: row.user_id, queued: 0 });
        continue;
      }

      // Dedup against already imported activities
      const { data: existingActivities } = await supabase
        .from("activities")
        .select("description")
        .eq("user_id", row.user_id)
        .eq("company_id", row.company_id)
        .not("description", "is", null)
        .like("description", "%<!-- gmail:%");

      const alreadyImportedIds = new Set(
        (existingActivities ?? [])
          .map((a) => {
            const match = (a.description ?? "").match(/<!-- gmail:([^>]+) -->/);
            return match?.[1] ?? null;
          })
          .filter(Boolean) as string[]
      );

      const toFetch = allIds.filter((m) => !alreadyImportedIds.has(m.id));
      let queued = 0;

      // Fetch and queue in batches of 10
      const BATCH_SIZE = 10;
      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        if (Date.now() > deadline) break;

        const batch = toFetch.slice(i, i + BATCH_SIZE);
        const messages = await Promise.all(batch.map(({ id }) => getGmailMessage(accessToken, id)));

        for (const msg of messages) {
          if (!msg) continue;

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

          if (!externalEmail || externalEmail === vendorEmail) continue;

          // Extract body text
          function extractText(parts: Array<{ mimeType: string; body?: { data?: string }; parts?: unknown[] }> | undefined): string {
            if (!parts) return "";
            for (const part of parts) {
              if (part.mimeType === "text/plain" && part.body?.data) {
                return Buffer.from((part.body.data as string).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
              }
              if (part.parts) {
                const found = extractText(part.parts as Parameters<typeof extractText>[0]);
                if (found) return found;
              }
            }
            for (const part of parts) {
              if (part.mimeType === "text/html" && part.body?.data) {
                return Buffer.from((part.body.data as string).replace(/-/g, "+").replace(/_/g, "/"), "base64")
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

          const rawText = [
            `<!-- gmail:${msg.id} -->`,
            `Asunto: ${subject}`,
            `De: ${from}`,
            `Para: ${to}`,
            bodyText.slice(0, 3000) || "(sin cuerpo)",
          ].join("\n\n");

          const senderName = direction === "received"
            ? from.split("<")[0].trim() || undefined
            : undefined;

          const { error } = await supabase
            .from("gmail_queue")
            .upsert({
              company_id: row.company_id,
              user_id: row.user_id,
              email_id: msg.id,
              raw_text: rawText,
              external_email: externalEmail,
              sender_name: senderName ?? null,
              occurred_at: date.toISOString(),
              direction,
            }, { onConflict: "user_id,email_id", ignoreDuplicates: true });

          if (!error) queued++;
        }
      }

      await supabase
        .from("channel_credentials")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", row.id);

      totalQueued += queued;
      syncResults.push({ userId: row.user_id, queued });
      console.log(`[cron/gmail-sync] vendor:${row.user_id} queued:${queued}`);
    } catch (vendorErr) {
      console.error(`[cron/gmail-sync] sync error vendor ${row.user_id}:`, vendorErr);
      syncResults.push({
        userId: row.user_id,
        queued: 0,
        error: vendorErr instanceof Error ? vendorErr.message : String(vendorErr),
      });
    }
  }

  // ── Phase 2: Process queue items within remaining time budget ──────────────
  let processed = 0;

  while (Date.now() < deadline - 2_500) {
    // Check if there are any pending queue items
    const { data: queueRow } = await supabase
      .from("gmail_queue")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!queueRow) break;

    try {
      await runAgent({
        companyId: queueRow.company_id as string,
        userId: queueRow.user_id as string,
        source: "gmail",
        rawText: queueRow.raw_text as string,
        channelIdentifier: queueRow.external_email as string,
        senderName: (queueRow.sender_name as string | null) ?? undefined,
        occurredAt: queueRow.occurred_at as string,
      });
      processed++;
    } catch (err) {
      console.error(`[cron/gmail-sync] process error email:${queueRow.email_id}`, err);
    }

    // Always delete from queue regardless of outcome
    await supabase.from("gmail_queue").delete().eq("id", queueRow.id);
  }

  // Count remaining in queue
  const { count: remaining } = await supabase
    .from("gmail_queue")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    ok: true,
    synced: rows.length,
    totalQueued,
    processed,
    queueRemaining: remaining ?? 0,
    syncResults,
  });
}
