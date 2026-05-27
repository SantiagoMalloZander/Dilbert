/**
 * CRM Writer — applies extracted data to a CRM destination
 *
 * Given a resolved contact_id + ExtractedData, this module:
 *   1. Updates contact fields (only fills blanks or upgrades confidence)
 *   2. Creates or updates deals (one per distinct product/topic)
 *   3. Creates the activity (email / whatsapp / meeting)
 *   4. Registers new channel identifiers in the local cross-channel index
 *   5. Returns a structured log of what happened + what needs vendor confirmation
 *
 * The *business logic* (merge rules, deal disambiguation, forward-only stage
 * advancement) lives here and is destination-neutral. The actual reads/writes go
 * through a CRMConnector, so the same logic targets our Supabase CRM or an
 * external system (HubSpot, Salesforce, an insurance AMS) without changes.
 *
 * The cross-channel identity index (contact_channel_links) stays local — it is
 * our index, not the customer's system of record — so it still uses Supabase.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { registerLink, type Channel } from "@/lib/agent/identity-resolver";
import type { ExtractedData, DataSource } from "@/lib/agent/data-extractor";
import { detectDeal } from "@/lib/agent/deal-detector";
import { resolveStageByKeyword } from "@/lib/agent/stage-resolver";
import type { CRMConnector, CrmSource, ActivityType, DealPatch } from "@/lib/agent/crm/types";

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
  /**
   * Stable id of the source event (gmail message id, whatsapp message id,
   * fathom recording id). Used for idempotency — a unique index prevents
   * duplicate activities from webhook retries / re-syncs.
   */
  externalId?: string;
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

const SOURCE_TO_ACTIVITY_TYPE: Record<DataSource, ActivityType> = {
  gmail: "email",
  whatsapp: "whatsapp",
  fathom: "meeting",
  audio: "meeting",
};

const SOURCE_TO_CRM_SOURCE: Record<DataSource, CrmSource> = {
  gmail: "gmail",
  whatsapp: "whatsapp",
  fathom: "import",
  audio: "import",
};

// ─── Contact updater ──────────────────────────────────────────────────────────
// Rule: only write a field if new value is non-null AND (current is empty OR confidence is high).

async function updateContact(
  connector: CRMConnector,
  contactId: string,
  extracted: ExtractedData,
  confidence: "high" | "medium" | "low"
): Promise<{ updated: string[]; pending: WriterResult["pendingConfirmations"] }> {
  const ci = extracted.contact_info;

  const current = await connector.getContact(contactId);
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

  await connector.updateContactFields(contactId, updates);

  return { updated, pending };
}

// ─── Stage updater helper ─────────────────────────────────────────────────────
// Builds the stage/status portion of a deal update.
// RULE: only advance forward — never move a lead backward in the pipeline.

async function buildStageUpdates(
  connector: CRMConnector,
  leadId: string,
  extracted: ExtractedData
): Promise<DealPatch> {
  const di = extracted.deal_info;
  const keyword = di.suggested_stage_keyword;
  const updates: DealPatch = {};

  const info = await connector.getLeadStageInfo(leadId);
  if (!info) return updates;

  // Don't touch leads that are already closed
  if (info.status === "won" || info.status === "lost") return updates;

  const currentPosition = info.position;

  if (keyword) {
    const stages = await connector.getPipelineStages(info.pipeline_id);
    const targetStage = resolveStageByKeyword(stages, keyword);

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
  if (di.mark_as_won || keyword === "ganado") {
    updates.status = "won";
  } else if (di.mark_as_lost || keyword === "perdido") {
    updates.status = "lost";
  }

  return updates;
}

// ─── Lead manager ─────────────────────────────────────────────────────────────

async function manageLead(
  connector: CRMConnector,
  userId: string,
  contactId: string,
  extracted: ExtractedData,
  source: DataSource
): Promise<{ created: string[]; updated: string[] }> {
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
    const openLeads = await connector.getOpenDeals(contactId);

    if (openLeads.length) {
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
    const leadUpdates: DealPatch = {};
    if (di.value != null) leadUpdates.value = di.value;
    if (di.value != null && di.currency) leadUpdates.currency = di.currency;
    if (di.probability != null) leadUpdates.probability = di.probability;
    if (di.expected_close_date) leadUpdates.expected_close_date = di.expected_close_date;

    // Stage / status advancement
    const stageUpdates = await buildStageUpdates(connector, di.existing_deal_id, extracted);
    Object.assign(leadUpdates, stageUpdates);

    await connector.updateDeal(di.existing_deal_id, leadUpdates);
    updated.push(di.existing_deal_id);
    return { created, updated };
  }

  // ── Fetch pipeline for new-deal branches ───────────────────────────────────
  const pipeline = await connector.getDefaultPipeline();
  if (!pipeline) {
    console.warn("[crm-writer/manageLead] no pipeline found for company");
    return { created, updated };
  }

  const allStages = await connector.getPipelineStages(pipeline.id);
  const firstStage = allStages.find((s) => !s.is_won_stage && !s.is_lost_stage);
  if (!firstStage) return { created, updated };

  // ── Resolve initial stage from AI keyword (for new leads) ─────────────────
  // If the AI detected a stage keyword, use that as starting point
  // instead of always putting new leads at position 0.
  const initialStage = di.suggested_stage_keyword
    ? resolveStageByKeyword(allStages, di.suggested_stage_keyword) ?? firstStage
    : firstStage;

  // For won/lost keywords on new leads, still create the lead at first stage
  // — we don't close immediately, we let the vendor verify.
  const safeInitialStage =
    initialStage.is_won_stage || initialStage.is_lost_stage ? firstStage : initialStage;

  // ── Branch 2: duplicate-title check → update existing ─────────────────────
  const title = di.title ?? di.product_or_service ?? extracted.topics[0] ?? "Nuevo deal";
  const existingLead = await connector.findOpenDealByTitle(contactId, title);

  if (existingLead) {
    const leadUpdates: DealPatch = {};
    if (di.value != null) leadUpdates.value = di.value;
    if (di.value != null && di.currency) leadUpdates.currency = di.currency;
    if (di.probability != null) leadUpdates.probability = di.probability;
    if (di.expected_close_date) leadUpdates.expected_close_date = di.expected_close_date;

    const stageUpdates = await buildStageUpdates(connector, existingLead.id, extracted);
    Object.assign(leadUpdates, stageUpdates);

    await connector.updateDeal(existingLead.id, leadUpdates);
    updated.push(existingLead.id);
    return { created, updated };
  }

  // ── Branch 3: create new lead ──────────────────────────────────────────────
  const newId = await connector.createDeal({
    createdBy: userId,
    assignedTo: userId,
    contactId,
    pipelineId: pipeline.id,
    stageId: safeInitialStage.id,
    title,
    value: di.value ?? null,
    currency: di.currency ?? "ARS",
    probability: di.probability ?? 20,
    expectedCloseDate: di.expected_close_date ?? null,
    source: SOURCE_TO_CRM_SOURCE[source],
    metadata: {
      origin: "agent",
      product_or_service: di.product_or_service,
      topics: extracted.topics,
      sentiment: extracted.sentiment,
      // Insurance vertical: structured policy/quote data (null for generic tenants)
      ...(extracted.insurance ? { insurance: extracted.insurance } : {}),
    },
  });
  if (newId) created.push(newId);
  return { created, updated };
}

// ─── Activity creator ─────────────────────────────────────────────────────────

async function createActivity(
  connector: CRMConnector,
  userId: string,
  contactId: string,
  leadId: string | null,
  extracted: ExtractedData,
  source: DataSource,
  occurredAt: string,
  externalId?: string
): Promise<string | null> {
  return connector.createActivity({
    userId,
    contactId,
    leadId,
    type: SOURCE_TO_ACTIVITY_TYPE[source],
    source: "automatic",
    title: extracted.deal_info.title ?? extracted.topics[0] ?? `Interacción vía ${source}`,
    description: extracted.crm_note || null,
    completedAt: occurredAt,
    externalId: externalId ?? null,
  });
}

// ─── Main writer ──────────────────────────────────────────────────────────────

export async function writeTocrm(input: WriterInput, connector: CRMConnector): Promise<WriterResult> {
  const {
    companyId,
    userId,
    contactId,
    extracted,
    source,
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
    connector, contactId, extracted, extracted.confidence_level
  );
  result.contactFieldsUpdated = updated;
  result.pendingConfirmations = pending;

  // 2. Register any new identifiers found in the extracted data (local index)
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
    connector, userId, contactId, extracted, source
  );
  result.leadsCreated = created;
  result.leadsUpdated = updatedLeads;

  // 4. Create activity — link to the first created/updated lead
  const leadId = created[0] ?? updatedLeads[0] ?? null;
  result.activityId = await createActivity(
    connector, userId, contactId, leadId,
    extracted, source, occurredAt, input.externalId
  );

  return result;
}
