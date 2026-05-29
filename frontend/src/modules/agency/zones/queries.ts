import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { requireAuth } from "@/lib/workspace-auth";
import type { Database } from "@/lib/supabase/database.types";
import type { ZoneRecord } from "@/modules/agency/zones/types";

type ZoneRow = Database["public"]["Tables"]["property_zones"]["Row"];

export function mapZoneRow(row: ZoneRow): ZoneRecord {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    province: row.province,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listZones(): Promise<ZoneRecord[]> {
  const { company_id } = await requireAuth();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("property_zones")
    .select("*")
    .eq("company_id", company_id)
    .order("name", { ascending: true });
  return (data ?? []).map(mapZoneRow);
}
