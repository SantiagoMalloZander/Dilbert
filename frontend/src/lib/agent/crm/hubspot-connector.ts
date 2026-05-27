/**
 * HubSpotConnector — reference external CRM connector.
 *
 * Architecture: composition over the native connector. Our Supabase CRM stays
 * the source of truth and index (identity resolution, idempotency, dedup all
 * run against it), and every write is ALSO mirrored to the customer's HubSpot,
 * best-effort. If HubSpot is down or rejects a call, the native write already
 * succeeded — the pipeline never breaks, and a later sync can reconcile.
 *
 * Reads delegate to native (we read our own index, not HubSpot). Writes go to
 * native first, then mirror.
 *
 * HubSpot idempotency without a local id map: contacts with a real email are
 * upserted by email; contacts without one are created plain (our identity
 * resolver already guarantees one contact per person, and createContact mirrors
 * run once). Deals are found by a `dilbert_id:<leadId>` marker in their
 * description, so re-syncs patch instead of duplicating.
 */

import { NativeSupabaseConnector } from "@/lib/agent/crm/native-connector";
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

const HS_BASE = "https://api.hubapi.com";

// HubSpot default association type ids (HUBSPOT_DEFINED)
const ASSOC = { contactToDeal: "3", noteToContact: "202", noteToDeal: "214" } as const;

interface HsObject {
  id?: string;
  properties?: Record<string, unknown>;
}

export class HubSpotConnector implements CRMConnector {
  private readonly native: NativeSupabaseConnector;
  private readonly headers: Record<string, string>;

  constructor(companyId: string, token: string) {
    this.native = new NativeSupabaseConnector(companyId);
    this.headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  // ── HubSpot REST helpers ───────────────────────────────────────────────────

  private async post(path: string, body: object): Promise<HsObject> {
    const res = await fetch(`${HS_BASE}${path}`, { method: "POST", headers: this.headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HubSpot POST ${path} → ${res.status} ${await res.text()}`);
    return res.json() as Promise<HsObject>;
  }

  private async patch(path: string, body: object): Promise<HsObject> {
    const res = await fetch(`${HS_BASE}${path}`, { method: "PATCH", headers: this.headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HubSpot PATCH ${path} → ${res.status} ${await res.text()}`);
    return res.json() as Promise<HsObject>;
  }

  private async search(objectType: string, filterProp: string, value: string, operator = "EQ"): Promise<HsObject | null> {
    const res = await fetch(`${HS_BASE}/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: filterProp, operator, value }] }],
        limit: 1,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: HsObject[] };
    return data.results?.[0] ?? null;
  }

  private async associate(fromType: string, fromId: string, toType: string, toId: string, typeId: string): Promise<void> {
    await fetch(`${HS_BASE}/crm/v4/objects/${fromType}/${fromId}/associations/${toType}/${toId}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify([{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: typeId }]),
    });
  }

  /** Find (or create) the HubSpot contact id for one of our contacts, by email. */
  private async hsContactIdByEmail(email: string): Promise<string | null> {
    const found = await this.search("contacts", "email", email);
    return found?.id ?? null;
  }

  // ── Reads: delegate to the local index ──────────────────────────────────────

  getContact(contactId: string): Promise<RemoteContact | null> { return this.native.getContact(contactId); }
  getOpenDeals(contactId: string): Promise<OpenDeal[]> { return this.native.getOpenDeals(contactId); }
  getDefaultPipeline(): Promise<{ id: string } | null> { return this.native.getDefaultPipeline(); }
  getPipelineStages(pipelineId: string): Promise<PipelineStage[]> { return this.native.getPipelineStages(pipelineId); }
  findOpenDealByTitle(contactId: string, title: string): Promise<{ id: string } | null> { return this.native.findOpenDealByTitle(contactId, title); }
  getLeadStageInfo(leadId: string): Promise<LeadStageInfo | null> { return this.native.getLeadStageInfo(leadId); }
  findActivityByExternalId(externalId: string): Promise<ExistingActivityRef | null> { return this.native.findActivityByExternalId(externalId); }

  // ── Writes: native first (authoritative), then mirror to HubSpot ────────────

  async createContact(input: NewContactInput): Promise<string | null> {
    const id = await this.native.createContact(input);
    if (id) {
      this.mirrorContact(input.email ?? null, {
        firstname: input.firstName,
        lastname: input.lastName,
        company: input.companyName ?? "",
        phone: input.phone ?? "",
      }).catch((e) => console.error("[hubspot] createContact mirror failed:", e));
    }
    return id;
  }

  async updateContactFields(contactId: string, updates: Record<string, string | number>): Promise<void> {
    await this.native.updateContactFields(contactId, updates);
    // Mirror the HubSpot-known fields, best-effort.
    const map: Record<string, string> = {
      first_name: "firstname", last_name: "lastname", company_name: "company",
      phone: "phone", email: "email",
    };
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) if (map[k]) props[map[k]] = v;
    if (Object.keys(props).length === 0) return;

    this.mirrorContactUpdate(contactId, props).catch((e) =>
      console.error("[hubspot] updateContactFields mirror failed:", e)
    );
  }

  async createDeal(input: NewDealInput): Promise<string | null> {
    const leadId = await this.native.createDeal(input);
    if (leadId) {
      this.mirrorDeal(leadId, input).catch((e) => console.error("[hubspot] createDeal mirror failed:", e));
    }
    return leadId;
  }

  async updateDeal(dealId: string, patch: DealPatch): Promise<void> {
    await this.native.updateDeal(dealId, patch);
    this.mirrorDealUpdate(dealId, patch).catch((e) => console.error("[hubspot] updateDeal mirror failed:", e));
  }

  async createActivity(input: NewActivityInput): Promise<string | null> {
    const activityId = await this.native.createActivity(input);
    // Only mirror if the native write actually created the activity (not a dup).
    if (activityId) {
      this.mirrorNote(input).catch((e) => console.error("[hubspot] createActivity mirror failed:", e));
    }
    return activityId;
  }

  // ── Mirror implementations (best-effort, never throw to the caller) ─────────

  private async mirrorContact(email: string | null, props: Record<string, unknown>): Promise<void> {
    if (email) {
      const existing = await this.search("contacts", "email", email);
      if (existing?.id) {
        await this.patch(`/crm/v3/objects/contacts/${existing.id}`, { properties: props });
        return;
      }
      await this.post("/crm/v3/objects/contacts", { properties: { email, ...props } });
      return;
    }
    // No email — create plain (HubSpot rejects fake-domain pseudo-emails).
    await this.post("/crm/v3/objects/contacts", { properties: props });
  }

  private async mirrorContactUpdate(contactId: string, props: Record<string, unknown>): Promise<void> {
    const contact = await this.native.getContact(contactId);
    const email = (props.email as string) ?? contact?.email ?? null;
    await this.mirrorContact(email, props);
  }

  private async mirrorDeal(leadId: string, input: NewDealInput): Promise<void> {
    const contact = await this.native.getContact(input.contactId);
    const email = contact?.email ?? null;

    const props: Record<string, unknown> = {
      dealname: input.title,
      amount: input.value != null ? String(input.value) : "0",
      pipeline: "default",
      dealstage: "appointmentscheduled",
      // Embed our id so re-syncs are idempotent on the HubSpot side.
      description: `dilbert_id:${leadId}`,
    };
    if (input.expectedCloseDate) props.closedate = input.expectedCloseDate;

    const existing = await this.search("deals", "description", `dilbert_id:${leadId}`, "CONTAINS_TOKEN");
    let dealId = existing?.id ?? null;
    if (dealId) {
      await this.patch(`/crm/v3/objects/deals/${dealId}`, { properties: props });
    } else {
      const created = await this.post("/crm/v3/objects/deals", { properties: props });
      dealId = created.id ?? null;
    }

    // Associate the deal with the contact (only resolvable when the contact has a real email).
    const hsContactId = email ? await this.hsContactIdByEmail(email) : null;
    if (dealId && hsContactId) {
      await this.associate("deals", dealId, "contacts", hsContactId, ASSOC.contactToDeal);
    }
  }

  private async mirrorDealUpdate(leadId: string, patch: DealPatch): Promise<void> {
    const existing = await this.search("deals", "description", `dilbert_id:${leadId}`, "CONTAINS_TOKEN");
    if (!existing?.id) return;
    const props: Record<string, unknown> = {};
    if (patch.value != null) props.amount = String(patch.value);
    if (patch.status === "won") props.dealstage = "closedwon";
    else if (patch.status === "lost") props.dealstage = "closedlost";
    if (patch.expected_close_date) props.closedate = patch.expected_close_date;
    if (Object.keys(props).length === 0) return;
    await this.patch(`/crm/v3/objects/deals/${existing.id}`, { properties: props });
  }

  private async mirrorNote(input: NewActivityInput): Promise<void> {
    const body = [input.title, input.description].filter(Boolean).join("\n\n");
    if (!body) return;

    const note = await this.post("/crm/v3/objects/notes", {
      properties: {
        hs_note_body: body,
        hs_timestamp: input.completedAt ?? new Date().toISOString(),
      },
    });
    if (!note.id) return;

    const contact = await this.native.getContact(input.contactId);
    const email = contact?.email ?? null;
    const hsContactId = email ? await this.hsContactIdByEmail(email) : null;
    if (hsContactId) await this.associate("notes", note.id, "contacts", hsContactId, ASSOC.noteToContact);

    if (input.leadId) {
      const hsDeal = await this.search("deals", "description", `dilbert_id:${input.leadId}`, "CONTAINS_TOKEN");
      if (hsDeal?.id) await this.associate("notes", note.id, "deals", hsDeal.id, ASSOC.noteToDeal);
    }
  }
}
