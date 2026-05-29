/**
 * NativeSupabaseConnector — the CRMConnector backed by our own Supabase CRM.
 *
 * This is the default destination. The queries here are exactly what the agent
 * pipeline used to run inline in crm-writer/orchestrator — moved behind the
 * connector interface with no behavioural change.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type {
  CRMConnector,
  RemoteContact,
  NewContactInput,
  OpenDeal,
  PipelineStage,
  LeadStageInfo,
  NewDealInput,
  DealPatch,
  NewActivityInput,
  ExistingActivityRef,
} from "@/lib/agent/crm/types";

export class NativeSupabaseConnector implements CRMConnector {
  constructor(private readonly companyId: string) {}

  private db() {
    return createAdminSupabaseClient();
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  async getContact(contactId: string): Promise<RemoteContact | null> {
    const { data } = await this.db()
      .from("contacts")
      .select(
        "id, first_name, last_name, company_name, position, phone, email, linkedin_url, industry, website, address, annual_revenue, employee_count, notes"
      )
      .eq("id", contactId)
      .eq("company_id", this.companyId)
      .maybeSingle();
    return (data as RemoteContact) ?? null;
  }

  async createContact(input: NewContactInput): Promise<string | null> {
    const { data: contact, error } = await this.db()
      .from("contacts")
      .insert({
        company_id: this.companyId,
        created_by: input.createdBy,
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone,
        company_name: input.companyName,
        source: input.source,
        tags: input.tags,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[native-connector/createContact] insert failed:", error.message, {
        companyId: this.companyId,
        source: input.source,
        firstName: input.firstName,
      });
    }
    return contact?.id ?? null;
  }

  async updateContactFields(
    contactId: string,
    updates: Record<string, string | number>
  ): Promise<void> {
    if (Object.keys(updates).length === 0) return;
    await this.db()
      .from("contacts")
      .update(updates)
      .eq("id", contactId)
      .eq("company_id", this.companyId);
  }

  // ── Deals ────────────────────────────────────────────────────────────────

  async getOpenDeals(contactId: string): Promise<OpenDeal[]> {
    // Two-step fetch instead of a PostgREST embed: there is no FK from
    // leads.stage_id → pipeline_stages, so `pipeline_stages(name)` embedding
    // does not resolve. We join the stage name in memory.
    const { data: leads } = await this.db()
      .from("leads")
      .select("id, title, value, stage_id")
      .eq("company_id", this.companyId)
      .eq("contact_id", contactId)
      .eq("status", "open");
    if (!leads?.length) return [];

    const stageIds = [...new Set(leads.map((l) => l.stage_id).filter(Boolean))] as string[];
    const stageNames = new Map<string, string>();
    if (stageIds.length) {
      const { data: stages } = await this.db()
        .from("pipeline_stages")
        .select("id, name")
        .in("id", stageIds);
      for (const s of stages ?? []) stageNames.set(s.id, s.name);
    }

    return leads.map((l) => ({
      id: l.id,
      title: l.title,
      value: l.value,
      stage: l.stage_id ? stageNames.get(l.stage_id) ?? null : null,
    }));
  }

  async getDefaultPipeline(): Promise<{ id: string } | null> {
    // Prefer is_default=true, fall back to first pipeline if none is marked default.
    const { data: pipelines } = await this.db()
      .from("pipelines")
      .select("id, is_default")
      .eq("company_id", this.companyId)
      .order("is_default", { ascending: false })
      .limit(5);
    const pipeline = pipelines?.find((p) => p.is_default) ?? pipelines?.[0] ?? null;
    return pipeline ? { id: pipeline.id } : null;
  }

  async getPipelineStages(pipelineId: string): Promise<PipelineStage[]> {
    const { data } = await this.db()
      .from("pipeline_stages")
      .select("id, name, position, is_won_stage, is_lost_stage")
      .eq("company_id", this.companyId)
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true });
    return (data ?? []) as PipelineStage[];
  }

  async findOpenDealByTitle(contactId: string, title: string): Promise<{ id: string } | null> {
    const { data } = await this.db()
      .from("leads")
      .select("id")
      .eq("company_id", this.companyId)
      .eq("contact_id", contactId)
      .eq("status", "open")
      .ilike("title", title)
      .maybeSingle();
    return data ? { id: data.id } : null;
  }

  async getLeadStageInfo(leadId: string): Promise<LeadStageInfo | null> {
    // Two-step fetch (no FK embed available — see getOpenDeals).
    const { data: lead } = await this.db()
      .from("leads")
      .select("pipeline_id, stage_id, status")
      .eq("id", leadId)
      .eq("company_id", this.companyId)
      .maybeSingle();
    if (!lead) return null;

    let position = -1;
    if (lead.stage_id) {
      const { data: stage } = await this.db()
        .from("pipeline_stages")
        .select("position")
        .eq("id", lead.stage_id)
        .maybeSingle();
      position = stage?.position ?? -1;
    }

    return {
      pipeline_id: (lead.pipeline_id as string | null) ?? "",
      stage_id: (lead.stage_id as string | null) ?? null,
      status: lead.status as string,
      position,
    };
  }

  async createDeal(input: NewDealInput): Promise<string | null> {
    const { data: newLead, error } = await this.db()
      .from("leads")
      .insert({
        company_id: this.companyId,
        created_by: input.createdBy,
        assigned_to: input.assignedTo,
        contact_id: input.contactId,
        pipeline_id: input.pipelineId,
        stage_id: input.stageId,
        title: input.title,
        value: input.value,
        currency: input.currency,
        probability: input.probability,
        expected_close_date: input.expectedCloseDate,
        source: input.source,
        status: "open" as const,
        metadata: input.metadata as Json,
        ...(input.real_estate ?? {}),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[native-connector/createDeal] insert failed:", error.message, {
        companyId: this.companyId,
        contactId: input.contactId,
        title: input.title,
      });
    }
    if (newLead) console.log(`[native-connector] created lead ${newLead.id} at stage "${input.stageId}"`);
    return newLead?.id ?? null;
  }

  async updateDeal(dealId: string, patch: DealPatch): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db()
      .from("leads")
      .update(patch)
      .eq("id", dealId)
      .eq("company_id", this.companyId);
    console.log(`[native-connector] updated lead ${dealId}`, patch);
  }

  // ── Activities ───────────────────────────────────────────────────────────

  async createActivity(input: NewActivityInput): Promise<string | null> {
    const { data: activity, error } = await this.db()
      .from("activities")
      .insert({
        company_id: this.companyId,
        user_id: input.userId,
        contact_id: input.contactId,
        lead_id: input.leadId,
        type: input.type,
        source: input.source,
        title: input.title,
        description: input.description,
        completed_at: input.completedAt,
        external_id: input.externalId,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 = unique_violation on (company_id, external_id) — the event was already
      // imported (webhook retry / re-sync). Not an error, just idempotency at work.
      if (error.code === "23505") {
        console.log("[native-connector/createActivity] duplicate event skipped:", input.externalId);
      } else {
        console.error("[native-connector/createActivity] insert failed:", error.message, {
          companyId: this.companyId,
          contactId: input.contactId,
          type: input.type,
        });
      }
    }
    return activity?.id ?? null;
  }

  async findActivityByExternalId(externalId: string): Promise<ExistingActivityRef | null> {
    const { data } = await this.db()
      .from("activities")
      .select("id, contact_id")
      .eq("company_id", this.companyId)
      .eq("external_id", externalId)
      .maybeSingle();
    if (!data) return null;
    return { id: data.id, contactId: (data.contact_id as string | null) ?? null };
  }
}
