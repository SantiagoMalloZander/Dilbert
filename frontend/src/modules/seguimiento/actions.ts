"use server";

import { requireAuth } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * Manual "marcar como atendido". Vendors can only touch their own leads; owners
 * act on the whole company. The agent will flip it back to "desatendido" if the
 * client writes again, so the inbox keeps updating on its own.
 */
export async function markLeadAttended(leadId: string): Promise<void> {
  const { user, company_id } = await requireAuth({ requireCompany: true });
  if (!company_id) throw new Error("COMPANY_REQUIRED");

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("leads")
    .update({
      attention_status: "atendido",
      attended_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("company_id", company_id);

  if (user.role === "vendor") {
    query = query.eq("assigned_to", user.id);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
}
