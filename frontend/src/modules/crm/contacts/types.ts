import type { Database } from "@/lib/supabase/database.types";
import type { AppRole } from "@/lib/workspace-roles";

export type Result<T> = {
  data: T | null;
  error: string | null;
};

export type ContactSource = Database["public"]["Enums"]["crm_source"];
export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type ActivityType = Database["public"]["Enums"]["activity_type"];

export type ContactFilters = {
  query: string | null;
  source: ContactSource | null;
  contactId: string | null;
};

export type ContactPagination = {
  page: number;
  pageSize: number;
};

export type ContactRecord = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  position: string | null;
  source: ContactSource;
  createdAt: string;
  assignedTo: string | null;
  activeLeadCount: number;
};

export type ContactLeadRecord = {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  status: LeadStatus;
  expectedCloseDate: string | null;
  stage: {
    id: string;
    name: string;
    color: string;
  } | null;
};

export type ContactActivityRecord = {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  source: Database["public"]["Enums"]["entry_source"];
  createdAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  user: {
    id: string;
    name: string;
  } | null;
};

export type ContactDetailRecord = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  position: string | null;
  source: ContactSource;
  createdAt: string;
  assignedTo: string | null;
  leads: ContactLeadRecord[];
  activities: ContactActivityRecord[];
};

export type ContactFormInput = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  position: string | null;
  source?: ContactSource;
  assignedTo?: string | null;
};

export type ContactSearchResult = {
  id: string;
  fullName: string;
  email: string | null;
  companyName: string | null;
};

export type ContactPageData = {
  currentUser: {
    id: string;
    role: AppRole;
    canCreateContact: boolean;
    canCreateLead: boolean;
  };
  contacts: ContactRecord[];
  total: number;
  pagination: ContactPagination;
  filters: ContactFilters;
  selectedContact: ContactDetailRecord | null;
  sources: ContactSource[];
  assignees: Array<{
    id: string;
    name: string;
  }>;
  leadForm: {
    pipelines: Array<{
      id: string;
      name: string;
      stages: Array<{
        id: string;
        name: string;
        color: string;
      }>;
    }>;
  };
};

export const CONTACT_SOURCE_OPTIONS: ContactSource[] = [
  "manual",
  "whatsapp",
  "gmail",
  "instagram",
  "zoom",
  "meet",
  "import",
];

