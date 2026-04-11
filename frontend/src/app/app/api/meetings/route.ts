import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { MeetingMetadata, MeetingQuestion } from "@/lib/meeting-questions";

// GET: list recent meetings with their contact, lead, and metadata
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  const companyId = session.user.companyId;

  const query = supabase
    .from("activities")
    .select(`
      id, title, description, completed_at, created_at, metadata,
      contact_id,
      contacts ( id, first_name, last_name, email, phone, company_name, position ),
      lead_id,
      leads ( id, title, value, currency, probability, expected_close_date, status, stage_id,
        pipeline_stages ( name ) )
    `)
    .eq("company_id", companyId)
    .eq("type", "meeting")
    .eq("source", "automatic")
    .order("completed_at", { ascending: false })
    .limit(50);

  if (session.user.role === "vendor") {
    query.eq("user_id", session.user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meetings: data ?? [] });
}

// PATCH: answer questions / fill in missing data for a meeting
const answerSchema = z.object({
  id: z.string(),     // question id
  field: z.string(),  // field path
  value: z.string(),  // answer value
});

const patchSchema = z.object({
  activityId: z.string(),
  // Direct field patches (legacy support)
  contact: z.object({
    company_name: z.string().optional(),
    position: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  lead: z.object({
    value: z.number().optional(),
    probability: z.number().min(0).max(100).optional(),
    expected_close_date: z.string().optional(),
  }).optional(),
  newContact: z.object({
    first_name: z.string(),
    last_name: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  newLead: z.object({
    title: z.string(),
    value: z.string().optional(),
    expected_close_date: z.string().optional(),
  }).optional(),
  // Smart question answers
  answers: z.array(answerSchema).optional(),
  markComplete: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  const companyId = session.user.companyId;
  const userId = session.user.id;

  const body = await request.json();
  const { activityId, contact, lead, newContact, newLead, answers, markComplete } = patchSchema.parse(body);

  const { data: activity } = await supabase
    .from("activities")
    .select("contact_id, lead_id, metadata")
    .eq("id", activityId)
    .eq("company_id", companyId)
    .single();

  if (!activity) return NextResponse.json({ error: "Reunión no encontrada." }, { status: 404 });

  let contactId = activity.contact_id;
  const existingMeta = (activity.metadata as MeetingMetadata) ?? {};

  // ── 1. Process smart question answers ─────────────────────────────────────
  if (answers?.length) {
    const contactUpdates: Record<string, string> = {};
    const leadUpdates: Record<string, string | number> = {};
    const newContactFromAnswers: { first_name?: string; last_name?: string; email?: string } = {};
    let dealInterestAnswer: string | null = null;
    let closingOutcome: string | null = null;

    for (const answer of answers) {
      if (!answer.value?.trim()) continue;

      if (answer.field === "contact.company_name") contactUpdates.company_name = answer.value;
      else if (answer.field === "contact.position") contactUpdates.position = answer.value;
      else if (answer.field === "contact.phone") contactUpdates.phone = answer.value;
      else if (answer.field === "lead.value") leadUpdates.value = Number(answer.value);
      else if (answer.field === "lead.probability") leadUpdates.probability = Number(answer.value);
      else if (answer.field === "lead.expected_close_date") leadUpdates.expected_close_date = answer.value;
      else if (answer.field === "new_contact.first_name") {
        const parts = answer.value.trim().split(/\s+/);
        newContactFromAnswers.first_name = parts[0];
        newContactFromAnswers.last_name = parts.slice(1).join(" ");
      }
      else if (answer.field === "new_contact.email") newContactFromAnswers.email = answer.value;
      else if (answer.field === "deal_interest") dealInterestAnswer = answer.value;
      else if (answer.field === "closing_outcome") closingOutcome = answer.value;
    }

    // Create new contact from answers
    if (!contactId && newContactFromAnswers.first_name) {
      const { data: created } = await supabase
        .from("contacts")
        .insert({
          company_id: companyId,
          created_by: userId,
          assigned_to: userId,
          first_name: newContactFromAnswers.first_name,
          last_name: newContactFromAnswers.last_name ?? "",
          email: newContactFromAnswers.email ?? null,
          source: "meet" as const,
          tags: ["fathom"],
        })
        .select("id")
        .single();

      if (created) {
        contactId = created.id;
        await supabase
          .from("activities")
          .update({ contact_id: contactId })
          .eq("id", activityId)
          .eq("company_id", companyId);
      }
    }

    // Apply contact field updates
    if (Object.keys(contactUpdates).length && contactId) {
      await supabase.from("contacts").update(contactUpdates)
        .eq("id", contactId).eq("company_id", companyId);
    }

    // Apply lead field updates
    if (Object.keys(leadUpdates).length && activity.lead_id) {
      await supabase.from("leads").update(leadUpdates)
        .eq("id", activity.lead_id).eq("company_id", companyId);
    }

    // Handle "deal_interest" question
    if (dealInterestAnswer?.includes("Sí") && !activity.lead_id && contactId) {
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
          const { data: createdLead } = await supabase.from("leads").insert({
            company_id: companyId,
            created_by: userId,
            assigned_to: userId,
            contact_id: contactId,
            pipeline_id: pipeline.id,
            stage_id: firstStage.id,
            title: existingMeta.meeting_type ? `Deal - ${existingMeta.meeting_type}` : "Nuevo deal",
            probability: 20,
            source: "meet" as const,
            status: "open" as const,
          }).select("id").single();

          if (createdLead) {
            await supabase.from("activities").update({ lead_id: createdLead.id })
              .eq("id", activityId).eq("company_id", companyId);
          }
        }
      }
    }

    // Handle "closing_outcome" question
    if (closingOutcome && activity.lead_id) {
      if (closingOutcome.includes("cerró")) {
        const { data: wonStage } = await supabase.from("pipeline_stages")
          .select("id").eq("company_id", companyId).eq("is_won_stage", true).limit(1).maybeSingle();
        if (wonStage) {
          await supabase.from("leads").update({ status: "won", stage_id: wonStage.id })
            .eq("id", activity.lead_id).eq("company_id", companyId);
        }
      } else if (closingOutcome.includes("no quiso")) {
        const { data: lostStage } = await supabase.from("pipeline_stages")
          .select("id").eq("company_id", companyId).eq("is_lost_stage", true).limit(1).maybeSingle();
        if (lostStage) {
          await supabase.from("leads").update({ status: "lost", stage_id: lostStage.id })
            .eq("id", activity.lead_id).eq("company_id", companyId);
        }
      }
    }

    // Update question answers in metadata
    const updatedQuestions: MeetingQuestion[] = (existingMeta.questions ?? []).map((q) => {
      const answer = answers.find((a) => a.id === q.id);
      return answer ? { ...q, answer: answer.value } : q;
    });

    const allAnswered = updatedQuestions.every((q) => q.answer != null || q.skipped);

    await supabase.from("activities").update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: { ...existingMeta, questions: updatedQuestions, enrichment_complete: markComplete || allAnswered } as any,
    }).eq("id", activityId).eq("company_id", companyId);
  }

  // ── 2. Legacy direct field patches ────────────────────────────────────────

  // Create new contact if none exists (legacy path)
  if (!contactId && newContact?.first_name) {
    const { data: created } = await supabase
      .from("contacts")
      .insert({
        company_id: companyId,
        created_by: userId,
        assigned_to: userId,
        first_name: newContact.first_name,
        last_name: newContact.last_name ?? "",
        email: newContact.email ?? null,
        source: "meet" as const,
        tags: ["fathom"],
      })
      .select("id")
      .single();

    if (created) {
      contactId = created.id;
      await supabase
        .from("activities")
        .update({ contact_id: contactId })
        .eq("id", activityId)
        .eq("company_id", companyId);
    }
  }

  // Update existing contact fields (legacy path)
  if (contact && contactId && Object.values(contact).some(Boolean)) {
    const updates: Record<string, string> = {};
    if (contact.company_name) updates.company_name = contact.company_name;
    if (contact.position) updates.position = contact.position;
    if (contact.phone) updates.phone = contact.phone;
    if (Object.keys(updates).length) {
      await supabase.from("contacts").update(updates)
        .eq("id", contactId).eq("company_id", companyId);
    }
  }

  // Update existing lead fields (legacy path)
  if (lead && activity.lead_id && Object.values(lead).some((v) => v !== undefined)) {
    const updates: Record<string, string | number> = {};
    if (lead.value !== undefined) updates.value = lead.value;
    if (lead.probability !== undefined) updates.probability = lead.probability;
    if (lead.expected_close_date) updates.expected_close_date = lead.expected_close_date;
    if (Object.keys(updates).length) {
      await supabase.from("leads").update(updates)
        .eq("id", activity.lead_id).eq("company_id", companyId);
    }
  }

  // Create a new lead manually if requested (legacy path)
  if (newLead?.title && !activity.lead_id) {
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
      if (firstStage && contactId) {
        const { data: createdLead } = await supabase
          .from("leads")
          .insert({
            company_id: companyId,
            created_by: userId,
            assigned_to: userId,
            contact_id: contactId,
            pipeline_id: pipeline.id,
            stage_id: firstStage.id,
            title: newLead.title,
            value: newLead.value ? Number(newLead.value) : null,
            probability: 20,
            expected_close_date: newLead.expected_close_date || null,
            source: "meet" as const,
            status: "open" as const,
          })
          .select("id")
          .single();

        if (createdLead) {
          await supabase
            .from("activities")
            .update({ lead_id: createdLead.id })
            .eq("id", activityId)
            .eq("company_id", companyId);
        }
      }
    }
  }

  // Mark complete if requested explicitly (without answers)
  if (markComplete && !answers?.length) {
    await supabase.from("activities").update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: { ...existingMeta, enrichment_complete: true } as any,
    }).eq("id", activityId).eq("company_id", companyId);
  }

  return NextResponse.json({ ok: true });
}
