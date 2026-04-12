import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agent/orchestrator";

/**
 * Webhook receiver for Evolution API WhatsApp messages
 *
 * Authentication: instance name → channel_credentials lookup
 * AI: runs full orchestrator pipeline on each message
 */

interface EvolutionWebhookPayload {
  instance: string;
  data?: {
    messages?: Array<{
      id: string;
      from: string;
      to: string;
      body: string;
      timestamp: number;
      media?: { url: string; type: string };
    }>;
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as EvolutionWebhookPayload;

    if (!payload.instance || !payload.data?.messages?.length) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createAdminSupabaseClient();

    // Resolve vendor from instance name
    const { data: credentials } = await supabase
      .from("channel_credentials")
      .select("company_id, user_id")
      .eq("instance_name", payload.instance)
      .single();

    if (!credentials) {
      console.error("[webhook/whatsapp] Instance not found:", payload.instance);
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const { company_id: companyId, user_id: userId } = credentials;
    const results = [];

    for (const message of payload.data.messages) {
      if (!message.body?.trim()) continue;

      const phone = message.from.replace(/\D/g, "");
      const occurredAt = new Date(message.timestamp * 1000).toISOString();

      const result = await runAgent({
        companyId,
        userId,
        source: "whatsapp",
        rawText: message.body,
        channelIdentifier: phone,
        occurredAt,
      });

      console.log(`[webhook/whatsapp] message from ${phone} → status:${result.status} ${result.summary}`);
      results.push({ phone, status: result.status });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error("[webhook/whatsapp] Error:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
