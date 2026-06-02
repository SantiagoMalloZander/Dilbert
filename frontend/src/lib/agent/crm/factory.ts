/**
 * Connector factory — resolves the CRM destination for a company.
 *
 * The product runs entirely on our own Supabase CRM, so this always returns the
 * native connector. The factory is kept as the single seam where an external
 * destination could be plugged back in later, without touching the pipeline.
 */

import type { CRMConnector } from "@/lib/agent/crm/types";
import { NativeSupabaseConnector } from "@/lib/agent/crm/native-connector";

export async function getConnectorForCompany(companyId: string): Promise<CRMConnector> {
  return new NativeSupabaseConnector(companyId);
}
