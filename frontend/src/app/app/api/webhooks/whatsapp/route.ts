import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { EvolutionMessage } from "@/lib/evolution-api";

/**
 * Webhook receiver for Evolution API WhatsApp messages
 *
 * Expected payload from Evolution API:
 * {
 *   instance: "wpp-personal-12345",
 *   data: {
 *     messages: [{
 *       id: "message-id",
 *       from: "5491123456789",
 *       to: "5491198765432",
 *       body: "Mensaje de texto",
 *       timestamp: 1680000000,
 *       media?: { url: "...", type: "image" }
 *     }]
 *   }
 * }
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
      media?: {
        url: string;
        type: string;
      };
    }>;
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as EvolutionWebhookPayload;

    // Validate payload structure
    if (!payload.instance || !payload.data?.messages) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const messages = payload.data.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Find the channel credentials by instance name to get company_id and user_id
    const { data: credentials, error: credError } = await supabase
      .from("channel_credentials")
      .select("company_id, user_id")
      .eq("instance_name", payload.instance)
      .single();

    if (credError || !credentials) {
      console.error("[webhook/whatsapp] Instance not found:", payload.instance);
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    const companyId = credentials.company_id;
    const vendorId = credentials.user_id;

    // Process each message
    for (const message of messages) {
      // Normalize phone number (remove special characters)
      const fromPhone = message.from.replace(/\D/g, "");
      const toPhone = message.to.replace(/\D/g, "");

      // Find or create contact based on sender's phone number
      let contactId: string | null = null;

      // First try to find existing contact
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .eq("phone", fromPhone)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        // Create new contact
        const { data: newContact, error: createError } = await supabase
          .from("contacts")
          .insert({
            company_id: companyId,
            first_name: "WhatsApp",
            last_name: fromPhone,
            phone: fromPhone,
            source: "whatsapp" as const,
            created_by: vendorId,
          })
          .select("id")
          .single();

        if (!createError && newContact) {
          contactId = newContact.id;
        }
      }

      // Create activity record
      if (contactId) {
        const activityTitle = message.body.substring(0, 100);

        await supabase.from("activities").insert({
          company_id: companyId,
          contact_id: contactId,
          user_id: vendorId,
          type: "whatsapp" as const,
          title: activityTitle || "Mensaje de WhatsApp",
          description: message.body,
          source: "automatic" as const,
          created_at: new Date(message.timestamp * 1000).toISOString(),
        });

        console.log(
          `[webhook/whatsapp] Created activity for contact ${contactId}`
        );
      }
    }

    return NextResponse.json({ ok: true, processed: messages.length });
  } catch (error) {
    console.error("[webhook/whatsapp] Error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
