"use server";

import { requireAuth } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  listWhatsAppNumbers,
  ensureWebhookEndpoint,
  phoneDigits,
  samePhone,
} from "@/lib/ycloud/client";

async function requireOwnerCompany() {
  const { user, company_id } = await requireAuth({ requireCompany: true });
  if (!company_id) throw new Error("COMPANY_REQUIRED");
  if (user.role !== "owner" && !user.isSuperAdmin) throw new Error("FORBIDDEN");
  return company_id;
}

function botWebhookUrl(companyId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://dilvert.netlify.app";
  const secret = process.env.YCLOUD_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
  return `${base.replace(/\/$/, "")}/app/api/ycloud/webhook?cid=${encodeURIComponent(
    companyId
  )}&secret=${encodeURIComponent(secret)}`;
}

export type SaveBotResult =
  | { ok: true; phoneNumber: string }
  | { ok: false; error: "invalid_key" | "phone_not_found" | "webhook_failed" | "unknown" };

/**
 * Connects the YCloud WhatsApp bot end-to-end:
 *   1. validates the API key against YCloud,
 *   2. checks the phone number actually exists in that YCloud account,
 *   3. registers our webhook on the tenant's account (so messages flow in),
 *   4. persists everything into company settings.
 */
export async function saveBotConfig(input: {
  apiKey: string;
  phoneNumber: string;
}): Promise<SaveBotResult> {
  const companyId = await requireOwnerCompany();
  const apiKey = input.apiKey.trim();
  const phoneNumber = input.phoneNumber.trim().replace(/[^\d+]/g, "");

  if (!apiKey) return { ok: false, error: "invalid_key" };
  if (phoneDigits(phoneNumber).length < 8) return { ok: false, error: "phone_not_found" };

  // 1–2. The key must be real and the number must live in that account.
  let accountNumbers;
  try {
    accountNumbers = await listWhatsAppNumbers(apiKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    return { ok: false, error: msg === "YCLOUD_INVALID_KEY" ? "invalid_key" : "unknown" };
  }

  const match = accountNumbers.find((n) =>
    samePhone(n.phoneNumber ?? n.displayPhoneNumber ?? "", phoneNumber)
  );
  if (accountNumbers.length > 0 && !match) {
    return { ok: false, error: "phone_not_found" };
  }

  // 3. Register (or refresh) the webhook so YCloud pushes messages to us.
  try {
    await ensureWebhookEndpoint(apiKey, botWebhookUrl(companyId));
  } catch (err) {
    console.error("[bot] webhook registration failed", err);
    return { ok: false, error: "webhook_failed" };
  }

  // 4. Persist.
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const canonicalPhone = match?.phoneNumber ?? phoneNumber;
  const next = {
    ...settings,
    bot_whatsapp: {
      provider: "ycloud",
      api_key: apiKey,
      phone_number: canonicalPhone,
      phone_digits: phoneDigits(canonicalPhone),
      webhook_registered_at: new Date().toISOString(),
      configured_at: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from("companies")
    .update({ settings: next as never })
    .eq("id", companyId);
  if (error) return { ok: false, error: "unknown" };

  return { ok: true, phoneNumber: canonicalPhone };
}

/** Removes the saved bot config. */
export async function disconnectBot(): Promise<void> {
  const companyId = await requireOwnerCompany();
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  delete settings.bot_whatsapp;
  const { error } = await supabase
    .from("companies")
    .update({ settings: settings as never })
    .eq("id", companyId);
  if (error) throw error;
}
