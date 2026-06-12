import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type FollowUpStatus = "atendido" | "desatendido";

export type FollowUpItem = {
  leadId: string;
  title: string;
  contactName: string;
  phone: string | null;
  status: FollowUpStatus;
  suggestedReply: string | null;
  lastClientMessageAt: string | null;
  attendedAt: string | null;
  zone: string | null;
  assignedTo: string | null;
};

export type FollowUpData = {
  counts: { atendidos: number; desatendidos: number };
  items: FollowUpItem[];
};

type LeadRow = {
  id: string;
  title: string;
  attention_status: FollowUpStatus | null;
  suggested_reply: string | null;
  last_client_message_at: string | null;
  attended_at: string | null;
  assigned_to: string | null;
  zone: string | null;
  contact_id: string;
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
};

function contactName(c: ContactRow | undefined): string {
  if (!c) return "Contacto";
  const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return full || c.company_name || "Contacto";
}

/**
 * Leads that the agent has flagged with an attention state, for the Seguimiento
 * inbox. Vendors see only their own leads; owners/analysts see the whole company.
 * Desatendidos first, then oldest-waiting first.
 */
export async function getFollowUpData(params: {
  companyId: string;
  userId: string;
  canViewAll: boolean;
}): Promise<FollowUpData> {
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from("leads")
    .select(
      "id, title, attention_status, suggested_reply, last_client_message_at, attended_at, assigned_to, zone, contact_id"
    )
    .eq("company_id", params.companyId)
    .not("attention_status", "is", null);

  if (!params.canViewAll) {
    query = query.eq("assigned_to", params.userId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const leads = (data as LeadRow[] | null) ?? [];

  // Pull the related contacts in one go (avoids relying on PostgREST embeds).
  const contactIds = [...new Set(leads.map((l) => l.contact_id).filter(Boolean))];
  const contactMap = new Map<string, ContactRow>();
  if (contactIds.length) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, phone, company_name")
      .in("id", contactIds);
    for (const c of (contacts as ContactRow[] | null) ?? []) {
      contactMap.set(c.id, c);
    }
  }

  const items: FollowUpItem[] = leads
    .filter((l) => l.attention_status === "atendido" || l.attention_status === "desatendido")
    .map((l) => {
      const c = contactMap.get(l.contact_id);
      return {
        leadId: l.id,
        title: l.title,
        contactName: contactName(c),
        phone: c?.phone ?? null,
        status: l.attention_status as FollowUpStatus,
        suggestedReply: l.suggested_reply,
        lastClientMessageAt: l.last_client_message_at,
        attendedAt: l.attended_at,
        zone: l.zone,
        assignedTo: l.assigned_to,
      };
    });

  // Desatendidos primero; dentro de cada grupo, el que espera hace más tiempo arriba.
  items.sort((a, b) => {
    if (a.status !== b.status) return a.status === "desatendido" ? -1 : 1;
    const ta = a.lastClientMessageAt ? new Date(a.lastClientMessageAt).getTime() : Infinity;
    const tb = b.lastClientMessageAt ? new Date(b.lastClientMessageAt).getTime() : Infinity;
    return ta - tb;
  });

  return {
    counts: {
      atendidos: items.filter((i) => i.status === "atendido").length,
      desatendidos: items.filter((i) => i.status === "desatendido").length,
    },
    items,
  };
}
