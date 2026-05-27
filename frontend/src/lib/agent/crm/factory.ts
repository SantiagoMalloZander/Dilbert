/**
 * Connector factory — resolves which CRM destination a company writes to.
 *
 * Today every tenant uses our native Supabase CRM. When external destinations
 * land (HubSpot, Salesforce, an insurance AMS), this is the single place that
 * reads the tenant's integration config and returns the right connector — no
 * other part of the pipeline changes.
 */

import type { CRMConnector } from "@/lib/agent/crm/types";
import { NativeSupabaseConnector } from "@/lib/agent/crm/native-connector";

export async function getConnectorForCompany(companyId: string): Promise<CRMConnector> {
  // TODO: read companies.settings / channel_credentials to pick an external
  // connector when configured. Defaults to the native CRM for now.
  return new NativeSupabaseConnector(companyId);
}
