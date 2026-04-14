import "server-only";

import { canEditLeads } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { requireAuth } from "@/lib/workspace-auth";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ContactDetailRecord,
  ContactFilters,
  ContactPageData,
  ContactPagination,
  ContactRecord,
  ContactSearchResult,
} from "@/modules/crm/contacts/types";

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type PipelineRow = Database["public"]["Tables"]["pipelines"]["Row"];
type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];

function fullName(contact: Pick<ContactRow, "first_name" | "last_name">) {
  return `${contact.first_name} ${contact.last_name}`.trim();
}

function normalizeSearch(value: string | null) {
  return value?.trim() || null;
}

export function parseContactsFilters(
  searchParams?: Record<string, string | string[] | undefined>
): ContactFilters & { page: number } {
  const read = (key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] || null : value || null;
  };

  const pageValue = Number(read("page") || "1");

  return {
    query: normalizeSearch(read("q")),
    source: (read("source") || null) as ContactFilters["source"],
    contactId: read("contact"),
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1,
  };
}

async function getAssignees(companyId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id,name")
    .eq("company_id", companyId)
    .eq("role", "vendor")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((user) => ({ id: user.id, name: user.name }));
}

async function getPipelines(companyId: string) {
  const supabase = await createServerSupabaseClient();
  const [pipelinesResult, stagesResult] = await Promise.all([
    supabase
      .from("pipelines")
      .select("id,name")
      .eq("company_id", companyId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("pipeline_stages")
      .select("id,pipeline_id,name,color,position")
      .eq("company_id", companyId)
      .order("position", { ascending: true }),
  ]);

  if (pipelinesResult.error) {
    throw pipelinesResult.error;
  }

  if (stagesResult.error) {
    throw stagesResult.error;
  }

  const stagesByPipeline = new Map<string, Array<{ id: string; name: string; color: string }>>();
  (stagesResult.data || []).forEach((stage) => {
    const bucket = stagesByPipeline.get(stage.pipeline_id) || [];
    bucket.push({ id: stage.id, name: stage.name, color: stage.color });
    stagesByPipeline.set(stage.pipeline_id, bucket);
  });

  return ((pipelinesResult.data || []) as Array<Pick<PipelineRow, "id" | "name">>).map((pipeline) => ({
    id: pipeline.id,
    name: pipeline.name,
    stages: stagesByPipeline.get(pipeline.id) || [],
  }));
}

export async function getContacts(
  companyId: string,
  filters: ContactFilters,
  pagination: ContactPagination,
  user?: { id: string; role: Database["public"]["Enums"]["user_role"] }
): Promise<{ data: ContactRecord[]; total: number }> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("contacts")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize - 1);

  if (filters.source) {
    query = query.eq("source", filters.source);
  }

  if (filters.query) {
    const escaped = filters.query.replaceAll("%", "");
    query = query.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,company_name.ilike.%${escaped}%`
    );
  }

  const { data, count, error } = await query;
  if (error) {
    throw error;
  }

  const rows = (data || []) as ContactRow[];
  const leadCounts = await getActiveLeadCounts(companyId, rows.map((row) => row.id), user);

  return {
    total: count || 0,
    data: rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: fullName(row),
      email: row.email,
      phone: row.phone,
      companyName: row.company_name,
      position: row.position,
      source: row.source,
      createdAt: row.created_at,
      assignedTo: row.assigned_to,
      activeLeadCount: leadCounts.get(row.id) || 0,
    })),
  };
}

async function getActiveLeadCounts(
  companyId: string,
  contactIds: string[],
  user?: { id: string; role: Database["public"]["Enums"]["user_role"] }
) {
  if (contactIds.length === 0) {
    return new Map<string, number>();
  }

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("leads")
    .select("contact_id,status,assigned_to")
    .eq("company_id", companyId)
    .in("contact_id", contactIds)
    .in("status", ["open", "paused"]);

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const counts = new Map<string, number>();
  (data || []).forEach((lead) => {
    counts.set(lead.contact_id, (counts.get(lead.contact_id) || 0) + 1);
  });
  return counts;
}

export async function getContactById(
  companyId: string,
  contactId: string,
  user?: { id: string; role: Database["public"]["Enums"]["user_role"] }
): Promise<ContactDetailRecord | null> {
  const supabase = await createServerSupabaseClient();
  let contactQuery = supabase
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", contactId)
    .limit(1);

  const { data, error } = await contactQuery;
  if (error) {
    throw error;
  }

  const contact = (data?.[0] as ContactRow | undefined) || null;
  if (!contact) {
    return null;
  }

  let leadsQuery = supabase
    .from("leads")
    .select("*")
    .eq("company_id", companyId)
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false });

  const [leadsResult, activitiesResult, stagesResult, usersResult] = await Promise.all([
    leadsQuery,
    supabase
      .from("activities")
      .select("*")
      .eq("company_id", companyId)
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false }),
    supabase.from("pipeline_stages").select("id,name,color").eq("company_id", companyId),
    supabase.from("users").select("id,name").eq("company_id", companyId),
  ]);

  if (leadsResult.error) {
    throw leadsResult.error;
  }
  if (activitiesResult.error) {
    throw activitiesResult.error;
  }
  if (stagesResult.error) {
    throw stagesResult.error;
  }
  if (usersResult.error) {
    throw usersResult.error;
  }

  const stagesById = new Map(
    ((stagesResult.data || []) as Array<Pick<PipelineStageRow, "id" | "name" | "color">>).map(
      (stage) => [stage.id, stage]
    )
  );
  const usersById = new Map(
    ((usersResult.data || []) as Array<Pick<UserRow, "id" | "name">>).map((userRow) => [
      userRow.id,
      userRow,
    ])
  );

  return {
    id: contact.id,
    firstName: contact.first_name,
    lastName: contact.last_name,
    fullName: fullName(contact),
    email: contact.email,
    phone: contact.phone,
    companyName: contact.company_name,
    position: contact.position,
    source: contact.source,
    createdAt: contact.created_at,
    assignedTo: contact.assigned_to,
    leads: ((leadsResult.data || []) as LeadRow[]).map((lead) => ({
      id: lead.id,
      title: lead.title,
      value: lead.value == null ? null : Number(lead.value),
      currency: lead.currency,
      status: lead.status,
      expectedCloseDate: lead.expected_close_date,
      stage: stagesById.get(lead.stage_id)
        ? {
            id: lead.stage_id,
            name: stagesById.get(lead.stage_id)!.name,
            color: stagesById.get(lead.stage_id)!.color,
          }
        : null,
    })),
    activities: ((activitiesResult.data || []) as ActivityRow[]).map((activity) => ({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      source: activity.source,
      createdAt: activity.created_at,
      scheduledAt: activity.scheduled_at,
      completedAt: activity.completed_at,
      user: usersById.get(activity.user_id)
        ? { id: activity.user_id, name: usersById.get(activity.user_id)!.name }
        : null,
    })),
  };
}

export async function searchContacts(
  companyId: string,
  query: string,
  user?: { id: string; role: Database["public"]["Enums"]["user_role"] }
): Promise<ContactSearchResult[]> {
  const supabase = await createServerSupabaseClient();
  let request = supabase
    .from("contacts")
    .select("id,first_name,last_name,email,company_name")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(8);

  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery) {
    const escaped = normalizedQuery.replaceAll("%", "");
    // Search individual fields AND the generated full_name column so
    // "Eduardo Feiman" finds the contact even though name is split across columns.
    request = request.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,company_name.ilike.%${escaped}%`
    );
  }

  const { data, error } = await request;
  if (error) {
    throw error;
  }

  return ((data || []) as Array<
    Pick<ContactRow, "id" | "first_name" | "last_name" | "email" | "company_name">
  >).map((contact) => ({
    id: contact.id,
    fullName: fullName(contact),
    email: contact.email,
    companyName: contact.company_name,
  }));
}

export async function getContactsPageData(params: {
  filters: ContactFilters;
  page: number;
}): Promise<ContactPageData> {
  const { user, company_id } = await requireAuth();
  const pagination = { page: params.page, pageSize: 25 };
  const [contactsResult, selectedContact, assignees, pipelines] = await Promise.all([
    getContacts(company_id, params.filters, pagination, {
      id: user.id,
      role: user.role,
    }),
    params.filters.contactId
      ? getContactById(company_id, params.filters.contactId, {
          id: user.id,
          role: user.role,
        })
      : Promise.resolve(null),
    getAssignees(company_id),
    getPipelines(company_id),
  ]);

  return {
    currentUser: {
      id: user.id,
      role: user.role,
      canCreateContact: canEditLeads(user.role),
      canCreateLead: canEditLeads(user.role),
    },
    contacts: contactsResult.data,
    total: contactsResult.total,
    pagination,
    filters: params.filters,
    selectedContact,
    sources: ["manual", "whatsapp", "gmail", "instagram", "zoom", "meet", "import"],
    assignees,
    leadForm: {
      pipelines,
    },
  };
}

