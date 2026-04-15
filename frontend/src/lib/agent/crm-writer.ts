/**
 * CRM Writer — persists extracted data into Supabase
 *
 * Given a resolved contact_id + ExtractedData, this module:
 *   1. Updates contact fields (only fills blanks or upgrades confidence)
 *   2. Creates or updates leads (one per distinct product/topic)
 *   3. Creates the activity (email / whatsapp / meeting)
 *   4. Registers new channel identifiers in contact_channel_links
 *   5. Returns a structured log of what happened + what needs vendor confirmation
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { registerLink, type Channel } from "@/lib/agent/identity-resolver";
import type { ExtractedData, DataSource } from "@/lib/agent/data-extractor";
import { detectDeal } from "@/lib/agent/deal-detector";
import { resolveStageByKeyword } from "@/lib/agent/stage-resolver";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface WriterInput {
  companyId: string;
  userId: string;           // the vendor who owns this activity
  contactId: string;
  extracted: ExtractedData;
  source: DataSource;
  /** Raw original text — stored in the activity description */
  rawText: string;
  /** Channel identifier (phone / email / fathom id) for link registration */
  channelIdentifier?: string;
  channel: Channel;
  /** Activity timestamp — defaults to now() */
  occurredAt?: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface WriterResult {
  /** Fields that were written to the contact */
  contactFieldsUpdated: string[];
  /** Lead IDs that were created */
  leadsCreated: string[];
  /** Lead IDs that were updated */
  leadsUpdated: string[];
  /** Activity ID created */
  activityId: string | null;
  /** New channel links registered */
  linksRegistered: string[];
  /** Things the agent couldn't resolve — need vendor confirmation */
  pendingConfirmations: Array<{
    field: string;
    currentValue: string;
    newValue: string;
    reason: string;
  }>;
}

// ─── Type maps ────────────────────────────────────────────────────────────────

const SOURCE_TO_ACTIVITY_TYPE: Record<DataSource, "email" | "whatsapp" | "meeting"> = {
  gmail: "email",
  whatsapp: "whatsapp",
  fathom: "meeting",
  audio: "meeting",
};

type CrmSource = "gmail" | "whatsapp" | "import";
const SOURCE_TO_CRM_SOURCE: Record<DataSource, CrmSource> = {
  gmail: "gmail",
  whatsapp: "whatsapp",
  fathom: "import",
  audio: "import",
};

// ─── Contact updater ──────────────────────────────────────────────────────────
// Rule: only write a field if new value is non-null AND (current is empty OR confidence is high).

async function updateContact(
  companyId: string,
  contactId: string,
  extracted: ExtractedData,
  confidence: "high" | "medium" | "low"
): Promise<{ updated: string[]; pending: WriterResult["pendingConfirmations"] }> {
  const supabase = createAdminSupabaseClient();
  const ci = extracted.contact_info;

  // Fetch current contact state
  const { data: current } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .eq("company_id", companyId)
    .single();

  if (!current) return { updated: [], pending: [] };

  const updates: Record<string, string | number> = {};
  const updated: string[] = [];
  const pending: WriterResult["pendingConfirmations"] = [];

  function consider(
    field: string,
    newVal: string | number | null | undefined,
    currentVal: string | number | null | undefined
  ) {
    if (newVal == null || newVal === "") return;
    const isEmpty = currentVal == null || currentVal === "";

    if (isEmpty) {
      // Always fill blanks
      updates[field] = newVal;
      updated.push(field);
    } else if (newVal !== currentVal) {
      if (confidence === "high") {
        // High confidence but value differs — flag for vendor, don't overwrite silently
        pending.push({
          field,
          currentValue: String(currentVal),
          newValue: String(newVal),
          reason: "El agente encontró un valor distinto al que ya está cargado.",
        });
      }
      // medium/low confidence with conflicting value → ignore silently
    }
  }

  // Name fields: update if current is empty, placeholder, derived from email,
  // or if we now have a more complete name (single-word → first+last)
  if (ci.first_name) {
    const curFirst = (current.first_name ?? "") as string;
    const curLast  = (current.last_name  ?? "") as string;
    const currentIsSingleWord = curFirst && !curFirst.includes(" ") && !curLast;
    const newHasLastName = !!ci.last_name;
    const shouldUpdateName =
      !curFirst ||
      curFirst === "Desconocido" ||
      curFirst.includes("@") ||                        // was an email address used as name
      (currentIsSingleWord && newHasLastName);         // upgrade "Orbitalcreators" → "Paula Grillo"
    if (shouldUpdateName) {
      updates["first_name"] = ci.first_name;
      updated.push("first_name");
    }
  }
  if (ci.last_name) {
    const curLast = (current.last_name ?? "") as string;
    // Update last_name if empty, or if we're also updating first_name (coherent name upgrade)
    if (!curLast || "first_name" in updates) {
      updates["last_name"] = ci.last_name;
      if (!updated.includes("last_name")) updated.push("last_name");
    }
  }

  consider("company_name",    ci.company_name,    current.company_name);
  consider("position",        ci.position,        current.position);
  consider("phone",           ci.phone,           current.phone);
  consider("email",           ci.email,           current.email);
  consider("linkedin_url",    ci.linkedin_url,    current.linkedin_url);
  consider("industry",        ci.industry,        current.industry);
  consider("website",         ci.website,         current.website);
  consider("address",         ci.address,         current.address);
  consider("annual_revenue",  ci.annual_revenue,  current.annual_revenue);
  consider("employee_count",  ci.employee_count,  current.employee_count);

  // Notes: always append, never overwrite
  if (ci.notes) {
    const existing = current.notes ?? "";
    updates["notes"] = existing ? `${existing}\n\n${ci.notes}` : ci.notes;
    updated.push("notes");
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("contacts")
      .update(updates)
      .eq("id", contactId)
      .eq("company_id", companyId);
  }

  return { updated, pending };
}

// ─── Stage updater helper ─────────────────────────────────────────────────────
// Builds the stage/status portion of a lead update object.
// RULE: only advance forward — never move a lead backward in the pipeline.

async function buildStageUpdates(
  companyId: string,
  leadId: string,
  extracted: ExtractedData
): Promise<Record<string, string>> {
  const di = extracted.deal_info;
  const keyword = di.suggested_stage_keyword;
  const updates: Record<string, string> = {};

  // Fetch current lead to get pipeline_id + current stage position
  const supabase = createAdminSupabaseClient();
  const { data: currentLead } = await supabase
    .from("leads")
    .select("pipeline_id, stage_id, status, pipeline_stages(position)")
    .eq("id", leadId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!currentLead) return updates;

  // Don't touch leads that are already closed
  if (currentLead.status === "won" || currentLead.status === "lost") return updates;

  const currentPosition =
    (currentLead.pipeline_stages as { position: number } | null)?.position ?? -1;

  if (keyword) {
    const targetStage = await resolveStageByKeyword(
      companyId,
      currentLead.pipeline_id as string,
      keyword
    );

    if (targetStage) {
      // Only advance forward OR apply terminal stages
      const shouldMove =
        targetStage.is_won_stage ||
        targetStage.is_lost_stage ||
        targetStage.position > currentPosition;

      if (shouldMove) {
        updates.stage_id = targetStage.id;
      }
    }
  }

  // Status changes for terminal stages
  if (di.mark_as_won || di.suggested_stage_keyword === "ganado") {
    updates.status = "won";
  } else if (di.mark_as_lost || di.suggested_stage_keyword === "perdido") {
    updates.status = "lost";
  }

  return updates;
}

// ─── Lead manager ─────────────────────────────────────────────────────────────

async function manageLead(
  companyId: string,
  userId: string,
  contactId: string,
  extracted: ExtractedData,
  source: DataSource
): Promise<{ created: string[]; updated: string[] }> {
  const supabase = createAdminSupabaseClient();
  const di = extracted.deal_info;
  const created: string[] = [];
  const updated: string[] = [];

  // Gate: skip if the AI says it's not CRM-relevant (newsletter, notification, etc.)
  if (extracted.is_relevant_for_crm === false) return { created, updated };

  // Require at least something to go on: purchase intent, a title, a product mention, or topics
  const hasAnything =
    extracted.has_purchase_intent ||
    !!di.title ||
    !!di.product_or_service ||
    extracted.topics.length > 0;
  if (!hasAnything) return { created, updated };

  // ── Deal detector for "unclear" cases ──────────────────────────────────────
  if (extracted.deal_is_new_or_existing === "unclear" && (di.title || extracted.topics[0])) {
    const { data: openLeads } = await supabase
      .from("leads")
      .select("id, title, value")
      .eq("company_id", companyId)
      .eq("contact_id", contactId)
      .eq("status", "open");

    if (openLeads?.length) {
      const detection = await detectDeal(
        di.title ?? extracted.topics[0] ?? "",
        extracted.crm_note,
        openLeads
      );

      if (detection.action === "update_existing" && detection.lead_id) {
        di.existing_deal_id = detection.lead_id;
        extracted.deal_is_new_or_existing = "existing";
      } else if (detection.action === "create_new") {
        extracted.deal_is_new_or_existing = "new";
      }
    }
  }

  // ── Branch 1: update an existing deal matched by ID ────────────────────────
  if (extracted.deal_is_new_or_existing === "existing" && di.existing_deal_id) {
    const leadUpdates: Record<string, string | number> = {};
    if (di.value != null) leadUpdates.value = di.value;
    if (di.probability != null) leadUpdates.probability = di.probability;
    if (di.expected_close_date) leadUpdates.expected_close_date = di.expected_close_date;

    // Stage / status advancement
    const stageUpdates = await buildStageUpdates(companyId, di.existing_deal_id, extracted);
    Object.assign(leadUpdates, stageUpdates);

    if (Object.keys(leadUpdates).length > 0) {
      await supabase
        .from("leads")
        .update(leadUpdates)
        .eq("id", di.existing_deal_id)
        .eq("company_id", companyId);
      console.log(`[crm-writer] updated lead ${di.existing_deal_id}`, leadUpdates);
    }
    updated.push(di.existing_deal_id);
    return { created, updated };
  }

  // ── Fetch pipeline for new-deal branches ───────────────────────────────────
  // Prefer is_default=true, fall back to first pipeline if none is marked default
  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, is_default")
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .limit(5);

  const pipeline = pipelines?.find((p) => p.is_default) ?? pipelines?.[0] ?? null;
  if (!pipeline) {
    console.warn("[crm-writer/manageLead] no pipeline found for company", companyId);
    return { created, updated };
  }

  const { data: allStages } = await supabase
    .from("pipeline_stages")
    .select("id, position, is_won_stage, is_lost_stage")
    .eq("company_id", companyId)
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });

  const firstStage = (allStages ?? []).find((s) => !s.is_won_stage && !s.is_lost_stage);
  if (!firstStage) return { created, updated };

  // ── Resolve initial stage from AI keyword (for new leads) ─────────────────
  // If the AI detected a stage keyword, use that as starting point
  // instead of always putting new leads at position 0.
  const initialStage = di.suggested_stage_keyword
    ? (await resolveStageByKeyword(companyId, pipeline.id, di.suggested_stage_keyword)) ?? firstStage
    : firstStage;

  // For won/lost keywords on new leads, still create the lead at first stage
  // — we don't close immediately, we let the vendor verify.
  const safeInitialStage =
    initialStage.is_won_stage || initialStage.is_lost_stage ? firstStage : initialStage;

  // ── Branch 2: duplicate-title check → update existing ─────────────────────
  const title = di.title ?? di.product_or_service ?? extracted.topics[0] ?? "Nuevo deal";
  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("company_id", companyId)
    .eq("contact_id", contactId)
    .eq("status", "open")
    .ilike("title", title)
    .maybeSingle();

  if (existingLead) {
    const leadUpdates: Record<string, string | number> = {};
    if (di.value != null) leadUpdates.value = di.value;
    if (di.probability != null) leadUpdates.probability = di.probability;
    if (di.expected_close_date) leadUpdates.expected_close_date = di.expected_close_date;

    const stageUpdates = await buildStageUpdates(companyId, existingLead.id, extracted);
    Object.assign(leadUpdates, stageUpdates);

    if (Object.keys(leadUpdates).length > 0) {
      await supabase.from("leads").update(leadUpdates)
        .eq("id", existingLead.id).eq("company_id", companyId);
      console.log(`[crm-writer] updated lead (title match) ${existingLead.id}`, leadUpdates);
    }
    updated.push(existingLead.id);
    return { created, updated };
  }

  // ── Branch 3: create new lead ──────────────────────────────────────────────
  const { data: newLead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      company_id: companyId,
      created_by: userId,
      assigned_to: userId,
      contact_id: contactId,
      pipeline_id: pipeline.id,
      stage_id: safeInitialStage.id,
      title,
      value: di.value ?? null,
      currency: "ARS",
      probability: di.probability ?? 20,
      expected_close_date: di.expected_close_date ?? null,
      source: SOURCE_TO_CRM_SOURCE[source],
      status: "open" as const,
      metadata: {
        origin: "agent",
        product_or_service: di.product_or_service,
        topics: extracted.topics,
        sentiment: extracted.sentiment,
      },
    })
    .select("id")
    .single();

  if (leadErr) {
    console.error("[crm-writer/manageLead] lead insert failed:", leadErr.message, { companyId, contactId, title });
  }
  if (newLead) {
    console.log(`[crm-writer] created lead ${newLead.id} at stage "${safeInitialStage.id}"`);
    created.push(newLead.id);
  }
  return { created, updated };
}

// ─── Activity creator ─────────────────────────────────────────────────────────

async function createActivity(
  companyId: string,
  userId: string,
  contactId: string,
  leadId: string | null,
  extracted: ExtractedData,
  source: DataSource,
  rawText: string,
  occurredAt: string
): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const type = SOURCE_TO_ACTIVITY_TYPE[source];

  const descParts: string[] = [];
  if (extracted.crm_note) descParts.push(extracted.crm_note);

  if (extracted.sentiment !== "neutral") {
    const label = { positive: "Positivo", negative: "Negativo", neutral: "Neutral" }[extracted.sentiment];
    descParts.push(`**Sentimiento:** ${label}`);
  }
  if (extracted.topics.length)
    descParts.push(`**Temas:** ${extracted.topics.join(", ")}`);
  if (extracted.action_items.length)
    descParts.push(`**Próximos pasos:**\n${extracted.action_items.map((a) => `• ${a}`).join("\n")}`);

  // Keep a trimmed snapshot of the original text for reference
  const snippet = rawText.slice(0, 600).trim();
  if (snippet) descParts.push(`---\n${snippet}${rawText.length > 600 ? "\n..." : ""}`);

  const { data: activity, error: activityErr } = await supabase
    .from("activities")
    .insert({
      company_id: companyId,
      user_id: userId,
      contact_id: contactId,
      lead_id: leadId,
      type,
      source: "automatic" as const,
      title: extracted.deal_info.title ?? extracted.topics[0] ?? `Interacción vía ${source}`,
      description: descParts.join("\n\n") || null,
      completed_at: occurredAt,
    })
    .select("id")
    .single();

  if (activityErr) {
    console.error("[crm-writer/createActivity] insert failed:", activityErr.message, { companyId, contactId, type, source });
  }

  return activity?.id ?? null;
}

// ─── Main writer ──────────────────────────────────────────────────────────────

export async function writeTocrm(input: WriterInput): Promise<WriterResult> {
  const {
    companyId,
    userId,
    contactId,
    extracted,
    source,
    rawText,
    channelIdentifier,
    channel,
    occurredAt = new Date().toISOString(),
  } = input;

  const result: WriterResult = {
    contactFieldsUpdated: [],
    leadsCreated: [],
    leadsUpdated: [],
    activityId: null,
    linksRegistered: [],
    pendingConfirmations: [],
  };

  // 1. Update contact fields
  const { updated, pending } = await updateContact(
    companyId, contactId, extracted, extracted.confidence_level
  );
  result.contactFieldsUpdated = updated;
  result.pendingConfirmations = pending;

  // 2. Register any new identifiers found in the extracted data
  const supabase = createAdminSupabaseClient();

  if (channelIdentifier) {
    await registerLink(companyId, contactId, channel, channelIdentifier);
    result.linksRegistered.push(`${channel}:${channelIdentifier}`);
  }

  // Also register email/phone discovered in the text (different channel)
  if (extracted.contact_info.email && channel !== "gmail") {
    const email = extracted.contact_info.email.toLowerCase();
    const { data: existing } = await supabase
      .from("contact_channel_links")
      .select("id")
      .eq("company_id", companyId)
      .eq("channel", "gmail")
      .eq("identifier", email)
      .maybeSingle();
    if (!existing) {
      await registerLink(companyId, contactId, "gmail", email);
      result.linksRegistered.push(`gmail:${email}`);
    }
  }

  if (extracted.contact_info.phone && channel !== "whatsapp") {
    const phone = extracted.contact_info.phone.replace(/\D/g, "");
    const { data: existing } = await supabase
      .from("contact_channel_links")
      .select("id")
      .eq("company_id", companyId)
      .eq("channel", "whatsapp")
      .eq("identifier", phone)
      .maybeSingle();
    if (!existing) {
      await registerLink(companyId, contactId, "whatsapp", phone);
      result.linksRegistered.push(`whatsapp:${phone}`);
    }
  }

  // 3. Manage leads
  const { created, updated: updatedLeads } = await manageLead(
    companyId, userId, contactId, extracted, source
  );
  result.leadsCreated = created;
  result.leadsUpdated = updatedLeads;

  // 4. Create activity — link to the first created/updated lead
  const leadId = created[0] ?? updatedLeads[0] ?? null;
  result.activityId = await createActivity(
    companyId, userId, contactId, leadId,
    extracted, source, rawText, occurredAt
  );

  return result;
}
