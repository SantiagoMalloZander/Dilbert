import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { requireAuth } from "@/lib/workspace-auth";
import type { Database } from "@/lib/supabase/database.types";
import type { PropertyRecord } from "@/modules/agency/properties/types";

type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];

export function mapPropertyRow(row: PropertyRow): PropertyRecord {
  return {
    id: row.id,
    title: row.title,
    internalCode: row.internal_code,
    listingUrl: row.listing_url,
    propertyType: row.property_type,
    operationType: row.operation_type,
    status: row.status,
    address: row.address,
    zone: row.zone,
    city: row.city,
    province: row.province,
    floor: row.floor,
    apartment: row.apartment,
    rooms: row.rooms,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    surfaceTotal: row.surface_total,
    surfaceCovered: row.surface_covered,
    yearBuilt: row.year_built,
    price: row.price,
    currency: row.currency,
    expenses: row.expenses,
    expensesCurrency: row.expenses_currency,
    hasGarage: row.has_garage,
    garageCount: row.garage_count,
    mortgageEligible: row.mortgage_eligible,
    amenities: row.amenities ?? [],
    description: row.description,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
  };
}

export async function listProperties(): Promise<PropertyRecord[]> {
  const { company_id } = await requireAuth();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapPropertyRow);
}
