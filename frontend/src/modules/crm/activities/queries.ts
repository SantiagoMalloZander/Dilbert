import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { requireAuth } from "@/lib/workspace-auth";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export type RecentActivityRecord = {
  id: string;
  type: Database["public"]["Enums"]["activity_type"];
  description: string;
  relatedLabel: string;
  userName: string;
  createdAt: string;
};

export async function getRecentActivities(): Promise<RecentActivityRecord[]> {
  const { user, company_id } = await requireAuth();
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("activities")
    .select("*")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (user.role === "vendor") {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const activities = (data || []) as ActivityRow[];
  const leadIds = [...new Set(activities.map((activity) => activity.lead_id).filter(Boolean))] as string[];
  const contactIds = [...new Set(activities.map((activity) => activity.contact_id).filter(Boolean))] as string[];
  const userIds = [...new Set(activities.map((activity) => activity.user_id))];

  const [leadsResult, contactsResult, usersResult] = await Promise.all([
    leadIds.length
      ? supabase.from("leads").select("id,title").eq("company_id", company_id).in("id", leadIds)
      : Promise.resolve({ data: [], error: null }),
    contactIds.length
      ? supabase
          .from("contacts")
          .select("id,first_name,last_name")
          .eq("company_id", company_id)
          .in("id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("users").select("id,name").eq("company_id", company_id).in("id", userIds),
  ]);

  if (leadsResult.error) {
    throw leadsResult.error;
  }
  if (contactsResult.error) {
    throw contactsResult.error;
  }
  if (usersResult.error) {
    throw usersResult.error;
  }

  const leadsById = new Map(
    ((leadsResult.data || []) as Array<Pick<LeadRow, "id" | "title">>).map((lead) => [lead.id, lead])
  );
  const contactsById = new Map(
    ((contactsResult.data || []) as Array<
      Pick<ContactRow, "id" | "first_name" | "last_name">
    >).map((contact) => [contact.id, contact])
  );
  const usersById = new Map(
    ((usersResult.data || []) as Array<Pick<UserRow, "id" | "name">>).map((row) => [row.id, row])
  );

  return activities.map((activity) => {
    const relatedLead = activity.lead_id ? leadsById.get(activity.lead_id) : null;
    const relatedContact = activity.contact_id ? contactsById.get(activity.contact_id) : null;
    const relatedLabel = relatedLead?.title
      || (relatedContact
        ? `${relatedContact.first_name} ${relatedContact.last_name}`.trim()
        : "Sin relación");

    return {
      id: activity.id,
      type: activity.type,
      description: activity.description?.trim() || activity.title,
      relatedLabel,
      userName: usersById.get(activity.user_id)?.name || "Usuario",
      createdAt: activity.created_at,
    };
  });
}

