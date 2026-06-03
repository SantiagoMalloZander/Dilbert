"use server";

import { requireAuth } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  ensureInstance,
  setWebhook,
  connectInstance,
  getConnectionState,
  getInstanceOwnerPhone,
  logoutInstance,
  deleteInstance,
  findMessages,
  extractMessageText,
  isIgnorableJid,
  digitsFromJid,
  type QrPayload,
} from "@/lib/evolution/client";

const WHATSAPP_CHANNEL = "whatsapp_business" as const;
const BACKFILL_MAX_MESSAGES = 300;
const BACKFILL_MAX_AGE_DAYS = 30;

/** Stable per-vendor instance name. Evolution allows letters, digits and underscores. */
function instanceNameFor(companyId: string, userId: string): string {
  const c = companyId.replace(/-/g, "");
  const u = userId.replace(/-/g, "");
  return `dilbert_${c}_${u}`;
}

function getWebhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://dilvert.netlify.app";
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
  return `${base.replace(/\/$/, "")}/app/api/evolution/webhook?secret=${encodeURIComponent(secret)}`;
}

async function upsertCredential(params: {
  userId: string;
  companyId: string;
  instanceName: string;
  status: "connected" | "disconnected" | "error" | "pending";
  phone?: string | null;
  connectedAt?: string;
}) {
  const supabase = createAdminSupabaseClient();
  await supabase.from("channel_credentials").upsert(
    {
      user_id: params.userId,
      company_id: params.companyId,
      channel: WHATSAPP_CHANNEL,
      instance_name: params.instanceName,
      status: params.status,
      updated_at: new Date().toISOString(),
      ...(params.phone !== undefined ? { phone: params.phone } : {}),
      ...(params.connectedAt !== undefined ? { connected_at: params.connectedAt } : {}),
    },
    { onConflict: "user_id,channel" }
  );
}

/**
 * Start (or refresh) the vendor's WhatsApp connection and return a QR to scan.
 * Works identically for WhatsApp personal and Business — both pair via QR/Baileys.
 */
export async function connectWhatsApp(): Promise<QrPayload> {
  const { user, company_id } = await requireAuth({ requireCompany: true });
  if (!company_id) throw new Error("COMPANY_REQUIRED");

  const instanceName = instanceNameFor(company_id, user.id);

  await ensureInstance(instanceName);
  await setWebhook(instanceName, getWebhookUrl());
  await upsertCredential({
    userId: user.id,
    companyId: company_id,
    instanceName,
    status: "pending",
  });

  return connectInstance(instanceName);
}

/**
 * Poll the connection state. When the line flips to "open" for the first time we
 * capture the owner number, mark it connected and backfill recent history once.
 */
export async function getWhatsAppStatus(): Promise<{
  state: "open" | "connecting" | "close" | "unknown";
  phone: string | null;
}> {
  const { user, company_id } = await requireAuth({ requireCompany: true });
  if (!company_id) throw new Error("COMPANY_REQUIRED");

  const supabase = createAdminSupabaseClient();
  const { data: cred } = await supabase
    .from("channel_credentials")
    .select("instance_name, status, phone, backfilled_at")
    .eq("user_id", user.id)
    .eq("channel", WHATSAPP_CHANNEL)
    .maybeSingle();

  if (!cred?.instance_name) {
    return { state: "unknown", phone: null };
  }

  const state = await getConnectionState(cred.instance_name);

  if (state === "open") {
    const phone = cred.phone ?? (await getInstanceOwnerPhone(cred.instance_name));

    if (cred.status !== "connected" || (phone && cred.phone !== phone)) {
      await upsertCredential({
        userId: user.id,
        companyId: company_id,
        instanceName: cred.instance_name,
        status: "connected",
        phone: phone ?? null,
        connectedAt: new Date().toISOString(),
      });
    }

    // One-time history backfill (best-effort; never blocks the UI on failure).
    if (!cred.backfilled_at) {
      try {
        await backfillHistory({
          companyId: company_id,
          userId: user.id,
          instanceName: cred.instance_name,
        });
      } catch (err) {
        console.error("[whatsapp] backfill error", err);
      }
      await supabase
        .from("channel_credentials")
        .update({ backfilled_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("channel", WHATSAPP_CHANNEL);
    }

    return { state, phone: phone ?? null };
  }

  if (state === "close" && cred.status === "connected") {
    await upsertCredential({
      userId: user.id,
      companyId: company_id,
      instanceName: cred.instance_name,
      status: "disconnected",
    });
  }

  return { state, phone: cred.phone ?? null };
}

export async function disconnectWhatsApp(): Promise<void> {
  const { user, company_id } = await requireAuth({ requireCompany: true });
  if (!company_id) throw new Error("COMPANY_REQUIRED");

  const supabase = createAdminSupabaseClient();
  const { data: cred } = await supabase
    .from("channel_credentials")
    .select("instance_name")
    .eq("user_id", user.id)
    .eq("channel", WHATSAPP_CHANNEL)
    .maybeSingle();

  if (cred?.instance_name) {
    await logoutInstance(cred.instance_name);
    await deleteInstance(cred.instance_name);
  }

  await supabase
    .from("channel_credentials")
    .update({ status: "disconnected", phone: null, backfilled_at: null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("channel", WHATSAPP_CHANNEL);
}

// ── Backfill: enqueue recent 1:1 messages so the cron processes them ─────────────

async function backfillHistory(params: {
  companyId: string;
  userId: string;
  instanceName: string;
}): Promise<void> {
  const messages = await findMessages(params.instanceName);
  if (!messages.length) return;

  const cutoff = Date.now() - BACKFILL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  const rows = messages
    .map((msg) => {
      const remoteJid = msg.key?.remoteJid ?? "";
      const text = extractMessageText(msg.message);
      const tsRaw = msg.messageTimestamp;
      const tsSec = typeof tsRaw === "string" ? parseInt(tsRaw, 10) : tsRaw ?? 0;
      const occurredMs = tsSec > 0 ? tsSec * 1000 : 0;
      return { msg, remoteJid, text, occurredMs };
    })
    .filter(
      (r) =>
        r.text &&
        r.msg.key?.id &&
        !isIgnorableJid(r.remoteJid) &&
        r.occurredMs >= cutoff
    )
    .sort((a, b) => b.occurredMs - a.occurredMs)
    .slice(0, BACKFILL_MAX_MESSAGES)
    .map((r) => ({
      company_id: params.companyId,
      user_id: params.userId,
      instance_name: params.instanceName,
      remote_jid: r.remoteJid,
      phone: digitsFromJid(r.remoteJid),
      message_id: r.msg.key!.id!,
      from_me: Boolean(r.msg.key?.fromMe),
      push_name: r.msg.pushName ?? null,
      raw_text: r.text,
      occurred_at: new Date(r.occurredMs).toISOString(),
      status: "pending" as const,
    }));

  if (!rows.length) return;

  const supabase = createAdminSupabaseClient();
  // Ignore duplicates (unique on instance_name+message_id).
  await supabase
    .from("whatsapp_message_queue")
    .upsert(rows, { onConflict: "instance_name,message_id", ignoreDuplicates: true });
}
