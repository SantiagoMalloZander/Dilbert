import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { generateSmartQuestions } from "@/lib/meeting-questions";
import { getContactContext } from "@/lib/contact-context";

const FATHOM_API = "https://api.fathom.ai/external/v1";
const WEBHOOK_BASE = "https://dilvert.netlify.app/app/api/webhooks/fathom";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

// ─── AI analysis ──────────────────────────────────────────────────────────────
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
  ].filter(Boolean).join("\n");

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
            content: `Sos un asistente de CRM que analiza reuniones de ventas. Devolvé JSON:
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
- other: cualquier otro tipo`,
          },
          { role: "user", content },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    return raw ? JSON.parse(raw) as MeetingAnalysis : null;
  } catch { return null; }
}

// ─── Process a single historical meeting ─────────────────────────────────────
interface FathomMeeting {
  id: number;
  title: string;
  meeting_title?: string | null;
  share_url?: string;
  created_at: string;
  default_summary?: { markdown_formatted?: string | null } | null;
  action_items?: Array<{ description: string }> | null;
  transcript?: Array<{ speaker: { display_name: string }; text: string }> | null;
  calendar_invitees?: Array<{ name?: string | null; email?: string | null; is_external: boolean }> | null;
}

async function processMeeting(
  meeting: FathomMeeting,
  vendorId: string,
  companyId: string,
  vendorEmail: string,
  vendorName: string
) {
  const supabase = createAdminSupabaseClient();
  const marker = `<!-- fathom:${meeting.id} -->`;

  // Dedup: skip if already imported
  const { data: existing } = await supabase
    .from("activities")
    .select("id")
    .eq("user_id", vendorId)
    .eq("company_id", companyId)
    .like("description", `%${marker}%`)
    .maybeSingle();
  if (existing) return "skipped";

  const meetingTitle = meeting.meeting_title || meeting.title || "Reunión";
  const summary = meeting.default_summary?.markdown_formatted ?? "";
  const actionItems = (meeting.action_items ?? []).map((ai) => ai.description).filter(Boolean);
  const transcript = (meeting.transcript ?? [])
    .map((t) => `${t.speaker.display_name}: ${t.text}`).join("\n");
  const shareUrl = meeting.share_url ?? "";

  // Find external attendee
  const externalAttendee = (meeting.calendar_invitees ?? []).find(
    (ci) => ci.is_external && ci.email && ci.email.toLowerCase() !== vendorEmail
  ) ?? null;
  const contactName = externalAttendee?.name ?? "Desconocido";

  // Find or create contact
  let contactId: string | null = null;
  if (externalAttendee?.email) {
    const email = externalAttendee.email.toLowerCase();
    const { data: found } = await supabase
      .from("contacts").select("id")
      .eq("company_id", companyId).eq("email", email).maybeSingle();

    if (found) {
      contactId = found.id;
    } else {
      const parts = contactName.trim().split(/\s+/);
      const { data: created } = await supabase
        .from("contacts").insert({
          company_id: companyId,
          created_by: vendorId,
          assigned_to: vendorId,
          first_name: parts[0] ?? "Desconocido",
          last_name: parts.slice(1).join(" ") ?? "",
          email,
          source: "meet" as const,
          tags: ["fathom"],
        }).select("id").single();
      if (created) contactId = created.id;
    }
  }

  // Fetch cross-channel history for this contact (includes previously processed meetings)
  const contactHistory = contactId
    ? await getContactContext(contactId, companyId)
    : "";

  // AI only if there's content
  const hasContent = !!(summary || transcript || actionItems.length);
  const analysis = hasContent
    ? await analyzeTranscript(meetingTitle, summary, actionItems, transcript, contactName, vendorName, contactHistory)
    : null;

  const meetingType = analysis?.meeting_type ?? "other";

  // Enrich contact
  if (contactId && analysis) {
    const updates: Record<string, string> = {};
    if (analysis.contact_company) updates.company_name = analysis.contact_company;
    if (analysis.contact_position) updates.position = analysis.contact_position;
    if (Object.keys(updates).length) {
      await supabase.from("contacts").update(updates)
        .eq("id", contactId).eq("company_id", companyId);
    }
  }

  // Build description
  const descParts: string[] = [];
  if (analysis?.crm_note) descParts.push(analysis.crm_note);
  else if (summary) descParts.push(summary);
  else descParts.push("Reunión importada desde el historial de Fathom.");

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
  descParts.push(marker);

  // Create lead if potential detected
  let leadId: string | null = null;
  if (analysis?.has_deal_potential && contactId) {
    const { data: pipeline } = await supabase
      .from("pipelines").select("id")
      .eq("company_id", companyId).eq("is_default", true).maybeSingle();

    if (pipeline) {
      const { data: stages } = await supabase
        .from("pipeline_stages").select("id")
        .eq("company_id", companyId).eq("pipeline_id", pipeline.id)
        .eq("is_lost_stage", false).eq("is_won_stage", false)
        .order("position", { ascending: true }).limit(1);

      const firstStage = stages?.[0];
      if (firstStage) {
        const { data: existingLead } = await supabase
          .from("leads").select("id")
          .eq("company_id", companyId).eq("contact_id", contactId)
          .eq("status", "open").maybeSingle();

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
            metadata: { origin: "fathom_ai", client_interest: analysis.client_interest },
          }).select("id").single();
          if (createdLead) leadId = createdLead.id;
        }
      }
    }
  }

  // Fetch enriched contact + lead for question generation
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

  const metadata = {
    meeting_type: meetingType,
    questions,
    enrichment_complete: questions.length === 0,
    origin: "fathom_ai",
    client_interest: analysis?.client_interest,
    key_pain_points: analysis?.key_pain_points ?? [],
  };

  await supabase.from("activities").insert({
    company_id: companyId,
    user_id: vendorId,
    contact_id: contactId,
    lead_id: leadId,
    type: "meeting" as const,
    source: "automatic" as const,
    title: meetingTitle,
    description: descParts.join("\n\n"),
    completed_at: meeting.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: metadata as any,
  });

  return "imported";
}

// ─── Import all historical meetings from Fathom API ──────────────────────────
async function importHistoricalMeetings(
  fathomApiKey: string,
  vendorId: string,
  companyId: string,
  vendorEmail: string,
  vendorName: string
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  let cursor = "";
  const MAX_MEETINGS = 50;
  let total = 0;

  while (total < MAX_MEETINGS) {
    const url = `${FATHOM_API}/meetings${cursor ? `?cursor=${cursor}` : ""}`;
    const res = await fetch(url, { headers: { "X-Api-Key": fathomApiKey } });
    if (!res.ok) break;

    const data = await res.json() as { items: FathomMeeting[]; next_cursor: string };
    if (!data.items?.length) break;

    for (const meeting of data.items) {
      if (total >= MAX_MEETINGS) break;
      const result = await processMeeting(meeting, vendorId, companyId, vendorEmail, vendorName);
      if (result === "imported") imported++;
      else skipped++;
      total++;
    }

    if (!data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return { imported, skipped };
}

// ─── Setup route ─────────────────────────────────────────────────────────────
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

  const supabase = createAdminSupabaseClient();

  // Delete old Fathom webhook if stored
  const { data: existing } = await supabase
    .from("channel_credentials").select("credentials")
    .eq("user_id", userId).eq("channel", "fathom").maybeSingle();

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
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey.trim() },
    body: JSON.stringify({
      destination_url: destinationUrl,
      triggered_for: ["my_recordings"],
      include_transcript: true,
      include_summary: true,
      include_action_items: true,
    }),
  });

  if (!webhookRes.ok) {
    return NextResponse.json(
      { error: "No pude crear el webhook en Fathom. Verificá que la API Key sea correcta." },
      { status: 400 }
    );
  }

  const webhook = await webhookRes.json() as { id: string; secret: string };

  // Save credentials
  await supabase.from("channel_credentials").upsert(
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

  // Load vendor info for import
  const { data: vendorRow } = await supabase
    .from("users").select("email, name")
    .eq("id", userId).single();

  const vendorEmail = vendorRow?.email?.toLowerCase() ?? "";
  const vendorName = vendorRow?.name ?? "Vendedor";

  // Run import (up to 50 meetings, sequential)
  const importResult = await importHistoricalMeetings(
    apiKey.trim(), userId, companyId, vendorEmail, vendorName
  );

  return NextResponse.json({ ok: true, imported: importResult.imported, skipped: importResult.skipped });
}
