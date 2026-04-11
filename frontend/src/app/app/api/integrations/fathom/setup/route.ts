import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const FATHOM_API = "https://api.fathom.ai/external/v1";
const WEBHOOK_BASE = "https://dilvert.netlify.app/api/webhooks/fathom";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id || session.user.role !== "vendor" || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { apiKey } = await request.json() as { apiKey: string };
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "API Key requerida." }, { status: 400 });
  }

  const userId = session.user.id;
  const companyId = session.user.companyId;
  const destinationUrl = `${WEBHOOK_BASE}?token=${userId}`;

  // Delete any existing Fathom webhook for this user (stored webhookId)
  const supabase = createAdminSupabaseClient();
  const { data: existing } = await supabase
    .from("channel_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("channel", "fathom")
    .maybeSingle();

  const existingCreds = existing?.credentials as Record<string, string> | null;
  if (existingCreds?.webhookId) {
    await fetch(`${FATHOM_API}/webhooks/${existingCreds.webhookId}`, {
      method: "DELETE",
      headers: { "X-Api-Key": existingCreds.fathomApiKey ?? apiKey },
    }).catch(() => null);
  }

  // Create new webhook in Fathom
  const webhookRes = await fetch(`${FATHOM_API}/webhooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey.trim(),
    },
    body: JSON.stringify({
      destination_url: destinationUrl,
      triggered_for: ["my_recordings"],
      include_transcript: true,
      include_summary: true,
      include_action_items: true,
    }),
  });

  if (!webhookRes.ok) {
    const err = await webhookRes.json().catch(() => ({}));
    console.error("[fathom/setup] webhook creation failed:", err);
    return NextResponse.json(
      { error: "No pude crear el webhook en Fathom. Verificá que la API Key sea correcta." },
      { status: 400 }
    );
  }

  const webhook = await webhookRes.json() as { id: string; secret: string };

  // Save credentials
  const { error } = await supabase.from("channel_credentials").upsert(
    {
      company_id: companyId,
      user_id: userId,
      channel: "fathom",
      credentials: {
        fathomApiKey: apiKey.trim(),
        webhookId: String(webhook.id),
        webhookSecret: webhook.secret,
      },
      status: "connected",
      last_sync_at: new Date().toISOString(),
    },
    { onConflict: "user_id,channel" }
  );

  if (error) {
    console.error("[fathom/setup] db error:", error);
    return NextResponse.json({ error: "Error al guardar configuración." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
