import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

// GET: list recent meetings with their contact and lead data
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
      id, title, description, completed_at, created_at,
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

// PATCH: fill in missing data for a meeting
const patchSchema = z.object({
  activityId: z.string(),
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
  // Create a new contact when none was detected
  newContact: z.object({
    first_name: z.string(),
    last_name: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  // Create a new lead manually
  newLead: z.object({
    title: z.string(),
    value: z.string().optional(),
    expected_close_date: z.string().optional(),
  }).optional(),
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
  const { activityId, contact, lead, newContact, newLead } = patchSchema.parse(body);

  const { data: activity } = await supabase
    .from("activities")
    .select("contact_id, lead_id")
    .eq("id", activityId)
    .eq("company_id", companyId)
    .single();

  if (!activity) return NextResponse.json({ error: "Reunión no encontrada." }, { status: 404 });

  let contactId = activity.contact_id;

  // Create new contact if none exists
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

  // Update existing contact fields
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

  // Update existing lead fields
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

  // Create a new lead manually if requested
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

  return NextResponse.json({ ok: true });
}
