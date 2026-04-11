import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { getInstanceStatus } from "@/lib/evolution-api";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ChannelType = Database["public"]["Enums"]["channel_type"];

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id || session.user.role !== "vendor") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const instanceName = searchParams.get("instance");
  const channelType = searchParams.get("channelType");

  if (!instanceName || !channelType) {
    return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  }

  const status = await getInstanceStatus(instanceName);

  const validChannelTypes: ChannelType[] = [
    "whatsapp_business",
    "whatsapp_personal",
    "gmail",
    "fathom",
  ];

  if (status === "connected" && session.user.companyId && validChannelTypes.includes(channelType as ChannelType)) {
    const supabase = createAdminSupabaseClient();
    await supabase
      .from("channel_credentials")
      .upsert(
        {
          company_id: session.user.companyId,
          user_id: session.user.id,
          channel: channelType as ChannelType,
          credentials: { instanceName },
          status: "connected",
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "user_id,channel" }
      );
  }

  return NextResponse.json({ status });
}
