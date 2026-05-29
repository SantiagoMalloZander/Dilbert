"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/workspace-auth";
import { mapZoneRow } from "@/modules/agency/zones/queries";
import type { Result, ZoneFormInput, ZoneRecord } from "@/modules/agency/zones/types";

async function requireOwner() {
  const auth = await requireAuth();
  if (auth.user.role !== "owner" && !auth.user.isSuperAdmin) {
    throw new Error("Solo el dueño de la inmobiliaria puede gestionar zonas.");
  }
  return auth;
}

export async function createZone(input: ZoneFormInput): Promise<Result<ZoneRecord>> {
  try {
    const { company_id } = await requireOwner();
    const name = input.name.trim();
    if (!name) throw new Error("El nombre de la zona es obligatorio.");

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("property_zones")
      .insert({
        company_id,
        name,
        city: input.city?.trim() || null,
        province: input.province?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("Ya cargaste una zona con ese nombre.");
      throw new Error(error.message);
    }

    revalidatePath("/app/settings");
    return { data: mapZoneRow(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo crear la zona." };
  }
}

export async function updateZone(id: string, input: ZoneFormInput): Promise<Result<ZoneRecord>> {
  try {
    const { company_id } = await requireOwner();
    const name = input.name.trim();
    if (!name) throw new Error("El nombre de la zona es obligatorio.");

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("property_zones")
      .update({
        name,
        city: input.city?.trim() || null,
        province: input.province?.trim() || null,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", company_id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("Ya cargaste una zona con ese nombre.");
      throw new Error(error.message);
    }

    revalidatePath("/app/settings");
    return { data: mapZoneRow(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo actualizar la zona." };
  }
}

export async function deleteZone(id: string): Promise<Result<{ id: string }>> {
  try {
    const { company_id } = await requireOwner();
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase
      .from("property_zones")
      .delete()
      .eq("id", id)
      .eq("company_id", company_id);
    if (error) throw new Error(error.message);
    revalidatePath("/app/settings");
    return { data: { id }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo eliminar la zona." };
  }
}
