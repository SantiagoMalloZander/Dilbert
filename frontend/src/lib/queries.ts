import { supabase } from "./supabase";

export async function getLeads(companyId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("*, sellers(name)")
    .eq("company_id", companyId)
    .order("last_interaction", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getSellers(companyId: string) {
  const { data, error } = await supabase
    .from("sellers")
    .select("*")
    .eq("company_id", companyId);

  if (error) throw error;
  return data;
}

export async function getInteractions(leadId: string) {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getCompany(companyId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (error) throw error;
  return data;
}
