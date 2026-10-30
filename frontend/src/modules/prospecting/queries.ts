import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { FoundProspect } from "@/lib/prospecting/sources";

// Las tablas de prospección no están en database.types → cliente sin tipar.
function db() {
  return createAdminSupabaseClient() as unknown as SupabaseClient;
}

export const PROSPECT_STATUSES = [
  "new",
  "sent",
  "replied",
  "bounced",
  "unsubscribed",
  "discarded",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export type ProspectRecord = {
  id: string;
  name: string;
  town: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  emails: string[];
  source: "google" | "osm" | "manual";
  maps_url: string | null;
  status: ProspectStatus;
  enriched_at: string | null;
  last_contacted_at: string | null;
  send_count: number;
  unsubscribe_token: string;
  notes: string | null;
  created_at: string;
};

export async function listProspects() {
  const { data, error } = await db()
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as ProspectRecord[];
}

/** Inserta los nuevos e ignora los que ya existían (por external_id). */
export async function upsertFoundProspects(found: FoundProspect[]) {
  if (found.length === 0) return { inserted: 0 };

  const rows = found.map((prospect) => {
    const email = prospect.email?.trim().toLowerCase() || null;
    return {
    external_id: prospect.externalId,
    source: prospect.source,
    name: prospect.name,
    town: prospect.town,
    region: prospect.region,
    address: prospect.address,
    phone: prospect.phone,
    website: prospect.website,
    email,
    emails: email ? [email] : [],
    maps_url: prospect.mapsUrl,
    };
  });

  const { data, error } = await db()
    .from("prospects")
    .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return { inserted: data?.length ?? 0 };
}

export async function createManualProspect(input: {
  name: string;
  email: string;
  town?: string | null;
  phone?: string | null;
  website?: string | null;
}) {
  const { data, error } = await db()
    .from("prospects")
    .insert({
      source: "manual",
      name: input.name,
      email: input.email.toLowerCase(),
      emails: [input.email.toLowerCase()],
      town: input.town || null,
      phone: input.phone || null,
      website: input.website || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProspectRecord;
}

export async function getProspectsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await db().from("prospects").select("*").in("id", ids);
  if (error) throw error;
  return (data ?? []) as ProspectRecord[];
}

export async function updateProspect(
  id: string,
  patch: Partial<Pick<ProspectRecord, "email" | "emails" | "status" | "notes" | "enriched_at" | "last_contacted_at" | "send_count">>
) {
  const { data, error } = await db()
    .from("prospects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProspectRecord;
}

export async function deleteProspects(ids: string[]) {
  const { error } = await db().from("prospects").delete().in("id", ids);
  if (error) throw error;
}

export async function countSentToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await db()
    .from("prospect_emails")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", startOfDay.toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** True si a esta dirección ya se le mandó algo (dos sucursales con el mismo mail, etc.). */
export async function wasEmailAlreadyContacted(email: string) {
  const { count, error } = await db()
    .from("prospect_emails")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .eq("to_email", email.toLowerCase());
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function logProspectEmail(input: {
  prospectId: string | null;
  toEmail: string;
  subject: string;
  status: "sent" | "failed";
  error?: string | null;
}) {
  const { error } = await db().from("prospect_emails").insert({
    prospect_id: input.prospectId,
    to_email: input.toEmail.toLowerCase(),
    subject: input.subject,
    status: input.status,
    error: input.error ?? null,
  });
  if (error) throw error;
}

export async function unsubscribeByToken(token: string) {
  const { data, error } = await db()
    .from("prospects")
    .update({ status: "unsubscribed", updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("email");
  if (error) throw error;

  // Si la misma dirección aparece en otras filas, también las damos de baja.
  const emails = (data ?? []).map((row) => row.email).filter(Boolean) as string[];
  for (const email of emails) {
    await db()
      .from("prospects")
      .update({ status: "unsubscribed", updated_at: new Date().toISOString() })
      .eq("email", email);
  }
  return (data?.length ?? 0) > 0;
}
