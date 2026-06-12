"use server";

import { requireAuth } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

async function requireOwnerCompany() {
  const { user, company_id } = await requireAuth({ requireCompany: true });
  if (!company_id) throw new Error("COMPANY_REQUIRED");
  if (user.role !== "owner" && !user.isSuperAdmin) throw new Error("FORBIDDEN");
  return company_id;
}

/** Saves the YCloud WhatsApp bot credentials into company settings (merged). */
export async function saveBotConfig(input: {
  apiKey: string;
  phoneNumber: string;
}): Promise<void> {
  const companyId = await requireOwnerCompany();
  const apiKey = input.apiKey.trim();
  const phoneNumber = input.phoneNumber.trim().replace(/[^\d+]/g, "");

  if (!apiKey) throw new Error("API_KEY_REQUIRED");
  if (phoneNumber.replace(/\D/g, "").length < 8) throw new Error("PHONE_REQUIRED");

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const next = {
    ...settings,
    bot_whatsapp: {
      provider: "ycloud",
      api_key: apiKey,
      phone_number: phoneNumber,
      configured_at: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from("companies")
    .update({ settings: next as never })
    .eq("id", companyId);
  if (error) throw error;
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
