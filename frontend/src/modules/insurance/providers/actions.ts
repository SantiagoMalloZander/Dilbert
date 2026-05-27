"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/workspace-auth";
import { mapProviderRow } from "@/modules/insurance/providers/queries";
import {
  INSURANCE_CATEGORIES,
  type ProviderFormInput,
  type ProviderRecord,
  type Result,
} from "@/modules/insurance/providers/types";

function cleanCategories(categories: string[]): string[] {
  const allowed = new Set<string>(INSURANCE_CATEGORIES);
  return [...new Set((categories ?? []).filter((c) => allowed.has(c)))];
}

async function requireOwner() {
  const auth = await requireAuth();
  if (auth.user.role !== "owner" && !auth.user.isSuperAdmin) {
    throw new Error("Solo el dueño de la empresa puede gestionar aseguradoras.");
  }
  return auth;
}

export async function createProvider(input: ProviderFormInput): Promise<Result<ProviderRecord>> {
  try {
    const { company_id } = await requireOwner();
    const name = input.name.trim();
    if (!name) throw new Error("El nombre de la aseguradora es obligatorio.");

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("insurance_providers")
      .insert({
        company_id,
        name,
        categories: cleanCategories(input.categories),
        notes: input.notes?.trim() || null,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("Ya cargaste una aseguradora con ese nombre.");
      throw new Error(error.message);
    }

    revalidatePath("/app/settings");
    return { data: mapProviderRow(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo crear la aseguradora." };
  }
}

export async function updateProvider(
  id: string,
  input: ProviderFormInput
): Promise<Result<ProviderRecord>> {
  try {
    const { company_id } = await requireOwner();
    const name = input.name.trim();
    if (!name) throw new Error("El nombre de la aseguradora es obligatorio.");

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("insurance_providers")
      .update({
        name,
        categories: cleanCategories(input.categories),
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", company_id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("Ya cargaste una aseguradora con ese nombre.");
      throw new Error(error.message);
    }

    revalidatePath("/app/settings");
    return { data: mapProviderRow(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo actualizar la aseguradora." };
  }
}

export async function deleteProvider(id: string): Promise<Result<{ id: string }>> {
  try {
    const { company_id } = await requireOwner();
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase
      .from("insurance_providers")
      .delete()
      .eq("id", id)
      .eq("company_id", company_id);
    if (error) throw new Error(error.message);

    revalidatePath("/app/settings");
    return { data: { id }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "No se pudo eliminar la aseguradora." };
  }
}
