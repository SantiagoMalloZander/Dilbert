/**
 * POST /app/api/evolution/webhook?secret=...
 *
 * Receiver for Evolution API events. Kept intentionally dumb and fast: it does NO
 * AI work. It validates the shared secret, maps the instance to a vendor, drops
 * groups/broadcasts, and stages message text into whatsapp_message_queue. The
 * debounced cron (/app/api/cron/whatsapp-process) does the actual extraction.
 *
 * Always returns 200 (even on internal hiccups) so Evolution doesn't enter a
 * retry storm — anything we couldn't stage is simply lost, which is acceptable.
 */

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  extractMessageText,
  isIgnorableJid,
  digitsFromJid,
} from "@/lib/evolution/client";

type EvoMessage = {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  message?: Record<string, unknown> | null;
  pushName?: string;
  messageTimestamp?: number | string;
};

type EvoPayload = {
  event?: string;
  instance?: string;
  data?: EvoMessage | EvoMessage[] | { state?: string };
};

function expectedSecret() {
  return process.env.EVOLUTION_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
}

function toIsoFromTimestamp(ts: number | string | undefined): string {
  const sec = typeof ts === "string" ? parseInt(ts, 10) : ts ?? 0;
  const ms = sec > 0 ? sec * 1000 : Date.now();
  return new Date(ms).toISOString();
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") ?? "";
  const expected = expectedSecret();

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: EvoPayload;
  try {
    payload = (await request.json()) as EvoPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const event = (payload.event ?? "").toLowerCase().replace(/_/g, ".");
  const instanceName = payload.instance;
  if (!instanceName) return NextResponse.json({ ok: true });

  try {
    const supabase = createAdminSupabaseClient();

    // Map the instance to a vendor/company. Unknown instance → ignore.
    const { data: cred } = await supabase
      .from("channel_credentials")
      .select("company_id, user_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!cred?.company_id || !cred.user_id) {
      return NextResponse.json({ ok: true });
    }

    const companyId = cred.company_id;
    const userId = cred.user_id;

    // Keep connection status fresh from CONNECTION_UPDATE events.
    if (event === "connection.update") {
      const state = (payload.data as { state?: string })?.state;
      if (state === "open" || state === "close") {
        await supabase
          .from("channel_credentials")
          .update({
            status: state === "open" ? "connected" : "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("instance_name", instanceName);
      }
      return NextResponse.json({ ok: true });
    }

    if (event !== "messages.upsert") {
      return NextResponse.json({ ok: true });
    }

    const messages = Array.isArray(payload.data)
      ? (payload.data as EvoMessage[])
      : [payload.data as EvoMessage];

    const rows = messages
      .map((msg) => {
        const remoteJid = msg?.key?.remoteJid ?? "";
        const text = extractMessageText(msg?.message);
        return { msg, remoteJid, text };
      })
      .filter(
        (r) => r.msg?.key?.id && r.text && !isIgnorableJid(r.remoteJid)
      )
      .map((r) => ({
        company_id: companyId,
        user_id: userId,
        instance_name: instanceName,
        remote_jid: r.remoteJid,
        phone: digitsFromJid(r.remoteJid),
        message_id: r.msg.key!.id!,
        from_me: Boolean(r.msg.key?.fromMe),
        push_name: r.msg.pushName ?? null,
        raw_text: r.text,
        occurred_at: toIsoFromTimestamp(r.msg.messageTimestamp),
        status: "pending" as const,
      }));

    if (rows.length) {
      await supabase
        .from("whatsapp_message_queue")
        .upsert(rows, { onConflict: "instance_name,message_id", ignoreDuplicates: true });
    }
  } catch (err) {
    console.error("[evolution/webhook] error", err);
  }

  return NextResponse.json({ ok: true });
}
