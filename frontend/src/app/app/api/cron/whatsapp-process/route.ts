/**
 * POST /app/api/cron/whatsapp-process   (Authorization: Bearer CRON_SECRET)
 *
 * Debounced WhatsApp processor. Reads pending rows from whatsapp_message_queue,
 * groups them per conversation (line + counterpart), and once a conversation has
 * been quiet for DEBOUNCE_SECONDS it builds a single transcript and runs the CRM
 * agent ONCE for that burst. This is the "follow a line, keep context, but don't
 * react message-by-message" behaviour: the phone number anchors the lead, the AI
 * only extracts data.
 *
 * Filters applied here (cheap, batched):
 *   - conversations with another teammate's number are dropped ("no entre vendedores")
 * The real-estate relevance gate lives inside runAgent (drops off-topic chats and,
 * for unknown numbers, decides whether to create a new lead).
 */

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agent/orchestrator";

const DEBOUNCE_SECONDS = 45;
const MAX_CONVERSATIONS_PER_RUN = 20;
const MAX_PENDING_SCAN = 800;
const MAX_TRANSCRIPT_CHARS = 6000;

type QueueRow = {
  id: string;
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
};

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

/** Loose phone equality tolerant to country-code / 9-prefix differences. */
function samePhone(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const sa = a.slice(-10);
  const sb = b.slice(-10);
  return sa.length >= 8 && sa === sb;
}

async function getTeammatePhones(companyId: string): Promise<string[]> {
  const supabase = createAdminSupabaseClient();
  const [{ data: users }, { data: creds }] = await Promise.all([
    supabase.from("users").select("phone").eq("company_id", companyId),
    supabase
      .from("channel_credentials")
      .select("phone")
      .eq("company_id", companyId)
      .not("phone", "is", null),
  ]);

  const phones: string[] = [];
  for (const u of users ?? []) {
    if (u.phone) phones.push(String(u.phone).replace(/\D/g, ""));
  }
  for (const c of creds ?? []) {
    if (c.phone) phones.push(String(c.phone).replace(/\D/g, ""));
  }
  return phones.filter(Boolean);
}

function buildTranscript(rows: QueueRow[]): string {
  const lines = rows.map((r) => {
    const who = r.from_me ? "Vendedor" : r.push_name?.trim() || "Cliente";
    return `${who}: ${r.raw_text}`;
  });
  let transcript = lines.join("\n");
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    // Keep the most recent part of the conversation.
    transcript = transcript.slice(transcript.length - MAX_TRANSCRIPT_CHARS);
  }
  return transcript;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: pending, error } = await supabase
    .from("whatsapp_message_queue")
    .select(
      "id, company_id, user_id, instance_name, remote_jid, phone, message_id, from_me, push_name, raw_text, occurred_at"
    )
    .eq("status", "pending")
    .order("occurred_at", { ascending: true })
    .limit(MAX_PENDING_SCAN);

  if (error) {
    console.error("[whatsapp-process] fetch error", error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const rows = (pending as QueueRow[] | null) ?? [];
  if (!rows.length) {
    return NextResponse.json({ ok: true, processed: 0, skipped: 0, conversations: 0 });
  }

  // Group by conversation: instance + counterpart.
  const groups = new Map<string, QueueRow[]>();
  for (const row of rows) {
    const key = `${row.instance_name}::${row.remote_jid}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const debounceCutoff = Date.now() - DEBOUNCE_SECONDS * 1000;
  const teammateCache = new Map<string, string[]>();

  let processed = 0;
  let skipped = 0;
  let conversations = 0;

  for (const [, convRows] of groups) {
    if (conversations >= MAX_CONVERSATIONS_PER_RUN) break;

    // Wait until the burst settles (newest message older than the debounce window).
    const newest = Math.max(...convRows.map((r) => new Date(r.occurred_at).getTime()));
    if (newest > debounceCutoff) continue;

    convRows.sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );

    const first = convRows[0];
    const ids = convRows.map((r) => r.id);
    conversations++;

    // "No entre vendedores": drop conversations whose counterpart is a teammate.
    let teammates = teammateCache.get(first.company_id);
    if (!teammates) {
      teammates = await getTeammatePhones(first.company_id);
      teammateCache.set(first.company_id, teammates);
    }
    if (teammates.some((p) => samePhone(p, first.phone))) {
      await supabase
        .from("whatsapp_message_queue")
        .update({ status: "skipped", processed_at: new Date().toISOString() })
        .in("id", ids);
      skipped += ids.length;
      continue;
    }

    const transcript = buildTranscript(convRows);
    const lastInbound = [...convRows].reverse().find((r) => !r.from_me);
    const last = convRows[convRows.length - 1];

    try {
      await runAgent({
        companyId: first.company_id,
        userId: first.user_id,
        source: "whatsapp",
        rawText: transcript,
        channelIdentifier: first.phone,
        senderName: lastInbound?.push_name ?? undefined,
        occurredAt: last.occurred_at,
        externalId: `wa_${first.instance_name}_${last.message_id}`,
      });

      await supabase
        .from("whatsapp_message_queue")
        .update({ status: "done", processed_at: new Date().toISOString() })
        .in("id", ids);
      processed += ids.length;
    } catch (err) {
      console.error("[whatsapp-process] runAgent error", err);
      // Drop the batch to avoid an infinite retry loop on a poison message.
      await supabase
        .from("whatsapp_message_queue")
        .update({ status: "skipped", processed_at: new Date().toISOString() })
        .in("id", ids);
      skipped += ids.length;
    }
  }

  return NextResponse.json({ ok: true, processed, skipped, conversations });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
