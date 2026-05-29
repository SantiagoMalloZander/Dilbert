"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/workspace-auth";
import { mapPropertyRow } from "@/modules/agency/properties/queries";
import {
  OPERATION_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type PropertyFormInput,
  type PropertyRecord,
  type Result,
} from "@/modules/agency/properties/types";

async function requireOwner() {
  const auth = await requireAuth();
  if (auth.user.role !== "owner" && !auth.user.isSuperAdmin) {
    throw new Error("Solo el dueño de la inmobiliaria puede gestionar el catálogo de propiedades.");
  }
  return auth;
}

function buildPayload(input: PropertyFormInput) {
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  if (!PROPERTY_TYPES.includes(input.propertyType as (typeof PROPERTY_TYPES)[number])) {
    throw new Error("Tipo de propiedad inválido.");
  }
  if (!OPERATION_TYPES.includes(input.operationType as (typeof OPERATION_TYPES)[number])) {
    throw new Error("Tipo de operación inválido.");
  }
  const status = PROPERTY_STATUSES.includes(input.status as (typeof PROPERTY_STATUSES)[number])
    ? input.status
    : "disponible";

  return {
    title,
    internal_code: input.internalCode?.trim() || null,
    listing_url: input.listingUrl?.trim() || null,
    property_type: input.propertyType,
    operation_type: input.operationType,
    status,
    address: input.address?.trim() || null,
    zone: input.zone?.trim() || null,
    city: input.city?.trim() || null,
    province: input.province?.trim() || null,
    floor: input.floor?.trim() || null,
    apartment: input.apartment?.trim() || null,
    rooms: input.rooms ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    surface_total: input.surfaceTotal ?? null,
    surface_covered: input.surfaceCovered ?? null,
    year_built: input.yearBuilt ?? null,
    price: input.price ?? null,
    currency: input.currency?.trim() || null,
    expenses: input.expenses ?? null,
    expenses_currency: input.expensesCurrency?.trim() || null,
    has_garage: input.hasGarage ?? null,
    garage_count: input.garageCount ?? null,
    mortgage_eligible: input.mortgageEligible ?? null,
    amenities: input.amenities ?? [],
    description: input.description?.trim() || null,
  };
}

export async function createProperty(input: PropertyFormInput): Promise<Result<PropertyRecord>> {
  try {
    const { company_id } = await requireOwner();
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("properties")
      .insert({ company_id, ...buildPayload(input) })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/app/settings");
    return { data: mapPropertyRow(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo crear la propiedad." };
  }
}

export async function updateProperty(id: string, input: PropertyFormInput): Promise<Result<PropertyRecord>> {
  try {
    const { company_id } = await requireOwner();
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("properties")
      .update({ ...buildPayload(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", company_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/app/settings");
    return { data: mapPropertyRow(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo actualizar la propiedad." };
  }
}

export async function deleteProperty(id: string): Promise<Result<{ id: string }>> {
  try {
    const { company_id } = await requireOwner();
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", id)
      .eq("company_id", company_id);
    if (error) throw new Error(error.message);
    revalidatePath("/app/settings");
    return { data: { id }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo eliminar la propiedad." };
  }
}

/**
 * Returns the property catalog for any workspace user — used by the lead detail
 * picker. Owner gate doesn't apply: vendors need to link properties to leads.
 */
export async function listLinkableProperties(): Promise<Result<PropertyRecord[]>> {
  try {
    const { company_id } = await requireAuth();
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { data: (data ?? []).map(mapPropertyRow), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo cargar el catálogo." };
  }
}
