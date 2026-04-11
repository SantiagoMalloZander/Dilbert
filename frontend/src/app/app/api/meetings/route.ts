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

  // Vendors only see their own meetings, owners see all
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
    .limit(30);

  if (session.user.role === "vendor") {
    query.eq("user_id", session.user.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ meetings: data ?? [] });
}

// PATCH: fill in missing data for a meeting
const patchSchema = z.object({
  activityId: z.string(),
  contact: z
    .object({
      company_name: z.string().optional(),
      position: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  lead: z
    .object({
      value: z.number().optional(),
      probability: z.number().min(0).max(100).optional(),
      expected_close_date: z.string().optional(),
    })
    .optional(),
});

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  const companyId = session.user.companyId;

  const body = await request.json();
  const { activityId, contact, lead } = patchSchema.parse(body);

  // Fetch the activity to get contact_id and lead_id
  const { data: activity } = await supabase
    .from("activities")
    .select("contact_id, lead_id")
    .eq("id", activityId)
    .eq("company_id", companyId)
    .single();

  if (!activity) {
    return NextResponse.json({ error: "Reunión no encontrada." }, { status: 404 });
  }

  // Update contact if provided
  if (contact && activity.contact_id && Object.keys(contact).some((k) => contact[k as keyof typeof contact])) {
    const updates: Record<string, string | number> = {};
    if (contact.company_name) updates.company_name = contact.company_name;
    if (contact.position) updates.position = contact.position;
    if (contact.phone) updates.phone = contact.phone;

    await supabase
      .from("contacts")
      .update(updates)
      .eq("id", activity.contact_id)
      .eq("company_id", companyId);
  }

  // Update lead if provided
  if (lead && activity.lead_id && Object.keys(lead).some((k) => lead[k as keyof typeof lead] !== undefined)) {
    const updates: Record<string, string | number> = {};
    if (lead.value !== undefined) updates.value = lead.value;
    if (lead.probability !== undefined) updates.probability = lead.probability;
    if (lead.expected_close_date) updates.expected_close_date = lead.expected_close_date;

    await supabase
      .from("leads")
      .update(updates)
      .eq("id", activity.lead_id)
      .eq("company_id", companyId);
  }

  return NextResponse.json({ ok: true });
}
