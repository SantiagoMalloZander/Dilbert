/**
 * CRM Connector — neutral domain model + destination interface
 *
 * The agent pipeline extracts data in a CRM-agnostic shape and then hands it to
 * a CRMConnector that knows how to read/write a specific destination (our own
 * Supabase CRM, HubSpot, Salesforce, an insurance AMS, …).
 *
 * Everything here is destination-neutral. Implementations live in sibling files
 * (native-connector.ts = our Supabase CRM). The pipeline never talks to Supabase
 * for CRM records directly — only through this interface.
 *
 * NOT part of this boundary (stays local, in our own DB regardless of destination):
 *   - cross-channel identity index (contact_channel_links)
 *   - agent questions / review queue
 *   - agent memory
 * Those are the "brain + index + control" layer, not the customer's system of record.
 */

/** DB crm_source enum — where a record originated */
export type CrmSource =
  | "manual"
  | "whatsapp"
  | "gmail"
  | "instagram"
  | "zoom"
  | "meet"
  | "import";

/** DB activity_type enum */
export type ActivityType =
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "task"
  | "whatsapp"
  | "instagram";

// ─── Contacts ──────────────────────────────────────────────────────────────────

/** A contact as read back from the destination, normalised to the fields the agent merges. */
export interface RemoteContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  linkedin_url: string | null;
  industry: string | null;
  website: string | null;
  address: string | null;
  annual_revenue: number | null;
  employee_count: number | null;
  notes: string | null;
}

export interface NewContactInput {
  createdBy: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: CrmSource;
  tags: string[];
}

// ─── Deals (a.k.a. leads / opportunities / policies) ────────────────────────────

export interface OpenDeal {
  id: string;
  title: string;
  value: number | null;
  /** Current stage name, when the destination exposes it */
  stage: string | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  is_won_stage: boolean;
  is_lost_stage: boolean;
}

/** Current pipeline/stage state of a deal — used to decide forward-only stage moves. */
export interface LeadStageInfo {
  pipeline_id: string;
  stage_id: string | null;
  status: string;
  /** Position of the deal's current stage, or -1 if unknown. */
  position: number;
}

/** Real-estate attributes promoted to first-class lead columns. */
export interface RealEstateFields {
  operation_type: string | null;   // compra | venta | alquiler | tasacion
  client_role: string | null;      // buyer | seller | owner | renter | investor
  property_type: string | null;    // depto | casa | ph | terreno | local | oficina | cochera | galpon | quinta
  zone: string | null;
  city: string | null;
  province: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string | null;
  rooms: number | null;            // ambientes
  bedrooms: number | null;         // dormitorios
  bathrooms: number | null;
  surface_total: number | null;
  surface_covered: number | null;
  has_garage: boolean | null;
  urgency: string | null;          // high | medium | low
  timeline: string | null;
  listing_ref: string | null;
  visit_status: string | null;     // agendada | realizada | cancelada
  financing: string | null;        // contado | credito | mixto
}

export interface NewDealInput {
  createdBy: string;
  assignedTo: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  value: number | null;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  source: CrmSource;
  metadata: Record<string, unknown>;
  /** Real-estate fields (null for generic tenants). */
  real_estate?: RealEstateFields | null;
}

/** Canonical, destination-neutral deal status vocabulary. */
export type DealStatus = "open" | "won" | "lost" | "paused";

/** Partial update to a deal. Keys mirror the neutral deal fields. */
export type DealPatch = Partial<{
  value: number;
  currency: string;
  probability: number;
  expected_close_date: string;
  stage_id: string;
  status: DealStatus;
}>;

// ─── Activities ──────────────────────────────────────────────────────────────────

export interface NewActivityInput {
  userId: string;
  contactId: string;
  leadId: string | null;
  type: ActivityType;
  source: "automatic" | "manual";
  title: string;
  description: string | null;
  completedAt: string;
  /** Stable id of the source event, for idempotency. */
  externalId: string | null;
}

export interface ExistingActivityRef {
  id: string;
  contactId: string | null;
}

// ─── The connector interface ─────────────────────────────────────────────────────
//
// An instance is scoped to a single tenant (company), so methods don't take a
// companyId. Construct one per request via getConnectorForCompany().

export interface CRMConnector {
  // Contacts
  getContact(contactId: string): Promise<RemoteContact | null>;
  createContact(input: NewContactInput): Promise<string | null>;
  updateContactFields(contactId: string, updates: Record<string, string | number>): Promise<void>;

  // Deals
  getOpenDeals(contactId: string): Promise<OpenDeal[]>;
  getDefaultPipeline(): Promise<{ id: string } | null>;
  getPipelineStages(pipelineId: string): Promise<PipelineStage[]>;
  findOpenDealByTitle(contactId: string, title: string): Promise<{ id: string } | null>;
  getLeadStageInfo(leadId: string): Promise<LeadStageInfo | null>;
  createDeal(input: NewDealInput): Promise<string | null>;
  updateDeal(dealId: string, patch: DealPatch): Promise<void>;

  // Activities
  createActivity(input: NewActivityInput): Promise<string | null>;
  findActivityByExternalId(externalId: string): Promise<ExistingActivityRef | null>;
}
