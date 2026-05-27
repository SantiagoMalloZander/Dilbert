import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { requireAuth } from "@/lib/workspace-auth";
import type { Database } from "@/lib/supabase/database.types";
import type { ProviderRecord } from "@/modules/insurance/providers/types";

type ProviderRow = Database["public"]["Tables"]["insurance_providers"]["Row"];

export function mapProviderRow(row: ProviderRow): ProviderRecord {
  return {
    id: row.id,
    name: row.name,
    categories: row.categories ?? [],
    logoUrl: row.logo_url,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listProviders(): Promise<ProviderRecord[]> {
  const { company_id } = await requireAuth();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("insurance_providers")
    .select("*")
    .eq("company_id", company_id)
    .order("name", { ascending: true });
  return (data ?? []).map(mapProviderRow);
}
