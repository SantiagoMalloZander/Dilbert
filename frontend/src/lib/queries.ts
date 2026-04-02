import { getAnalyticsCompanyId, getSupabaseServerClient } from "./supabase-server";
import type {
  AnalyticsCompanyContext,
  Company,
  Interaction,
  Lead,
  Seller,
} from "./types";

const INTERACTION_BATCH_SIZE = 100;

function getDb() {
  return getSupabaseServerClient();
}

export async function getLeads(companyId: string): Promise<Lead[]> {
  const { data, error } = await getDb()
    .from("leads")
    .select("*, sellers(name)")
    .eq("company_id", companyId)
    .order("last_interaction", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getSellers(companyId: string): Promise<Seller[]> {
  const { data, error } = await getDb()
    .from("sellers")
    .select("*")
    .eq("company_id", companyId);

  if (error) throw error;
  return data ?? [];
}

export async function getInteractions(
  leadId: string,
  companyId: string
): Promise<Interaction[]> {
  const lead = await getLeadById(leadId, companyId);
  if (!lead) {
    return [];
  }

  const { data, error } = await getDb()
    .from("interactions")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCompany(companyId: string): Promise<Company> {
  const { data, error } = await getDb()
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (error) throw error;
  return data;
}

export async function getLeadById(id: string, companyId: string): Promise<Lead | null> {
  const { data, error } = await getDb()
    .from("leads")
    .select("*, sellers(name)")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAnalyticsContext(
  companyId = getAnalyticsCompanyId()
): Promise<AnalyticsCompanyContext> {
  const [company, sellers, leads] = await Promise.all([
    getCompany(companyId),
    getSellers(companyId),
    getLeads(companyId),
  ]);

  const leadIds = leads.map((lead) => lead.id);
  const interactions: Interaction[] = [];

  for (let index = 0; index < leadIds.length; index += INTERACTION_BATCH_SIZE) {
    const batch = leadIds.slice(index, index + INTERACTION_BATCH_SIZE);
    if (batch.length === 0) {
      continue;
    }

    const { data, error } = await getDb()
      .from("interactions")
      .select("*")
      .in("lead_id", batch)
      .order("created_at", { ascending: true });

    if (error) throw error;
    interactions.push(...(data ?? []));
  }

  return {
    company,
    sellers,
    leads,
    interactions,
  };
}
