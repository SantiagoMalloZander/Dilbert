import type { Database, Json } from "@/lib/supabase/database.types";
import type { AppRole } from "@/lib/workspace-roles";

export type Result<T> = {
  data: T | null;
  error: string | null;
};

export type CrmSource = Database["public"]["Enums"]["crm_source"];
export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type ActivityType = Database["public"]["Enums"]["activity_type"];
export type UserRole = Database["public"]["Enums"]["user_role"];

export type LeadRoleFilter = "comprador" | "vendedor";

export type LeadBoardFilters = {
  assignedTo: string | null;
  source: CrmSource | null;
  createdFrom: string | null;
  createdTo: string | null;
  stageId: string | null;
  leadId: string | null;
  role: LeadRoleFilter | null;
};

export type LeadAssigneeOption = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type LeadContactSummary = {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
};

export type LeadCardRecord = {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  source: CrmSource;
  status: LeadStatus;
  expectedCloseDate: string | null;
  probability: number;
  createdAt: string;
  contact: LeadContactSummary;
  assignedUser: LeadAssigneeOption | null;
  stageId: string;
};

export type PipelineStageRecord = {
  id: string;
  pipelineId: string;
  name: string;
  color: string;
  position: number;
  isWonStage: boolean;
  isLostStage: boolean;
  cards: LeadCardRecord[];
  leadCount: number;
  totalValue: number;
};

export type LeadTimelineItem = {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  source: Database["public"]["Enums"]["entry_source"];
  user: {
    id: string;
    name: string;
  } | null;
};

export type LeadNoteItem = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  source: Database["public"]["Enums"]["entry_source"];
  user: {
    id: string;
    name: string;
  } | null;
};

export type LeadStageOption = {
  id: string;
  name: string;
  color: string;
  isWonStage: boolean;
  isLostStage: boolean;
};

/** Compact view of a property from the catalog, shown when a lead is linked. */
export type LinkedPropertyView = {
  id: string;
  title: string;
  internalCode: string | null;
  propertyType: string;
  operationType: string;
  status: string;
  zone: string | null;
  city: string | null;
  address: string | null;
  price: number | null;
  currency: string | null;
  rooms: number | null;
  bedrooms: number | null;
  surfaceTotal: number | null;
};

/** A catalog property the agent thinks matches the lead's search. */
export type PropertyMatchSuggestion = LinkedPropertyView & {
  /** Reasons the property scored, e.g. ["Zona","Presupuesto","Tipo"]. */
  matchReasons: string[];
};

export type LeadDetailRecord = {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  pipelineId: string;
  probability: number;
  expectedCloseDate: string | null;
  status: LeadStatus;
  lostReason: string | null;
  source: CrmSource;
  createdAt: string;
  updatedAt: string;
  metadata: Json;
  contact: LeadContactSummary;
  assignedUser: LeadAssigneeOption | null;
  stage: LeadStageOption | null;
  stageOptions: LeadStageOption[];
  timeline: LeadTimelineItem[];
  notes: LeadNoteItem[];
  /** Property from the internal catalog this lead is linked to, if any. */
  linkedProperty: LinkedPropertyView | null;
  /**
   * Catalog matches for the lead's search criteria (top 3). Empty when the
   * lead is already linked, has no criteria, or the client isn't buying/renting.
   */
  suggestedProperties: PropertyMatchSuggestion[];
  /** Real-estate fields stored on the lead row (editable from the form). */
  realEstate: LeadRealEstateFields;
  permissions: {
    canEdit: boolean;
    canMarkOutcome: boolean;
  };
};

export type LeadBoardData = {
  currentUser: {
    id: string;
    role: AppRole;
    canManageAssigneeFilter: boolean;
  };
  companyId: string;
  pipeline: {
    id: string;
    name: string;
  };
  filters: LeadBoardFilters;
  stages: PipelineStageRecord[];
  assignees: LeadAssigneeOption[];
  sources: CrmSource[];
  selectedLead: LeadDetailRecord | null;
  leadForm: {
    pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>;
    canCreate: boolean;
  };
};

export type DashboardKpiMetric = {
  label: string;
  value: number;
  formattedValue: string;
  description: string;
  benchmark?: {
    label: string;
    formattedValue: string;
  } | null;
};

export type DashboardKpiData = {
  role: AppRole;
  metrics: DashboardKpiMetric[];
};

export type LeadsByStageMetric = {
  stageId: string;
  name: string;
  color: string;
  count: number;
};

export type LeadsBySourceMetric = {
  source: CrmSource;
  label: string;
  count: number;
  value: number;
};

export type UpcomingLeadRecord = {
  id: string;
  title: string;
  contactName: string;
  expectedCloseDate: string;
  daysUntilClose: number;
  value: number | null;
  currency: string;
  stageName: string | null;
  status: LeadStatus;
};

export type SellerPerformanceRecord = {
  userId: string;
  name: string;
  activeLeads: number;
  wonThisMonth: number;
  closedValueThisMonth: number;
};

export type LeadMutationRecord = {
  id: string;
  stageId: string;
  status: LeadStatus;
};

/** Real-estate fields editable from the lead form. Mirrors the lead columns. */
export type LeadRealEstateFields = {
  operationType: string | null;
  clientRole: string | null;
  propertyType: string | null;
  zone: string | null;
  city: string | null;
  province: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surfaceTotal: number | null;
  surfaceCovered: number | null;
  hasGarage: boolean | null;
  urgency: string | null;
  timeline: string | null;
  listingRef: string | null;
  visitStatus: string | null;
  financing: string | null;
};

/**
 * Validates that a lead carries enough of the client's search criteria for the
 * agent to recommend properties. Returns an error message or null if OK.
 * Buyers/renters must also have a budget; sellers/valuations describe the
 * property they offer, so budget is optional there.
 */
export function validateLeadSearchFields(re: LeadRealEstateFields): string | null {
  if (!re.operationType) return "Elegí la operación que busca el cliente (compra, alquiler, venta o tasación).";
  if (!re.propertyType) return "Elegí el tipo de propiedad.";
  if (!re.zone || !re.zone.trim()) return "Indicá la zona o barrio.";
  const isBuyerSide = re.operationType === "compra" || re.operationType === "alquiler";
  if (isBuyerSide && re.budgetMin == null && re.budgetMax == null) {
    return "Cargá el presupuesto del cliente (al menos un tope) para poder recomendar propiedades.";
  }
  return null;
}

export const EMPTY_LEAD_REAL_ESTATE: LeadRealEstateFields = {
  operationType: null, clientRole: null, propertyType: null,
  zone: null, city: null, province: null,
  budgetMin: null, budgetMax: null, budgetCurrency: null,
  rooms: null, bedrooms: null, bathrooms: null,
  surfaceTotal: null, surfaceCovered: null,
  hasGarage: null, urgency: null, timeline: null,
  listingRef: null, visitStatus: null, financing: null,
};

export type LeadUpsertPayload = {
  title: string;
  contactId: string;
  value: number | null;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  pipelineId: string;
  stageId: string;
  assignedTo: string | null;
  source: CrmSource;
  realEstate?: LeadRealEstateFields | null;
  /** Base property the lead came in for (the listing that originated it). */
  listingId?: string | null;
};

export type CreateLeadInput = LeadUpsertPayload;

export type UpdateLeadInput = LeadUpsertPayload & {
  leadId: string;
};

export type AddLeadNoteInput = {
  leadId: string;
  content: string;
};

export type AddLeadActivityInput = {
  leadId: string;
  type: ActivityType;
  title: string;
  description: string | null;
  scheduledAt: string | null;
};

export const LEAD_SOURCE_OPTIONS: CrmSource[] = [
  "manual",
  "whatsapp",
  "gmail",
  "instagram",
  "zoom",
  "meet",
  "import",
];
