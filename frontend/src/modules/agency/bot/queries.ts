import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type BotConfig = {
  configured: boolean;
  phoneNumber: string | null;
  configuredAt: string | null;
};

/** Reads the saved YCloud/WhatsApp bot config from company settings.
 *  Never returns the API key (sensitive) — only whether it's configured. */
export async function getBotConfig(companyId: string): Promise<BotConfig> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const bot = (settings.bot_whatsapp ?? {}) as Record<string, unknown>;
  return {
    configured: Boolean(bot.api_key && bot.phone_number),
    phoneNumber: (bot.phone_number as string | null) ?? null,
    configuredAt: (bot.configured_at as string | null) ?? null,
  };
}
