import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

interface FathomAttendee {
  email?: string;
  name?: string;
}

interface FathomWebhookPayload {
  meeting_title?: string;
  meeting_date?: string;
  attendees?: FathomAttendee[];
  summary?: string;
  action_items?: string[];
  transcript_url?: string;
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-fathom-api-key");

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const payload = (await request.json()) as FathomWebhookPayload;

    const supabase = createAdminSupabaseClient();

    // Find vendor by their fathomApiKey stored in credentials JSON
    const { data: credRows, error: credError } = await supabase
      .from("channel_credentials")
      .select("company_id, user_id, credentials")
      .eq("channel", "fathom");

    if (credError || !credRows || credRows.length === 0) {
      return NextResponse.json({ error: "No Fathom integrations found" }, { status: 404 });
    }

    // Match the API key
    const match = credRows.find(
      (row) =>
        row.credentials &&
        typeof row.credentials === "object" &&
        (row.credentials as Record<string, string>).fathomApiKey === apiKey
    );

    if (!match) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const companyId = match.company_id;
    const vendorId = match.user_id;

    // Get vendor email to identify the external participant
    const { data: vendorRow } = await supabase
      .from("users")
      .select("email")
      .eq("id", vendorId)
      .single();

    const vendorEmail = vendorRow?.email?.toLowerCase();

    // Find external attendee (not the vendor)
    const externalAttendee = (payload.attendees || []).find(
      (a) => a.email && a.email.toLowerCase() !== vendorEmail
    );

    // Find or create contact
    let contactId: string | null = null;

    if (externalAttendee?.email) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .eq("email", externalAttendee.email.toLowerCase())
        .maybeSingle();

      if (existing) {
        contactId = existing.id;
      } else {
        const nameParts = (externalAttendee.name || "").trim().split(/\s+/);
        const { data: created } = await supabase
          .from("contacts")
          .insert({
            company_id: companyId,
            created_by: vendorId,
            assigned_to: vendorId,
            first_name: nameParts[0] || "Desconocido",
            last_name: nameParts.slice(1).join(" ") || "",
            email: externalAttendee.email.toLowerCase(),
            source: "whatsapp" as const, // closest available source
            tags: ["fathom-import"],
          })
          .select("id")
          .single();

        if (created) contactId = created.id;
      }
    }

    // Build description
    const parts: string[] = [];
    if (payload.summary) parts.push(payload.summary);
    if (payload.action_items?.length) {
      parts.push("\n**Action items:**\n" + payload.action_items.map((a) => `• ${a}`).join("\n"));
    }
    if (payload.transcript_url) {
      parts.push(`\n[Ver transcripción completa en Fathom](${payload.transcript_url})`);
    }

    // Create activity
    await supabase.from("activities").insert({
      company_id: companyId,
      user_id: vendorId,
      contact_id: contactId,
      type: "meeting" as const,
      source: "automatic" as const,
      title: payload.meeting_title || "Reunión de Google Meet",
      description: parts.join("\n\n") || null,
      completed_at: payload.meeting_date || new Date().toISOString(),
    });

    // Mark integration as connected
    await supabase
      .from("channel_credentials")
      .update({ status: "connected", last_sync_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("user_id", vendorId)
      .eq("channel", "fathom");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[webhook/fathom]", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
