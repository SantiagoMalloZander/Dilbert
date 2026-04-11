import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

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
  transcript?: string;
  transcript_url?: string;
}

// What the AI extracts from the meeting
interface MeetingAnalysis {
  // Contact enrichment
  contact_company?: string;
  contact_position?: string;

  // Lead detection
  has_deal_potential: boolean;
  lead_title?: string;
  lead_value?: number;        // estimated value in USD, null if unknown
  lead_probability?: number;  // 0-100
  next_close_estimate?: string; // ISO date string, null if unknown

  // Meeting insight
  client_interest: "high" | "medium" | "low" | "none";
  key_pain_points?: string[];
  objections?: string[];
  next_steps?: string[];

  // CRM note summary (clean, concise, in Spanish)
  crm_note: string;
}

async function analyzeTranscript(
  meetingTitle: string,
  summary: string,
  actionItems: string[],
  transcript: string,
  contactName: string,
  vendorName: string
): Promise<MeetingAnalysis | null> {
  if (!OPENAI_KEY) return null;

  const content = [
    `Reunión: "${meetingTitle}"`,
    `Vendedor: ${vendorName}`,
    `Cliente: ${contactName}`,
    summary ? `\nResumen de Fathom:\n${summary}` : "",
    actionItems.length ? `\nAction items:\n${actionItems.map((a) => `• ${a}`).join("\n")}` : "",
    transcript ? `\nTranscripción:\n${transcript.slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Sos un asistente de CRM que analiza transcripciones de reuniones de ventas.
Analizá la reunión y devolvé un JSON con esta estructura exacta:
{
  "contact_company": "empresa del cliente (string o null)",
  "contact_position": "cargo del cliente (string o null)",
  "has_deal_potential": true/false,
  "lead_title": "título del deal (string o null, solo si has_deal_potential=true)",
  "lead_value": número en dólares estimado o null,
  "lead_probability": número 0-100 o null,
  "next_close_estimate": "YYYY-MM-DD o null",
  "client_interest": "high|medium|low|none",
  "key_pain_points": ["dolor 1", "dolor 2"] o [],
  "objections": ["objeción 1"] o [],
  "next_steps": ["paso 1", "paso 2"] o [],
  "crm_note": "Resumen ejecutivo en español de máximo 3 oraciones para el CRM. Incluí qué se habló, el nivel de interés y qué sigue."
}
Respondé SOLO con el JSON, sin texto adicional.`,
          },
          {
            role: "user",
            content,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as MeetingAnalysis;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-fathom-api-key");
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const payload = (await request.json()) as FathomWebhookPayload;
    const supabase = createAdminSupabaseClient();

    // 1. Find vendor by fathomApiKey
    const { data: credRows, error: credError } = await supabase
      .from("channel_credentials")
      .select("company_id, user_id, credentials")
      .eq("channel", "fathom");

    if (credError || !credRows?.length) {
      return NextResponse.json({ error: "No Fathom integrations found" }, { status: 404 });
    }

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

    // 2. Get vendor info
    const { data: vendorRow } = await supabase
      .from("users")
      .select("email, name")
      .eq("id", vendorId)
      .single();

    const vendorEmail = vendorRow?.email?.toLowerCase() ?? "";
    const vendorName = vendorRow?.name ?? "Vendedor";

    // 3. Identify external attendee
    const externalAttendee = (payload.attendees ?? []).find(
      (a) => a.email && a.email.toLowerCase() !== vendorEmail
    );
    const contactName = externalAttendee?.name ?? "Desconocido";

    // 4. Run AI analysis in parallel with DB ops (don't block on it)
    const analysisPromise = analyzeTranscript(
      payload.meeting_title ?? "",
      payload.summary ?? "",
      payload.action_items ?? [],
      payload.transcript ?? "",
      contactName,
      vendorName
    );

    // 5. Find or create contact
    let contactId: string | null = null;

    if (externalAttendee?.email) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("company_id", companyId)
        .eq("email", externalAttendee.email.toLowerCase())
        .maybeSingle();

      if (existing) {
        contactId = existing.id;
      } else {
        const parts = contactName.trim().split(/\s+/);
        const { data: created } = await supabase
          .from("contacts")
          .insert({
            company_id: companyId,
            created_by: vendorId,
            assigned_to: vendorId,
            first_name: parts[0] ?? "Desconocido",
            last_name: parts.slice(1).join(" ") ?? "",
            email: externalAttendee.email.toLowerCase(),
            source: "meet" as const,
            tags: ["fathom"],
          })
          .select("id")
          .single();

        if (created) contactId = created.id;
      }
    }

    // 6. Wait for AI analysis
    const analysis = await analysisPromise;

    // 7. Enrich contact with AI-extracted data
    if (contactId && analysis) {
      const updates: Record<string, string> = {};
      if (analysis.contact_company) updates.company_name = analysis.contact_company;
      if (analysis.contact_position) updates.position = analysis.contact_position;
      if (Object.keys(updates).length > 0) {
        await supabase.from("contacts").update(updates).eq("id", contactId).eq("company_id", companyId);
      }
    }

    // 8. Build activity description
    const descParts: string[] = [];

    if (analysis?.crm_note) {
      descParts.push(analysis.crm_note);
    } else if (payload.summary) {
      descParts.push(payload.summary);
    }

    if (analysis?.client_interest) {
      const interestLabel = { high: "Alto 🔥", medium: "Medio", low: "Bajo", none: "Sin interés" }[analysis.client_interest];
      descParts.push(`**Nivel de interés:** ${interestLabel}`);
    }

    if (analysis?.key_pain_points?.length) {
      descParts.push(`**Problemas del cliente:**\n${analysis.key_pain_points.map((p) => `• ${p}`).join("\n")}`);
    }

    if (analysis?.objections?.length) {
      descParts.push(`**Objeciones:**\n${analysis.objections.map((o) => `• ${o}`).join("\n")}`);
    }

    const nextSteps = analysis?.next_steps?.length
      ? analysis.next_steps
      : payload.action_items ?? [];

    if (nextSteps.length) {
      descParts.push(`**Próximos pasos:**\n${nextSteps.map((s) => `• ${s}`).join("\n")}`);
    }

    if (payload.transcript_url) {
      descParts.push(`[Ver transcripción en Fathom](${payload.transcript_url})`);
    }

    // 9. Create meeting activity
    await supabase.from("activities").insert({
      company_id: companyId,
      user_id: vendorId,
      contact_id: contactId,
      type: "meeting" as const,
      source: "automatic" as const,
      title: payload.meeting_title ?? "Reunión de Google Meet",
      description: descParts.join("\n\n") || null,
      completed_at: payload.meeting_date ?? new Date().toISOString(),
    });

    // 10. Create lead if AI detected deal potential
    if (analysis?.has_deal_potential && contactId) {
      // Get default pipeline + first stage
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("company_id", companyId)
        .eq("is_default", true)
        .maybeSingle();

      if (pipeline) {
        const { data: stages } = await supabase
          .from("pipeline_stages")
          .select("id, position")
          .eq("company_id", companyId)
          .eq("pipeline_id", pipeline.id)
          .eq("is_lost_stage", false)
          .eq("is_won_stage", false)
          .order("position", { ascending: true })
          .limit(1);

        const firstStage = stages?.[0];

        if (firstStage) {
          // Check if there's already an open lead for this contact
          const { data: existingLead } = await supabase
            .from("leads")
            .select("id")
            .eq("company_id", companyId)
            .eq("contact_id", contactId)
            .eq("status", "open")
            .maybeSingle();

          if (!existingLead) {
            await supabase.from("leads").insert({
              company_id: companyId,
              created_by: vendorId,
              assigned_to: vendorId,
              contact_id: contactId,
              pipeline_id: pipeline.id,
              stage_id: firstStage.id,
              title: analysis.lead_title ?? payload.meeting_title ?? "Deal detectado por Fathom",
              value: analysis.lead_value ?? null,
              probability: analysis.lead_probability ?? 20,
              expected_close_date: analysis.next_close_estimate ?? null,
              source: "meet" as const,
              status: "open" as const,
              metadata: {
                origin: "fathom_ai",
                client_interest: analysis.client_interest,
                key_pain_points: analysis.key_pain_points ?? [],
              },
            });
          }
        }
      }
    }

    // 11. Mark integration as connected
    await supabase
      .from("channel_credentials")
      .update({ status: "connected", last_sync_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("user_id", vendorId)
      .eq("channel", "fathom");

    return NextResponse.json({ ok: true, ai_analyzed: Boolean(analysis) });
  } catch (error) {
    console.error("[webhook/fathom]", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
