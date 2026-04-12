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
};

type CrmSource = "gmail" | "whatsapp" | "import";
const SOURCE_TO_CRM_SOURCE: Record<DataSource, CrmSource> = {
  gmail: "gmail",
  whatsapp: "whatsapp",
  fathom: "import",
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

  if (!extracted.has_purchase_intent && !di.title) return { created, updated };

  // If agent matched an existing deal
  if (
    extracted.deal_is_new_or_existing === "existing" &&
    di.existing_deal_id
  ) {
    const leadUpdates: Record<string, string | number> = {};
    if (di.value != null) leadUpdates.value = di.value;
    if (di.probability != null) leadUpdates.probability = di.probability;
    if (di.expected_close_date) leadUpdates.expected_close_date = di.expected_close_date;

    if (Object.keys(leadUpdates).length > 0) {
      await supabase
        .from("leads")
        .update(leadUpdates)
        .eq("id", di.existing_deal_id)
        .eq("company_id", companyId);
      updated.push(di.existing_deal_id);
    }
    return { created, updated };
  }

  // New deal — find the first stage of the default pipeline
  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_default", true)
    .maybeSingle();

  if (!pipeline) return { created, updated };

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
  if (!firstStage) return { created, updated };

  // Check if an identical open deal already exists (avoid duplicates)
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
    // Same title → update instead of creating duplicate
    const leadUpdates: Record<string, string | number> = {};
    if (di.value != null) leadUpdates.value = di.value;
    if (di.probability != null) leadUpdates.probability = di.probability;
    if (di.expected_close_date) leadUpdates.expected_close_date = di.expected_close_date;
    if (Object.keys(leadUpdates).length > 0) {
      await supabase.from("leads").update(leadUpdates)
        .eq("id", existingLead.id).eq("company_id", companyId);
    }
    updated.push(existingLead.id);
    return { created, updated };
  }

  // Create new lead
  const { data: newLead } = await supabase
    .from("leads")
    .insert({
      company_id: companyId,
      created_by: userId,
      assigned_to: userId,
      contact_id: contactId,
      pipeline_id: pipeline.id,
      stage_id: firstStage.id,
      title,
      value: di.value ?? null,
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

  if (newLead) created.push(newLead.id);
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

  const { data: activity } = await supabase
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: {
        agent_confidence: extracted.confidence_level,
        has_purchase_intent: extracted.has_purchase_intent,
        deal_is_new_or_existing: extracted.deal_is_new_or_existing,
      } as any,
    })
    .select("id")
    .single();

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
