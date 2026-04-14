"use server";

import { revalidatePath } from "next/cache";
import { canEditLeads } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { requireAuth } from "@/lib/workspace-auth";
import type { Database, Json } from "@/lib/supabase/database.types";
import type {
  AddLeadActivityInput,
  AddLeadNoteInput,
  CreateLeadInput,
  LeadMutationRecord,
  LeadStatus,
  Result,
  UpdateLeadInput,
} from "@/modules/crm/leads/types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

async function getMutationContext() {
  const { user, company_id } = await requireAuth();

  if (!canEditLeads(user.role)) {
    throw new Error("FORBIDDEN");
  }

  const supabase = await createServerSupabaseClient();
  return { user, company_id, supabase };
}

async function insertLeadAudit(params: {
  companyId: string;
  userId: string;
  action: string;
  entityId: string;
  before: unknown;
  after: unknown;
}) {
  const admin = createAdminSupabaseClient();
  await admin.from("audit_log").insert({
    company_id: params.companyId,
    user_id: params.userId,
    action: params.action,
    entity_type: "lead",
    entity_id: params.entityId,
    changes: {
      before: params.before,
      after: params.after,
    } as Json,
  });
}

async function getLeadForMutation(leadId: string) {
  const { user, company_id, supabase } = await getMutationContext();
  let query = supabase
    .from("leads")
    .select("*")
    .eq("company_id", company_id)
    .eq("id", leadId)
    .limit(1);

  if (user.role === "vendor") {
    query = query.eq("assigned_to", user.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const lead = (data?.[0] as LeadRow | undefined) || null;
  if (!lead) {
    throw new Error("LEAD_NOT_FOUND");
  }

  return {
    lead,
    user,
    company_id,
    supabase,
  };
}

async function ensureLeadDependencies(params: {
  companyId: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  assignedTo: string;
}) {
  const supabase = await createServerSupabaseClient();
  const [contactResult, stageResult, assigneeResult] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,assigned_to")
      .eq("company_id", params.companyId)
      .eq("id", params.contactId)
      .limit(1),
    supabase
      .from("pipeline_stages")
      .select("id,pipeline_id,is_won_stage,is_lost_stage")
      .eq("company_id", params.companyId)
      .eq("pipeline_id", params.pipelineId)
      .eq("id", params.stageId)
      .limit(1),
    supabase
      .from("users")
      .select("id,role,is_active")
      .eq("company_id", params.companyId)
      .eq("id", params.assignedTo)
      .limit(1),
  ]);

  if (contactResult.error) {
    throw contactResult.error;
  }
  if (stageResult.error) {
    throw stageResult.error;
  }
  if (assigneeResult.error) {
    throw assigneeResult.error;
  }

  const contact = contactResult.data?.[0] || null;
  const stage = stageResult.data?.[0] || null;
  const assignee = assigneeResult.data?.[0] || null;

  if (!contact) {
    throw new Error("CONTACT_NOT_FOUND");
  }
  if (!stage) {
    throw new Error("STAGE_NOT_FOUND");
  }
  if (!assignee?.is_active) {
    throw new Error("ASSIGNEE_NOT_FOUND");
  }

  return {
    contact,
    stage,
    assignee,
  };
}

async function resolveStageOutcome(params: {
  companyId: string;
  pipelineId: string;
  stageId: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id,is_won_stage,is_lost_stage")
    .eq("company_id", params.companyId)
    .eq("pipeline_id", params.pipelineId)
    .eq("id", params.stageId)
    .limit(1);

  if (error) {
    throw error;
  }

  const stage = data?.[0] || null;
  if (!stage) {
    throw new Error("STAGE_NOT_FOUND");
  }

  if (stage.is_won_stage) {
    return "won" as LeadStatus;
  }

  if (stage.is_lost_stage) {
    return "lost" as LeadStatus;
  }

  return "open" as LeadStatus;
}

async function resolveOutcomeStage(params: {
  companyId: string;
  pipelineId: string;
  status: "won" | "lost";
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("pipeline_id", params.pipelineId)
    .eq(params.status === "won" ? "is_won_stage" : "is_lost_stage", true)
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0]?.id || null;
}

function revalidateLeadViews() {
  revalidatePath("/app/crm");
  revalidatePath("/app/crm/leads");
  revalidatePath("/app/crm/contacts");
}

function buildLeadMutationRecord(lead: Pick<LeadRow, "id" | "stage_id" | "status">): LeadMutationRecord {
  return {
    id: lead.id,
    stageId: lead.stage_id,
    status: lead.status,
  };
}

export async function createLead(input: CreateLeadInput): Promise<Result<LeadMutationRecord>> {
  try {
    const { user, company_id, supabase } = await getMutationContext();
    const assignedTo = user.role === "owner" ? input.assignedTo || user.id : user.id;
    await ensureLeadDependencies({
      companyId: company_id,
      contactId: input.contactId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      assignedTo,
    });

    const initialStatus = await resolveStageOutcome({
      companyId: company_id,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
    });

    const { data, error } = await supabase
      .from("leads")
      .insert({
        company_id,
        contact_id: input.contactId,
        assigned_to: assignedTo,
        pipeline_id: input.pipelineId,
        stage_id: input.stageId,
        title: input.title.trim(),
        value: input.value,
        currency: input.currency || "ARS",
        probability: input.probability,
        expected_close_date: input.expectedCloseDate,
        status: initialStatus,
        source: input.source,
        created_by: user.id,
      })
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    const lead = data?.[0];
    if (!lead) {
      throw new Error("NO_PUDIMOS_CREAR_EL_LEAD");
    }

    const { error: activityError } = await supabase.from("activities").insert({
      company_id,
      lead_id: lead.id,
      contact_id: input.contactId,
      user_id: user.id,
      type: "note",
      title: "Lead creado",
      description: "Lead creado manualmente desde el CRM.",
      source: "manual",
    });

    if (activityError) {
      throw activityError;
    }

    await insertLeadAudit({
      companyId: company_id,
      userId: user.id,
      action: "lead.created",
      entityId: lead.id,
      before: null,
      after: lead,
    });

    revalidateLeadViews();

    return {
      data: buildLeadMutationRecord(lead),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_CREAR_EL_LEAD",
    };
  }
}

export async function updateLead(
  inputOrId: UpdateLeadInput | string,
  maybePayload?: Omit<UpdateLeadInput, "leadId">
): Promise<Result<LeadMutationRecord>> {
  try {
    const payload =
      typeof inputOrId === "string"
        ? ({ ...maybePayload, leadId: inputOrId } as UpdateLeadInput)
        : inputOrId;

    const { lead, user, company_id, supabase } = await getLeadForMutation(payload.leadId);
    const assignedTo = user.role === "owner" ? payload.assignedTo || lead.assigned_to : user.id;
    await ensureLeadDependencies({
      companyId: company_id,
      contactId: payload.contactId,
      pipelineId: payload.pipelineId,
      stageId: payload.stageId,
      assignedTo,
    });

    const status = await resolveStageOutcome({
      companyId: company_id,
      pipelineId: payload.pipelineId,
      stageId: payload.stageId,
    });

    const { data, error } = await supabase
      .from("leads")
      .update({
        title: payload.title.trim(),
        contact_id: payload.contactId,
        value: payload.value,
        currency: payload.currency || "ARS",
        probability: payload.probability,
        expected_close_date: payload.expectedCloseDate,
        pipeline_id: payload.pipelineId,
        stage_id: payload.stageId,
        assigned_to: assignedTo,
        source: payload.source,
        status,
        lost_reason: status === "lost" ? lead.lost_reason : null,
      })
      .eq("company_id", company_id)
      .eq("id", lead.id)
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    const updated = data?.[0];
    if (!updated) {
      throw new Error("NO_PUDIMOS_ACTUALIZAR_EL_LEAD");
    }

    await insertLeadAudit({
      companyId: company_id,
      userId: user.id,
      action: "lead.updated",
      entityId: updated.id,
      before: lead,
      after: updated,
    });

    revalidateLeadViews();

    return {
      data: buildLeadMutationRecord(updated),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_ACTUALIZAR_EL_LEAD",
    };
  }
}

export async function moveLead(
  leadId: string,
  newStageId: string
): Promise<Result<LeadMutationRecord>> {
  try {
    const { lead, user, company_id, supabase } = await getLeadForMutation(leadId);
    const nextStatus = await resolveStageOutcome({
      companyId: company_id,
      pipelineId: lead.pipeline_id,
      stageId: newStageId,
    });

    const { data, error } = await supabase
      .from("leads")
      .update({
        stage_id: newStageId,
        status: nextStatus,
        lost_reason: nextStatus === "lost" ? lead.lost_reason : null,
      })
      .eq("company_id", company_id)
      .eq("id", leadId)
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    const updated = data?.[0];
    if (!updated) {
      throw new Error("NO_PUDIMOS_MOVER_EL_LEAD");
    }

    await insertLeadAudit({
      companyId: company_id,
      userId: user.id,
      action: "lead.moved",
      entityId: updated.id,
      before: lead,
      after: updated,
    });

    revalidateLeadViews();

    return {
      data: buildLeadMutationRecord(updated),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_MOVER_EL_LEAD",
    };
  }
}

export async function closeLead(
  leadId: string,
  status: "won" | "lost",
  lostReason?: string
): Promise<Result<LeadMutationRecord>> {
  try {
    const { lead, user, company_id, supabase } = await getLeadForMutation(leadId);
    const nextStageId =
      (await resolveOutcomeStage({
        companyId: company_id,
        pipelineId: lead.pipeline_id,
        status,
      })) || lead.stage_id;

    if (status === "lost" && !lostReason?.trim()) {
      throw new Error("La razon de perdida es obligatoria.");
    }

    const { data, error } = await supabase
      .from("leads")
      .update({
        status,
        stage_id: nextStageId,
        lost_reason: status === "lost" ? lostReason!.trim() : null,
      })
      .eq("company_id", company_id)
      .eq("id", leadId)
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    const updated = data?.[0];
    if (!updated) {
      throw new Error("NO_PUDIMOS_CERRAR_EL_LEAD");
    }

    await insertLeadAudit({
      companyId: company_id,
      userId: user.id,
      action: `lead.${status}`,
      entityId: updated.id,
      before: lead,
      after: updated,
    });

    revalidateLeadViews();

    return {
      data: buildLeadMutationRecord(updated),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_CERRAR_EL_LEAD",
    };
  }
}

export async function moveLeadToStage(input: {
  leadId: string;
  stageId: string;
}): Promise<Result<LeadMutationRecord>> {
  return moveLead(input.leadId, input.stageId);
}

export async function addLeadNote(input: AddLeadNoteInput): Promise<Result<{ id: string }>> {
  try {
    const { lead, user, company_id, supabase } = await getLeadForMutation(input.leadId);
    const content = input.content.trim();

    if (!content) {
      throw new Error("La nota no puede estar vacia.");
    }

    const { data, error } = await supabase
      .from("notes")
      .insert({
        company_id,
        lead_id: lead.id,
        user_id: user.id,
        content,
        source: "manual",
      })
      .select("id")
      .limit(1);

    if (error) {
      throw error;
    }

    revalidateLeadViews();

    return {
      data: data?.[0] ? { id: data[0].id } : null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_GUARDAR_LA_NOTA",
    };
  }
}

export async function addLeadActivity(
  input: AddLeadActivityInput
): Promise<Result<{ id: string }>> {
  try {
    const { lead, user, company_id, supabase } = await getLeadForMutation(input.leadId);
    const title = input.title.trim();

    if (!title) {
      throw new Error("La actividad necesita un titulo.");
    }

    const { data, error } = await supabase
      .from("activities")
      .insert({
        company_id,
        lead_id: lead.id,
        contact_id: lead.contact_id,
        user_id: user.id,
        type: input.type,
        title,
        description: input.description?.trim() || null,
        scheduled_at: input.scheduledAt || null,
        source: "manual",
      })
      .select("id")
      .limit(1);

    if (error) {
      throw error;
    }

    revalidateLeadViews();

    return {
      data: data?.[0] ? { id: data[0].id } : null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_GUARDAR_LA_ACTIVIDAD",
    };
  }
}

export async function deleteLead(leadId: string): Promise<Result<{ id: string }>> {
  try {
    const { lead, user, company_id } = await getLeadForMutation(leadId);

    const admin = createAdminSupabaseClient();

    // 1. Delete activities and notes tied to this lead
    await admin.from("activities").delete().eq("company_id", company_id).eq("lead_id", leadId);
    await admin.from("notes").delete().eq("company_id", company_id).eq("lead_id", leadId);

    // 2. Delete the lead
    const { error } = await admin
      .from("leads")
      .delete()
      .eq("company_id", company_id)
      .eq("id", leadId);

    if (error) throw error;

    await insertLeadAudit({
      companyId: company_id,
      userId: user.id,
      action: "lead.deleted",
      entityId: leadId,
      before: lead,
      after: null,
    });

    revalidateLeadViews();
    return { data: { id: leadId }, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_ELIMINAR_EL_LEAD",
    };
  }
}

export async function deleteActivity(activityId: string): Promise<Result<{ id: string }>> {
  try {
    const { user, company_id } = await getMutationContext();

    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("activities")
      .delete()
      .eq("company_id", company_id)
      .eq("id", activityId);

    if (error) throw error;

    revalidateLeadViews();
    return { data: { id: activityId }, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_ELIMINAR_LA_ACTIVIDAD",
    };
  }
}

export async function deleteNote(noteId: string): Promise<Result<{ id: string }>> {
  try {
    const { user, company_id } = await getMutationContext();

    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("notes")
      .delete()
      .eq("company_id", company_id)
      .eq("id", noteId);

    if (error) throw error;

    revalidateLeadViews();
    return { data: { id: noteId }, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_ELIMINAR_LA_NOTA",
    };
  }
}

export async function markLeadAsWon(leadId: string): Promise<Result<LeadMutationRecord>> {
  return closeLead(leadId, "won");
}

export async function markLeadAsLost(input: {
  leadId: string;
  lostReason: string;
}): Promise<Result<LeadMutationRecord>> {
  return closeLead(input.leadId, "lost", input.lostReason);
}
