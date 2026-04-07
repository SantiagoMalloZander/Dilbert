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

export type LeadBoardFilters = {
  assignedTo: string | null;
  source: CrmSource | null;
  createdFrom: string | null;
  createdTo: string | null;
  stageId: string | null;
  leadId: string | null;
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
