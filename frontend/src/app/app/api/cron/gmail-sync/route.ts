/**
 * POST /app/api/cron/gmail-sync
 *
 * Called by the Netlify scheduled function every 30 minutes.
 * Syncs Gmail for ALL vendors who have an active Gmail connection.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { refreshGmailToken, fetchParsedEmails } from "@/lib/gmail";
import { runAgent } from "@/lib/agent/orchestrator";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = request.headers.get("Authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  // ── Find all vendors with active Gmail ─────────────────────────────────────
  const { data: rows } = await supabase
    .from("channel_credentials")
    .select("id, user_id, company_id, credentials, last_sync_at")
    .eq("channel", "gmail")
    .eq("status", "connected");

  if (!rows?.length) {
    return NextResponse.json({ ok: true, synced: 0, message: "No vendors with Gmail connected" });
  }

  const results: Array<{ userId: string; imported: number; skipped: number; error?: string }> = [];

  for (const row of rows) {
    try {
      const creds = row.credentials as Record<string, string>;
      const accessToken = await refreshGmailToken(creds.refreshToken);

      if (!accessToken) {
        // Mark as disconnected so we stop trying
        await supabase
          .from("channel_credentials")
          .update({ status: "error" })
          .eq("id", row.id);
        results.push({ userId: row.user_id, imported: 0, skipped: 0, error: "token_refresh_failed" });
        continue;
      }

      const vendorEmail = creds.gmailEmail ?? "";
      const lastSync = row.last_sync_at
        ? new Date(row.last_sync_at)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const afterDate = [
        lastSync.getFullYear(),
        String(lastSync.getMonth() + 1).padStart(2, "0"),
        String(lastSync.getDate()).padStart(2, "0"),
      ].join("/");

      const [sentEmails, receivedEmails] = await Promise.all([
        fetchParsedEmails(accessToken, vendorEmail, `from:${vendorEmail} after:${afterDate}`, 20),
        fetchParsedEmails(accessToken, vendorEmail, `-from:${vendorEmail} after:${afterDate} -in:trash -in:draft`, 20),
      ]);

      const unique = [...new Map(
        [...sentEmails, ...receivedEmails].map((e) => [e.id, e])
      ).values()];

      let imported = 0;
      let skipped = 0;

      for (const email of unique) {
        try {
          const marker = `<!-- gmail:${email.id} -->`;

          // Dedup check
          const { data: existing } = await supabase
            .from("activities")
            .select("id")
            .eq("company_id", row.company_id)
            .eq("user_id", row.user_id)
            .like("description", `%${marker}%`)
            .maybeSingle();

          if (existing) { skipped++; continue; }

          const externalEmail = email.direction === "sent"
            ? email.toEmails[0]
            : email.fromEmail;

          if (!externalEmail || externalEmail === vendorEmail) { skipped++; continue; }

          // Marker goes FIRST so it's always within the 600-char CRM snippet (dedup)
          const rawText = [
            marker,
            `Asunto: ${email.subject}`,
            `De: ${email.from}`,
            `Para: ${email.to}`,
            email.snippet,
          ].filter(Boolean).join("\n\n");

          const result = await runAgent({
            companyId: row.company_id,
            userId: row.user_id,
            source: "gmail",
            rawText,
            channelIdentifier: externalEmail.toLowerCase(),
            senderName: email.direction === "received"
              ? email.from.split("<")[0].trim() || undefined
              : undefined,
            occurredAt: email.date.toISOString(),
          });

          if (result.status === "ok" || result.status === "new_contact") {
            imported++;
          } else {
            skipped++;
          }
        } catch (emailErr) {
          console.error(`[cron/gmail-sync] email ${email.id}:`, emailErr);
          skipped++;
        }
      }

      // Update last_sync_at
      await supabase
        .from("channel_credentials")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", row.id);

      results.push({ userId: row.user_id, imported, skipped });
      console.log(`[cron/gmail-sync] vendor:${row.user_id} imported:${imported} skipped:${skipped}`);
    } catch (vendorErr) {
      console.error(`[cron/gmail-sync] vendor ${row.user_id}:`, vendorErr);
      results.push({
        userId: row.user_id,
        imported: 0,
        skipped: 0,
        error: vendorErr instanceof Error ? vendorErr.message : String(vendorErr),
      });
    }
  }

  const totalImported = results.reduce((s, r) => s + r.imported, 0);
  return NextResponse.json({ ok: true, synced: rows.length, totalImported, results });
}
