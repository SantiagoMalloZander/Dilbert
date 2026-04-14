"use server";

import { revalidatePath } from "next/cache";
import { canEditContact } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import type { Json } from "@/lib/supabase/database.types";
import { requireAuth } from "@/lib/workspace-auth";
import type { ContactFormInput, ContactRecord, ContactSearchResult, Result } from "@/modules/crm/contacts/types";
import { searchContacts as searchContactsQuery } from "@/modules/crm/contacts/queries";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

function normalizePhone(phone: string | null | undefined) {
  return phone?.trim() || null;
}

function validateContactInput(input: ContactFormInput) {
  if (!input.firstName.trim()) {
    throw new Error("El nombre es obligatorio.");
  }

  if (!input.lastName.trim()) {
    throw new Error("El apellido es obligatorio.");
  }

  const email = normalizeEmail(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Ingresá un email válido.");
  }

  const phone = normalizePhone(input.phone);
  if (phone && !/^[+\d\s()-]{7,20}$/.test(phone)) {
    throw new Error("Ingresá un teléfono válido.");
  }
}

async function insertAuditLog(params: {
  companyId: string;
  userId: string;
  action: string;
  entityId: string;
  before: unknown;
  after: unknown;
}) {
  const admin = createAdminSupabaseClient();
  await admin.from("audit_log").insert({
    company_id: params.companyId,
    user_id: params.userId,
    action: params.action,
    entity_type: "contact",
    entity_id: params.entityId,
    changes: {
      before: params.before,
      after: params.after,
    } as Json,
  });
}

function revalidateContactViews() {
  revalidatePath("/app/crm/contacts");
  revalidatePath("/app/crm/leads");
}

export async function createContact(input: ContactFormInput): Promise<Result<ContactRecord>> {
  try {
    const { user, company_id } = await requireAuth();
    validateContactInput(input);

    if (!canEditContact(user.role, user.id, user.id)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createServerSupabaseClient();
    const payload = {
      company_id,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: normalizeEmail(input.email),
      phone: normalizePhone(input.phone),
      company_name: input.companyName?.trim() || null,
      position: input.position?.trim() || null,
      source: input.source || "manual",
      assigned_to: user.role === "owner" ? input.assignedTo || user.id : user.id,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from("contacts")
      .insert(payload)
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    const created = data?.[0];
    if (!created) {
      throw new Error("No pudimos crear el contacto.");
    }

    await insertAuditLog({
      companyId: company_id,
      userId: user.id,
      action: "contact.created",
      entityId: created.id,
      before: null,
      after: created,
    });

    revalidateContactViews();

    return {
      data: {
        id: created.id,
        firstName: created.first_name,
        lastName: created.last_name,
        fullName: `${created.first_name} ${created.last_name}`.trim(),
        email: created.email,
        phone: created.phone,
        companyName: created.company_name,
        position: created.position,
        source: created.source,
        createdAt: created.created_at,
        assignedTo: created.assigned_to,
        activeLeadCount: 0,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_CREAR_EL_CONTACTO",
    };
  }
}

export async function updateContact(
  id: string,
  input: ContactFormInput
): Promise<Result<ContactRecord>> {
  try {
    const { user, company_id } = await requireAuth();
    validateContactInput(input);

    const authSupabase = await createServerSupabaseClient();
    const { data: existingRows, error: existingError } = await authSupabase
      .from("contacts")
      .select("*")
      .eq("company_id", company_id)
      .eq("id", id)
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    const existing = existingRows?.[0];
    if (!existing) {
      throw new Error("CONTACT_NOT_FOUND");
    }

    if (!canEditContact(user.role, existing.assigned_to, user.id)) {
      throw new Error("FORBIDDEN");
    }

    const payload = {
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: normalizeEmail(input.email),
      phone: normalizePhone(input.phone),
      company_name: input.companyName?.trim() || null,
      position: input.position?.trim() || null,
      assigned_to: user.role === "owner" ? input.assignedTo || existing.assigned_to : existing.assigned_to,
    };

    const { data, error } = await authSupabase
      .from("contacts")
      .update(payload)
      .eq("company_id", company_id)
      .eq("id", id)
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    const updated = data?.[0];
    if (!updated) {
      throw new Error("No pudimos actualizar el contacto.");
    }

    await insertAuditLog({
      companyId: company_id,
      userId: user.id,
      action: "contact.updated",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    revalidateContactViews();

    return {
      data: {
        id: updated.id,
        firstName: updated.first_name,
        lastName: updated.last_name,
        fullName: `${updated.first_name} ${updated.last_name}`.trim(),
        email: updated.email,
        phone: updated.phone,
        companyName: updated.company_name,
        position: updated.position,
        source: updated.source,
        createdAt: updated.created_at,
        assignedTo: updated.assigned_to,
        activeLeadCount: 0,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_ACTUALIZAR_EL_CONTACTO",
    };
  }
}

export async function deleteContact(contactId: string): Promise<Result<{ id: string }>> {
  try {
    const { user, company_id } = await requireAuth();

    const admin = createAdminSupabaseClient();

    // Verify the contact belongs to this company
    const { data: existing, error: fetchErr } = await admin
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("company_id", company_id)
      .eq("id", contactId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) throw new Error("CONTACT_NOT_FOUND");

    if (!canEditContact(user.role, user.id, user.id)) throw new Error("FORBIDDEN");

    // 1. Find all leads for this contact
    const { data: leads } = await admin
      .from("leads")
      .select("id")
      .eq("company_id", company_id)
      .eq("contact_id", contactId);

    const leadIds = (leads ?? []).map((l) => l.id);

    // 2. Delete activities and notes tied to those leads
    if (leadIds.length > 0) {
      await admin.from("activities").delete().eq("company_id", company_id).in("lead_id", leadIds);
      await admin.from("notes").delete().eq("company_id", company_id).in("lead_id", leadIds);
    }

    // 3. Delete activities and notes tied directly to the contact
    await admin.from("activities").delete().eq("company_id", company_id).eq("contact_id", contactId);
    await admin.from("notes").delete().eq("company_id", company_id).eq("contact_id", contactId);

    // 4. Delete the leads themselves
    if (leadIds.length > 0) {
      await admin.from("leads").delete().eq("company_id", company_id).in("id", leadIds);
    }

    // 5. Delete the contact
    const { error: deleteErr } = await admin
      .from("contacts")
      .delete()
      .eq("company_id", company_id)
      .eq("id", contactId);

    if (deleteErr) throw deleteErr;

    await insertAuditLog({
      companyId: company_id,
      userId: user.id,
      action: "contact.deleted",
      entityId: contactId,
      before: existing,
      after: null,
    });

    revalidateContactViews();
    return { data: { id: contactId }, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_ELIMINAR_EL_CONTACTO",
    };
  }
}

export async function searchContactsAction(query: string): Promise<Result<ContactSearchResult[]>> {
  try {
    const { user, company_id } = await requireAuth();
    const results = await searchContactsQuery(company_id, query, {
      id: user.id,
      role: user.role,
    });

    return {
      data: results,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "NO_PUDIMOS_BUSCAR_CONTACTOS",
    };
  }
}
