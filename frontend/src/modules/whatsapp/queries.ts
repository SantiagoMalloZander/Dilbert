import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type WhatsAppConnection = {
  instanceName: string;
  status: "connected" | "disconnected" | "error" | "pending";
  phone: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
};

/**
 * The connected WhatsApp line for a vendor, if any. We model one line per vendor
 * stored under the whatsapp_business channel (Baileys is identical for personal).
 */
export async function getWhatsAppConnection(
  userId: string
): Promise<WhatsAppConnection | null> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("channel_credentials")
    .select("instance_name, status, phone, connected_at, last_sync_at")
    .eq("user_id", userId)
    .eq("channel", "whatsapp_business")
    .maybeSingle();

  if (!data?.instance_name) return null;

  return {
    instanceName: data.instance_name,
    status: data.status,
    phone: data.phone ?? null,
    connectedAt: data.connected_at ?? null,
    lastSyncAt: data.last_sync_at ?? null,
  };
}
