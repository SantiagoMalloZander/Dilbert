/**
 * Connector factory — resolves which CRM destination a company writes to.
 *
 * Reads the tenant's settings:
 *   - settings.crm_connector === "hubspot" + a token  → HubSpotConnector
 *   - otherwise                                        → NativeSupabaseConnector
 *
 * Adding a new destination (Salesforce, an insurance AMS) means a new connector
 * class and one branch here — nothing else in the pipeline changes.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { CRMConnector } from "@/lib/agent/crm/types";
import { NativeSupabaseConnector } from "@/lib/agent/crm/native-connector";
import { HubSpotConnector } from "@/lib/agent/crm/hubspot-connector";

export async function getConnectorForCompany(companyId: string): Promise<CRMConnector> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();

  const settings = (data?.settings ?? {}) as Record<string, unknown>;

  if (settings.crm_connector === "hubspot") {
    const token = (settings.hubspot_token as string) || process.env.HUBSPOT_API_KEY || "";
    if (token) return new HubSpotConnector(companyId, token);
    console.warn("[crm/factory] company configured for hubspot but no token — falling back to native", companyId);
  }

  return new NativeSupabaseConnector(companyId);
}
