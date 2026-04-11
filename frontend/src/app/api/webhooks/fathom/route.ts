import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { generateSmartQuestions } from "@/lib/meeting-questions";
import { getContactContext } from "@/lib/contact-context";
import crypto from "crypto";

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

// ─── Signature verification ───────────────────────────────────────────────────
function verifyFathomSignature(
  secret: string,
  webhookId: string,
  webhookTimestamp: string,
  rawBody: string,
  webhookSignature: string
): boolean {
  try {
    const timestamp = parseInt(webhookTimestamp, 10);
    if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

    const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
    const expected = crypto
      .createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    const signatures = webhookSignature.split(" ").map((s) => {
      const parts = s.split(",");
      return parts.length > 1 ? parts[1] : parts[0];
    });

    return signatures.some((sig) => {
      try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// ─── Fathom payload types ─────────────────────────────────────────────────────
interface FathomTranscriptEntry {
  speaker: { display_name: string; matched_calendar_invitee_email?: string | null };
  text: string;
  timestamp: string;
}

interface FathomActionItem {
  description: string;
  assignee?: { name: string; email: string } | null;
}

interface FathomCalendarInvitee {
  name?: string | null;
  email?: string | null;
  is_external: boolean;
}

interface FathomPayload {
  title: string;
  meeting_title?: string | null;
  share_url?: string;
  created_at: string;
  default_summary?: { markdown_formatted?: string | null };
  action_items?: FathomActionItem[];
  transcript?: FathomTranscriptEntry[];
  calendar_invitees?: FathomCalendarInvitee[];
  recorded_by?: { name: string; email: string };
}

// ─── AI analysis ─────────────────────────────────────────────────────────────
interface MeetingAnalysis {
  meeting_type: "first_contact" | "demo" | "follow_up" | "negotiation" | "closing" | "internal" | "error" | "other";
  contact_company?: string;
  contact_position?: string;
  has_deal_potential: boolean;
  lead_title?: string;
  lead_value?: number;
  lead_probability?: number;
  next_close_estimate?: string;
  client_interest: "high" | "medium" | "low" | "none";
  key_pain_points?: string[];
  objections?: string[];
  next_steps?: string[];
  crm_note: string;
}

async function analyzeTranscript(
  title: string,
  summary: string,
  actionItems: string[],
  transcript: string,
  contactName: string,
  vendorName: string,
  contactHistory: string
): Promise<MeetingAnalysis | null> {
  if (!OPENAI_KEY) return null;

  const content = [
    `Reunión: "${title}"`,
    `Vendedor: ${vendorName}`,
    `Cliente: ${contactName}`,
    contactHistory ? `\n${contactHistory}` : "",
    summary ? `\nResumen de esta reunión:\n${summary}` : "",
    actionItems.length ? `\nAction items de esta reunión:\n${actionItems.map((a) => `• ${a}`).join("\n")}` : "",
    transcript ? `\nTranscripción:\n${transcript.slice(0, 7000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Sos un asistente de CRM que analiza transcripciones de reuniones de ventas.
Analizá la reunión y devolvé un JSON con esta estructura exacta:
{
  "meeting_type": "first_contact|demo|follow_up|negotiation|closing|internal|error|other",
  "contact_company": "empresa del cliente o null",
  "contact_position": "cargo del cliente o null",
  "has_deal_potential": true/false,
  "lead_title": "título del deal o null",
  "lead_value": número en dólares o null,
  "lead_probability": número 0-100 o null,
  "next_close_estimate": "YYYY-MM-DD o null",
  "client_interest": "high|medium|low|none",
  "key_pain_points": [],
  "objections": [],
  "next_steps": [],
  "crm_note": "Resumen ejecutivo en español de máximo 3 oraciones."
}

Tipos de reunión:
- first_contact: primera vez que hablan con este cliente
- demo: demostración de producto o servicio
- follow_up: seguimiento de conversación anterior
- negotiation: discusión de precios o términos
- closing: intento de cerrar la venta
- internal: sin clientes externos (solo equipo)
- error: sin contenido útil, test o accidental
- other: cualquier otro tipo

Respondé SOLO con el JSON.`,
          },
          { role: "user", content },
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

// ─── Webhook handler ──────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("token");

    if (!vendorId) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const rawBody = await request.text();
    const body = JSON.parse(rawBody) as FathomPayload;

    console.log("[webhook/fathom] payload title:", body.title, "recorded_by:", body.recorded_by?.email);

    const supabase = createAdminSupabaseClient();

    // Load vendor
    const { data: vendorRow } = await supabase
      .from("users")
      .select("id, email, name, company_id")
      .eq("id", vendorId)
      .single();

    if (!vendorRow?.company_id) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const companyId = vendorRow.company_id;
    const vendorEmail = vendorRow.email?.toLowerCase() ?? "";
    const vendorName = vendorRow.name ?? "Vendedor";

    // Verify signature if we have the webhook secret stored
    const { data: credRow } = await supabase
      .from("channel_credentials")
      .select("credentials")
      .eq("user_id", vendorId)
      .eq("channel", "fathom")
      .maybeSingle();

    const webhookSecret = (credRow?.credentials as Record<string, string> | null)?.webhookSecret;
    if (webhookSecret) {
      const webhookId = request.headers.get("webhook-id") ?? "";
      const webhookTimestamp = request.headers.get("webhook-timestamp") ?? "";
      const webhookSignature = request.headers.get("webhook-signature") ?? "";

      if (webhookId && webhookTimestamp && webhookSignature) {
        const valid = verifyFathomSignature(webhookSecret, webhookId, webhookTimestamp, rawBody, webhookSignature);
        if (!valid) {
          console.warn("[webhook/fathom] invalid signature for vendor", vendorId);
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
    }

    // Parse meeting fields
    const meetingTitle = body.meeting_title || body.title || "Reunión";
    const meetingDate = body.created_at || new Date().toISOString();
    const summary = body.default_summary?.markdown_formatted ?? "";
    const actionItems = (body.action_items ?? []).map((ai) => ai.description).filter(Boolean);
    const transcript = (body.transcript ?? [])
      .map((t) => `${t.speaker.display_name}: ${t.text}`)
      .join("\n");
    const shareUrl = body.share_url ?? "";

    // Find external attendee from calendar_invitees
    const externalInvitees = (body.calendar_invitees ?? []).filter(
      (ci) => ci.is_external && ci.email && ci.email.toLowerCase() !== vendorEmail
    );
    const externalAttendee = externalInvitees[0] ?? null;
    const contactName = externalAttendee?.name ?? "Desconocido";

    // Find or create contact first (needed for cross-channel history)
    let contactId: string | null = null;
    if (externalAttendee?.email) {
      const email = externalAttendee.email.toLowerCase();
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .eq("email", email)
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
            email,
            source: "meet" as const,
            tags: ["fathom"],
          })
          .select("id")
          .single();
        if (created) contactId = created.id;
      }
    }

    // Fetch cross-channel history, then run AI with full context
    const contactHistory = contactId
      ? await getContactContext(contactId, companyId)
      : "";

    const analysis = await analyzeTranscript(
      meetingTitle,
      summary,
      actionItems,
      transcript,
      contactName,
      vendorName,
      contactHistory
    );
    const meetingType = analysis?.meeting_type ?? "other";

    // Enrich contact with AI data
    if (contactId && analysis) {
      const updates: Record<string, string> = {};
      if (analysis.contact_company) updates.company_name = analysis.contact_company;
      if (analysis.contact_position) updates.position = analysis.contact_position;
      if (Object.keys(updates).length > 0) {
        await supabase.from("contacts").update(updates).eq("id", contactId).eq("company_id", companyId);
      }
    }

    // Build activity description
    const descParts: string[] = [];
    if (analysis?.crm_note) descParts.push(analysis.crm_note);
    else if (summary) descParts.push(summary);

    if (analysis?.client_interest) {
      const label = { high: "Alto 🔥", medium: "Medio", low: "Bajo", none: "Sin interés" }[analysis.client_interest];
      descParts.push(`**Nivel de interés:** ${label}`);
    }
    if (analysis?.key_pain_points?.length)
      descParts.push(`**Problemas del cliente:**\n${analysis.key_pain_points.map((p) => `• ${p}`).join("\n")}`);
    if (analysis?.objections?.length)
      descParts.push(`**Objeciones:**\n${analysis.objections.map((o) => `• ${o}`).join("\n")}`);

    const nextSteps = analysis?.next_steps?.length ? analysis.next_steps : actionItems;
    if (nextSteps.length)
      descParts.push(`**Próximos pasos:**\n${nextSteps.map((s) => `• ${s}`).join("\n")}`);
    if (shareUrl) descParts.push(`[Ver en Fathom](${shareUrl})`);

    // Create lead if AI detected potential
    let leadId: string | null = null;
    if (analysis?.has_deal_potential && contactId) {
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("company_id", companyId)
        .eq("is_default", true)
        .maybeSingle();

      if (pipeline) {
        const { data: stages } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("company_id", companyId)
          .eq("pipeline_id", pipeline.id)
          .eq("is_lost_stage", false)
          .eq("is_won_stage", false)
          .order("position", { ascending: true })
          .limit(1);

        const firstStage = stages?.[0];
        if (firstStage) {
          const { data: existingLead } = await supabase
            .from("leads")
            .select("id")
            .eq("company_id", companyId)
            .eq("contact_id", contactId)
            .eq("status", "open")
            .maybeSingle();

          if (existingLead) {
            leadId = existingLead.id;
          } else {
            const { data: createdLead } = await supabase.from("leads").insert({
              company_id: companyId,
              created_by: vendorId,
              assigned_to: vendorId,
              contact_id: contactId,
              pipeline_id: pipeline.id,
              stage_id: firstStage.id,
              title: analysis.lead_title ?? meetingTitle,
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
            }).select("id").single();
            if (createdLead) leadId = createdLead.id;
          }
        }
      }
    }

    // Fetch enriched contact for question generation
    let contactData: { company_name?: string | null; position?: string | null } | null = null;
    let leadData: { value?: number | null; expected_close_date?: string | null } | null = null;
    if (contactId) {
      const { data } = await supabase.from("contacts").select("company_name, position").eq("id", contactId).single();
      contactData = data;
    }
    if (leadId) {
      const { data } = await supabase.from("leads").select("value, expected_close_date").eq("id", leadId).single();
      leadData = data;
    }

    // Generate smart questions
    const questions = generateSmartQuestions({
      meetingType,
      contactId,
      contact: contactData,
      leadId,
      lead: leadData,
      hasDealPotential: analysis?.has_deal_potential ?? false,
      analysisLeadValue: analysis?.lead_value,
      analysisCloseEstimate: analysis?.next_close_estimate,
    });

    // Build metadata
    const metadata = {
      meeting_type: meetingType,
      questions,
      enrichment_complete: questions.length === 0,
      origin: "fathom_ai",
      client_interest: analysis?.client_interest,
      key_pain_points: analysis?.key_pain_points ?? [],
    };

    // Create activity
    const { data: activity } = await supabase.from("activities").insert({
      company_id: companyId,
      user_id: vendorId,
      contact_id: contactId,
      lead_id: leadId,
      type: "meeting" as const,
      source: "automatic" as const,
      title: meetingTitle,
      description: descParts.join("\n\n") || null,
      completed_at: meetingDate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: metadata as any,
    }).select("id").single();

    console.log("[webhook/fathom] created activity", activity?.id, "meeting_type:", meetingType, "questions:", questions.length);

    // Mark integration as active
    await supabase
      .from("channel_credentials")
      .update({ status: "connected", last_sync_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("user_id", vendorId)
      .eq("channel", "fathom");

    return NextResponse.json({ ok: true, ai_analyzed: Boolean(analysis), meeting_type: meetingType, questions: questions.length });
  } catch (error) {
    console.error("[webhook/fathom]", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
