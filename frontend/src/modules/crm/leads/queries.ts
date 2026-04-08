import "server-only";

import { canEditLeads, canManageUsers } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { requireAuth } from "@/lib/workspace-auth";
import type {
  CrmSource,
  DashboardKpiData,
  DashboardKpiMetric,
  LeadAssigneeOption,
  LeadBoardData,
  LeadBoardFilters,
  LeadCardRecord,
  LeadContactSummary,
  LeadDetailRecord,
  LeadNoteItem,
  LeadsBySourceMetric,
  LeadsByStageMetric,
  LeadStageOption,
  LeadTimelineItem,
  PipelineStageRecord,
  SellerPerformanceRecord,
  UpcomingLeadRecord,
} from "@/modules/crm/leads/types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type PipelineRow = Database["public"]["Tables"]["pipelines"]["Row"];
type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];

function normalizeDateStart(value: string | null) {
  return value ? `${value}T00:00:00.000Z` : null;
}

function normalizeDateEnd(value: string | null) {
  return value ? `${value}T23:59:59.999Z` : null;
}

function parseNumericValue(value: number | null) {
  return value == null ? null : Number(value);
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getSourceLabel(source: CrmSource) {
  switch (source) {
    case "whatsapp":
      return "WhatsApp";
    case "gmail":
      return "Gmail";
    case "instagram":
      return "Instagram";
    case "zoom":
      return "Zoom";
    case "meet":
      return "Meet";
    case "import":
      return "Importado";
    default:
      return "Manual";
  }
}

function getContactName(contact?: ContactRow | null) {
  if (!contact) {
    return "Sin contacto";
  }

  return `${contact.first_name} ${contact.last_name}`.trim();
}

function buildContactSummary(contact?: ContactRow | null): LeadContactSummary {
  return {
    id: contact?.id || "",
    name: getContactName(contact),
    companyName: contact?.company_name || null,
    email: contact?.email || null,
    phone: contact?.phone || null,
  };
}

function buildAssignee(user?: UserRow | null): LeadAssigneeOption | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatar_url || null,
  };
}

function buildStageOption(stage: PipelineStageRow): LeadStageOption {
  return {
    id: stage.id,
    name: stage.name,
    color: stage.color,
    isWonStage: stage.is_won_stage,
    isLostStage: stage.is_lost_stage,
  };
}

function buildLeadCard(
  lead: LeadRow,
  contactsById: Map<string, ContactRow>,
  usersById: Map<string, UserRow>
): LeadCardRecord {
  return {
    id: lead.id,
    title: lead.title,
    value: parseNumericValue(lead.value),
    currency: lead.currency,
    source: lead.source,
    status: lead.status,
    expectedCloseDate: lead.expected_close_date,
    probability: lead.probability,
    createdAt: lead.created_at,
    stageId: lead.stage_id,
    contact: buildContactSummary(contactsById.get(lead.contact_id)),
    assignedUser: buildAssignee(usersById.get(lead.assigned_to)),
  };
}

async function getActivePipeline(companyId: string, pipelineId?: string | null) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("pipelines")
    .select("*")
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (pipelineId) {
    query = supabase.from("pipelines").select("*").eq("company_id", companyId).eq("id", pipelineId).limit(1);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const pipeline = (data?.[0] as PipelineRow | undefined) || null;
  if (!pipeline) {
    throw new Error("NO_PIPELINE");
  }

  return pipeline;
}

async function getPipelineStages(companyId: string, pipelineId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("company_id", companyId)
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as PipelineStageRow[];
}

async function getAssignees(companyId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id,name,avatar_url,role")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("role", "vendor")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((user) => ({
    id: user.id,
    name: user.name,
    avatarUrl: user.avatar_url || null,
  })) satisfies LeadAssigneeOption[];
}

async function getLeadsForBoard(params: {
  companyId: string;
  pipelineId: string;
  userId: string;
  role: Database["public"]["Enums"]["user_role"];
  filters: LeadBoardFilters;
}) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("leads")
    .select("*")
    .eq("company_id", params.companyId)
    .eq("pipeline_id", params.pipelineId)
    .order("updated_at", { ascending: false });

  if (params.role === "vendor") {
    query = query.eq("assigned_to", params.userId);
  } else if (params.filters.assignedTo) {
    query = query.eq("assigned_to", params.filters.assignedTo);
  }

  if (params.filters.source) {
    query = query.eq("source", params.filters.source);
  }

  if (params.filters.createdFrom) {
    query = query.gte("created_at", normalizeDateStart(params.filters.createdFrom)!);
  }

  if (params.filters.createdTo) {
    query = query.lte("created_at", normalizeDateEnd(params.filters.createdTo)!);
  }

  if (params.filters.stageId) {
    query = query.eq("stage_id", params.filters.stageId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []) as LeadRow[];
}

async function getContactsMap(companyId: string, contactIds: string[]) {
  if (contactIds.length === 0) {
    return new Map<string, ContactRow>();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .in("id", contactIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((contact) => [contact.id, contact as ContactRow]));
}

async function getUsersMap(companyId: string, userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, UserRow>();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("company_id", companyId)
    .in("id", userIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((user) => [user.id, user as UserRow]));
}

async function getLeadActivities(companyId: string, leadId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("company_id", companyId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as ActivityRow[];
}

async function getLeadNotes(companyId: string, leadId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("company_id", companyId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as NoteRow[];
}

function buildTimelineItems(
  activities: ActivityRow[],
  usersById: Map<string, UserRow>
): LeadTimelineItem[] {
  return activities.map((activity) => ({
    id: activity.id,
    type: activity.type,
    title: activity.title,
    description: activity.description,
    scheduledAt: activity.scheduled_at,
    completedAt: activity.completed_at,
    createdAt: activity.created_at,
    source: activity.source,
    user: usersById.get(activity.user_id)
      ? {
          id: activity.user_id,
          name: usersById.get(activity.user_id)!.name,
        }
      : null,
  }));
}

function buildNoteItems(notes: NoteRow[], usersById: Map<string, UserRow>): LeadNoteItem[] {
  return notes.map((note) => ({
    id: note.id,
    content: note.content,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    source: note.source,
    user: usersById.get(note.user_id)
      ? {
          id: note.user_id,
          name: usersById.get(note.user_id)!.name,
        }
      : null,
  }));
}

async function getLeadDetail(params: {
  leadId: string;
  companyId: string;
  userId: string;
  role: Database["public"]["Enums"]["user_role"];
  stageOptions: LeadStageOption[];
}) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("leads")
    .select("*")
    .eq("company_id", params.companyId)
    .eq("id", params.leadId)
    .limit(1);

  if (params.role === "vendor") {
    query = query.eq("assigned_to", params.userId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const lead = (data?.[0] as LeadRow | undefined) || null;
  if (!lead) {
    return null;
  }

  const [contactsById, usersById, activities, notes] = await Promise.all([
    getContactsMap(params.companyId, [lead.contact_id]),
    getUsersMap(params.companyId, [lead.assigned_to, lead.created_by]),
    getLeadActivities(params.companyId, lead.id),
    getLeadNotes(params.companyId, lead.id),
  ]);

  const actorIds = [
    ...new Set([
      ...activities.map((activity) => activity.user_id),
      ...notes.map((note) => note.user_id),
      lead.assigned_to,
      lead.created_by,
    ]),
  ];
  const activityUsersById = await getUsersMap(params.companyId, actorIds);

  return {
    id: lead.id,
    title: lead.title,
    value: parseNumericValue(lead.value),
    currency: lead.currency,
    pipelineId: lead.pipeline_id,
    probability: lead.probability,
    expectedCloseDate: lead.expected_close_date,
    status: lead.status,
    lostReason: lead.lost_reason,
    source: lead.source,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    metadata: lead.metadata,
    contact: buildContactSummary(contactsById.get(lead.contact_id)),
    assignedUser: buildAssignee(usersById.get(lead.assigned_to)),
    stage: params.stageOptions.find((stage) => stage.id === lead.stage_id) || null,
    stageOptions: params.stageOptions,
    timeline: buildTimelineItems(activities, activityUsersById),
    notes: buildNoteItems(notes, activityUsersById),
    permissions: {
      canEdit:
        canEditLeads(params.role) &&
        (params.role !== "vendor" || lead.assigned_to === params.userId),
      canMarkOutcome:
        canEditLeads(params.role) &&
        (params.role !== "vendor" || lead.assigned_to === params.userId),
    },
  } satisfies LeadDetailRecord;
}

export function parseLeadBoardFilters(
  searchParams?: Record<string, string | string[] | undefined>
): LeadBoardFilters {
  const read = (key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] || null : value || null;
  };

  const source = read("source");

  return {
    assignedTo: read("assignedTo"),
    source: source as CrmSource | null,
    createdFrom: read("createdFrom"),
    createdTo: read("createdTo"),
    stageId: read("stage"),
    leadId: read("lead"),
  };
}

export async function getLeadBoardData(filters: LeadBoardFilters): Promise<LeadBoardData> {
  const { user, company_id } = await requireAuth();
  const pipeline = await getActivePipeline(company_id);
  const supabase = await createServerSupabaseClient();

  const [stages, assignees, leads, pipelinesResult] = await Promise.all([
    getPipelineStages(company_id, pipeline.id),
    getAssignees(company_id),
    getLeadsForBoard({
      companyId: company_id,
      pipelineId: pipeline.id,
      userId: user.id,
      role: user.role,
      filters,
    }),
    supabase.from("pipelines").select("id, name, pipeline_stages(id, name)").eq("company_id", company_id),
  ]);

  const contactsById = await getContactsMap(
    company_id,
    [...new Set(leads.map((lead) => lead.contact_id))]
  );
  const usersById = await getUsersMap(
    company_id,
    [...new Set(leads.map((lead) => lead.assigned_to))]
  );

  const cardsByStage = new Map<string, LeadCardRecord[]>();
  leads.forEach((lead) => {
    const bucket = cardsByStage.get(lead.stage_id) || [];
    bucket.push(buildLeadCard(lead, contactsById, usersById));
    cardsByStage.set(lead.stage_id, bucket);
  });

  const stageOptions = stages.map(buildStageOption);
  const selectedLead =
    filters.leadId && stages.length > 0
      ? await getLeadDetail({
          leadId: filters.leadId,
          companyId: company_id,
          userId: user.id,
          role: user.role,
          stageOptions,
        })
      : null;

  const pipelines = (pipelinesResult.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    stages: (p.pipeline_stages || []).map((s: any) => ({ id: s.id, name: s.name })),
  }));

  return {
    currentUser: {
      id: user.id,
      role: user.role,
      canManageAssigneeFilter: canManageUsers(user.role) || user.role === "analyst",
    },
    companyId: company_id,
    pipeline: {
      id: pipeline.id,
      name: pipeline.name,
    },
    filters,
    assignees,
    sources: ["manual", "whatsapp", "gmail", "instagram", "zoom", "meet", "import"],
    selectedLead,
    leadForm: {
      pipelines,
      canCreate: user.role !== "vendor",
    },
    stages: stages.map((stage) => {
      const cards = cardsByStage.get(stage.id) || [];

      return {
        id: stage.id,
        pipelineId: stage.pipeline_id,
        name: stage.name,
        color: stage.color,
        position: stage.position,
        isWonStage: stage.is_won_stage,
        isLostStage: stage.is_lost_stage,
        cards,
        leadCount: cards.length,
        totalValue: cards.reduce((sum, card) => sum + (card.value || 0), 0),
      } satisfies PipelineStageRecord;
    }),
  };
}

export async function getDashboardKpis(): Promise<DashboardKpiData> {
  const { user, company_id } = await requireAuth();
  const supabase = await createServerSupabaseClient();
  const month = getCurrentMonthRange();

  const scopedBase = () => {
    let query = supabase.from("leads").select("*").eq("company_id", company_id);

    if (user.role === "vendor") {
      query = query.eq("assigned_to", user.id);
    }

    return query;
  };

  const teamBase = () => supabase.from("leads").select("*").eq("company_id", company_id);

  const [openResult, wonMonthResult, monthTotalResult, pipelineValueResult, teamOpenResult, teamWonMonthResult, teamMonthTotalResult, teamPipelineValueResult] =
    await Promise.all([
      scopedBase().eq("status", "open"),
      scopedBase().eq("status", "won").gte("updated_at", month.start).lte("updated_at", month.end),
      scopedBase().gte("created_at", month.start).lte("created_at", month.end),
      scopedBase().in("status", ["open", "paused"]),
      user.role === "vendor" ? teamBase().eq("status", "open") : Promise.resolve({ data: null, error: null }),
      user.role === "vendor"
        ? teamBase().eq("status", "won").gte("updated_at", month.start).lte("updated_at", month.end)
        : Promise.resolve({ data: null, error: null }),
      user.role === "vendor"
        ? teamBase().gte("created_at", month.start).lte("created_at", month.end)
        : Promise.resolve({ data: null, error: null }),
      user.role === "vendor"
        ? teamBase().in("status", ["open", "paused"])
        : Promise.resolve({ data: null, error: null }),
    ]);

  [
    openResult,
    wonMonthResult,
    monthTotalResult,
    pipelineValueResult,
    teamOpenResult,
    teamWonMonthResult,
    teamMonthTotalResult,
    teamPipelineValueResult,
  ].forEach((result) => {
    if (result.error) {
      throw result.error;
    }
  });

  const openCount = openResult.data?.length || 0;
  const wonMonthCount = wonMonthResult.data?.length || 0;
  const monthTotalCount = monthTotalResult.data?.length || 0;
  const conversionRate = monthTotalCount > 0 ? (wonMonthCount / monthTotalCount) * 100 : 0;
  const pipelineValue = (pipelineValueResult.data || []).reduce(
    (sum, lead) => sum + (parseNumericValue(lead.value) || 0),
    0
  );

  const teamOpenCount = teamOpenResult.data?.length || 0;
  const teamWonMonthCount = teamWonMonthResult.data?.length || 0;
  const teamMonthTotalCount = teamMonthTotalResult.data?.length || 0;
  const teamConversionRate =
    teamMonthTotalCount > 0 ? (teamWonMonthCount / teamMonthTotalCount) * 100 : 0;
  const teamPipelineValue = (teamPipelineValueResult.data || []).reduce(
    (sum, lead) => sum + (parseNumericValue(lead.value) || 0),
    0
  );

  const benchmark = (formattedValue: string, label = "Equipo") =>
    user.role === "vendor" ? { label, formattedValue } : null;

  const metrics: DashboardKpiMetric[] = [
    {
      label: user.role === "vendor" ? "Mis leads abiertos" : "Leads totales abiertos",
      value: openCount,
      formattedValue: formatNumber(openCount),
      description: user.role === "vendor" ? "Oportunidades activas asignadas a vos." : "Total de leads abiertos del pipeline.",
      benchmark: benchmark(formatNumber(teamOpenCount)),
    },
    {
      label: "Ganados este mes",
      value: wonMonthCount,
      formattedValue: formatNumber(wonMonthCount),
      description: "Leads cerrados como ganados durante el mes actual.",
      benchmark: benchmark(formatNumber(teamWonMonthCount)),
    },
    {
      label: "Tasa de conversión del mes",
      value: conversionRate,
      formattedValue: formatPercent(conversionRate),
      description: "Won / leads creados en el mes actual.",
      benchmark: benchmark(formatPercent(teamConversionRate)),
    },
    {
      label: "Valor total del pipeline",
      value: pipelineValue,
      formattedValue: formatCurrency(pipelineValue),
      description: "Suma de oportunidades abiertas y pausadas.",
      benchmark: benchmark(formatCurrency(teamPipelineValue)),
    },
  ];

  return {
    role: user.role,
    metrics,
  };
}

export async function getLeadsByStageMetrics(): Promise<LeadsByStageMetric[]> {
  const { user, company_id } = await requireAuth();
  const pipeline = await getActivePipeline(company_id);
  const [stages, leadsResult] = await Promise.all([
    getPipelineStages(company_id, pipeline.id),
    (async () => {
      const supabase = await createServerSupabaseClient();
      let query = supabase
        .from("leads")
        .select("stage_id")
        .eq("company_id", company_id)
        .eq("pipeline_id", pipeline.id);

      if (user.role === "vendor") {
        query = query.eq("assigned_to", user.id);
      }

      return query;
    })(),
  ]);

  if (leadsResult.error) {
    throw leadsResult.error;
  }

  const counts = new Map<string, number>();
  (leadsResult.data || []).forEach((lead) => {
    counts.set(lead.stage_id, (counts.get(lead.stage_id) || 0) + 1);
  });

  return stages.map((stage) => ({
    stageId: stage.id,
    name: stage.name,
    color: stage.color,
    count: counts.get(stage.id) || 0,
  }));
}

export async function getLeadsBySourceMetrics(): Promise<LeadsBySourceMetric[]> {
  const { user, company_id } = await requireAuth();
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("leads").select("source").eq("company_id", company_id);

  if (user.role === "vendor") {
    query = query.eq("assigned_to", user.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const counts = new Map<CrmSource, number>();
  (data || []).forEach((lead) => {
    counts.set(lead.source, (counts.get(lead.source) || 0) + 1);
  });

  const sources: CrmSource[] = [
    "manual",
    "whatsapp",
    "gmail",
    "instagram",
    "zoom",
    "meet",
    "import",
  ];

  return sources.map((source) => ({
    source,
    label: getSourceLabel(source),
    count: counts.get(source) || 0,
    value: counts.get(source) || 0,
  }));
}

export async function getUpcomingClosingLeads(): Promise<UpcomingLeadRecord[]> {
  const { user, company_id } = await requireAuth();
  const supabase = await createServerSupabaseClient();
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 7);

  let query = supabase
    .from("leads")
    .select("*")
    .eq("company_id", company_id)
    .in("status", ["open", "paused"])
    .not("expected_close_date", "is", null)
    .lte("expected_close_date", end.toISOString().slice(0, 10))
    .order("expected_close_date", { ascending: true })
    .limit(8);

  if (user.role === "vendor") {
    query = query.eq("assigned_to", user.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const leads = (data || []) as LeadRow[];
  const [contactsById, stagesById] = await Promise.all([
    getContactsMap(company_id, [...new Set(leads.map((lead) => lead.contact_id))]),
    (async () => {
      const supabase = await createServerSupabaseClient();
      const { data: stages, error: stagesError } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("company_id", company_id);

      if (stagesError) {
        throw stagesError;
      }

      return new Map(stages.map((stage) => [stage.id, stage]));
    })(),
  ]);

  return leads.map((lead) => {
    const closeDate = new Date(lead.expected_close_date!);
    const diffInDays = Math.ceil(
      (closeDate.getTime() - new Date(today.toISOString().slice(0, 10)).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      id: lead.id,
      title: lead.title,
      contactName: getContactName(contactsById.get(lead.contact_id)),
      expectedCloseDate: lead.expected_close_date!,
      daysUntilClose: diffInDays,
      value: parseNumericValue(lead.value),
      currency: lead.currency,
      stageName: stagesById.get(lead.stage_id)?.name || null,
      status: lead.status,
    };
  });
}

export async function getSellerPerformance(): Promise<SellerPerformanceRecord[]> {
  const { user, company_id } = await requireAuth();
  if (user.role === "vendor") {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const month = getCurrentMonthRange();

  const [vendorsResult, leadsResult] = await Promise.all([
    supabase
      .from("users")
      .select("id,name")
      .eq("company_id", company_id)
      .eq("role", "vendor")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("leads").select("assigned_to,status,value,updated_at").eq("company_id", company_id),
  ]);

  if (vendorsResult.error) {
    throw vendorsResult.error;
  }
  if (leadsResult.error) {
    throw leadsResult.error;
  }

  const leads = leadsResult.data || [];

  return (vendorsResult.data || []).map((vendor) => {
    const vendorLeads = leads.filter((lead) => lead.assigned_to === vendor.id);
    const activeLeads = vendorLeads.filter((lead) => lead.status === "open" || lead.status === "paused").length;
    const wonThisMonthLeads = vendorLeads.filter(
      (lead) => lead.status === "won" && lead.updated_at >= month.start && lead.updated_at <= month.end
    );

    return {
      userId: vendor.id,
      name: vendor.name,
      activeLeads,
      wonThisMonth: wonThisMonthLeads.length,
      closedValueThisMonth: wonThisMonthLeads.reduce(
        (sum, lead) => sum + (parseNumericValue(lead.value) || 0),
        0
      ),
    };
  });
}
