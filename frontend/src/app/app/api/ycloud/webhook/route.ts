/**
 * POST /app/api/ycloud/webhook?cid=<companyId>&secret=...
 *
 * Receiver for YCloud (bot WhatsApp) events. Mirrors the Evolution receiver:
 * NO AI work here — it validates the shared secret, resolves the company,
 * and stages message text into whatsapp_message_queue. The debounced cron
 * (/app/api/cron/whatsapp-process) builds the transcript and runs the agent,
 * so bot conversations update the pipeline exactly like vendor conversations.
 *
 * Company resolution: the ?cid param (we register one endpoint per tenant on
 * THEIR YCloud account), with a fallback lookup by the bot's phone number.
 * Queue rows are attributed to the company owner.
 *
 * Always returns 200 so YCloud doesn't disable the endpoint on retries.
 */

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  extractInboundText,
  phoneDigits,
  samePhone,
  type YCloudEvent,
} from "@/lib/ycloud/client";

export const dynamic = "force-dynamic";

function expectedSecret() {
  return process.env.YCLOUD_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
}

function instanceNameFor(companyId: string): string {
  return `ycloud_${companyId.replace(/-/g, "")}`;
}

type BotSettings = { phone_number?: string; phone_digits?: string };

async function resolveCompany(
  cid: string | null,
  botNumber: string
): Promise<{ companyId: string; ownerId: string } | null> {
  const supabase = createAdminSupabaseClient();

  let companyId: string | null = null;

  if (cid) {
    const { data } = await supabase
      .from("companies")
      .select("id, settings")
      .eq("id", cid)
      .maybeSingle();
    if (data?.id) {
      // The configured bot number must match the event's business number, so a
      // stale endpoint from a previous tenant config can't inject data.
      const bot = ((data.settings ?? {}) as { bot_whatsapp?: BotSettings }).bot_whatsapp;
      const configured = bot?.phone_digits || bot?.phone_number || "";
      if (!botNumber || !configured || samePhone(configured, botNumber)) {
        companyId = data.id;
      }
    }
  }

  if (!companyId && botNumber) {
    // Fallback: find the company whose bot is this number.
    const { data } = await supabase
      .from("companies")
      .select("id, settings")
      .not("settings->bot_whatsapp", "is", null)
      .limit(200);
    const hit = (data ?? []).find((c) => {
      const bot = ((c.settings ?? {}) as { bot_whatsapp?: BotSettings }).bot_whatsapp;
      return samePhone(bot?.phone_digits || bot?.phone_number || "", botNumber);
    });
    companyId = hit?.id ?? null;
  }

  if (!companyId) return null;

  const { data: owner } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("role", "owner")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!owner?.id) return null;
  return { companyId, ownerId: owner.id };
}

type QueueInsert = {
  company_id: string;
  user_id: string;
  instance_name: string;
  remote_jid: string;
  phone: string;
  message_id: string;
  from_me: boolean;
  push_name: string | null;
  raw_text: string;
  occurred_at: string;
  status: "pending";
};

function rowFromEvent(
  event: YCloudEvent,
  ctx: { companyId: string; ownerId: string }
): QueueInsert | null {
  const type = event.type ?? "";

  if (type === "whatsapp.inbound_message.received" && event.whatsappInboundMessage) {
    const msg = event.whatsappInboundMessage;
    const text = extractInboundText(msg);
    const customer = phoneDigits(msg.from);
    const id = msg.wamid || msg.id;
    if (!text || !customer || !id) return null;
    return {
      company_id: ctx.companyId,
      user_id: ctx.ownerId,
      instance_name: instanceNameFor(ctx.companyId),
      remote_jid: `${customer}@ycloud`,
      phone: customer,
      message_id: id,
      from_me: false,
      push_name: msg.customerProfile?.name ?? null,
      raw_text: text,
      occurred_at: msg.sendTime || event.createTime || new Date().toISOString(),
      status: "pending",
    };
  }

  if (type === "whatsapp.message.updated" && event.whatsappMessage) {
    // Outbound bot replies: only useful statuses, deduped by message id.
    const msg = event.whatsappMessage;
    const status = (msg.status ?? "").toLowerCase();
    if (status === "failed") return null;
    const text = (msg.text?.body ?? "").trim();
    const customer = phoneDigits(msg.to);
    const id = msg.wamid || msg.id;
    if (!text || !customer || !id) return null;
    return {
      company_id: ctx.companyId,
      user_id: ctx.ownerId,
      instance_name: instanceNameFor(ctx.companyId),
      remote_jid: `${customer}@ycloud`,
      phone: customer,
      message_id: id,
      from_me: true,
      push_name: null,
      raw_text: text,
      occurred_at: msg.createTime || event.createTime || new Date().toISOString(),
      status: "pending",
    };
  }

  return null;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") ?? "";
  const cid = url.searchParams.get("cid");
  const expected = expectedSecret();

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // YCloud delivers one event per request, but be tolerant to batched arrays.
  const events = (Array.isArray(body) ? body : [body]) as YCloudEvent[];

  try {
    const first = events.find(
      (e) => e?.whatsappInboundMessage?.to || e?.whatsappMessage?.from
    );
    const botNumber = phoneDigits(
      first?.whatsappInboundMessage?.to || first?.whatsappMessage?.from
    );

    const ctx = await resolveCompany(cid, botNumber);
    if (!ctx) return NextResponse.json({ ok: true });

    const rows = events
      .map((e) => rowFromEvent(e, ctx))
      .filter((r): r is QueueInsert => r !== null);

    if (rows.length) {
      const supabase = createAdminSupabaseClient();
      await supabase
        .from("whatsapp_message_queue")
        .upsert(rows, { onConflict: "instance_name,message_id", ignoreDuplicates: true });
    }
  } catch (err) {
    console.error("[ycloud/webhook] error", err);
  }

  return NextResponse.json({ ok: true });
}

/** YCloud sends a GET probe when you register an endpoint. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
