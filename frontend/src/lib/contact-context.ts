/**
 * Cross-channel contact context for AI analysis.
 *
 * Before analyzing any new event (meeting, message, email), we pull the full
 * recent interaction history with that contact across ALL channels and inject
 * it into the AI prompt. This way the agent never asks for info it already has.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";

const CHANNEL_LABEL: Record<string, string> = {
  meeting: "Reunión",
  message: "WhatsApp",
  email: "Email",
  call: "Llamada",
  note: "Nota interna",
  task: "Tarea",
};

function formatActivityLine(a: {
  type: string;
  title: string;
  description: string | null;
  completed_at: string | null;
}): string {
  const date = a.completed_at
    ? new Date(a.completed_at).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "fecha desconocida";

  const channel = CHANNEL_LABEL[a.type] ?? a.type;

  // Clean up description: strip HTML comments, limit length
  const raw = (a.description ?? a.title ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\*\*/g, "")
    .replace(/\[.+?\]\(.+?\)/g, "") // strip markdown links
    .trim();

  const text = raw.slice(0, 400) + (raw.length > 400 ? "..." : "");

  return `[${date}] ${channel}: ${text || a.title}`;
}

/**
 * Returns a formatted string with the contact's recent activity across all channels.
 * Pass `excludeActivityId` to skip the current activity being processed.
 */
export async function getContactContext(
  contactId: string,
  companyId: string,
  options: { excludeActivityId?: string; daysBack?: number } = {}
): Promise<string> {
  const { excludeActivityId, daysBack = 60 } = options;

  const supabase = createAdminSupabaseClient();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const { data: activities } = await supabase
    .from("activities")
    .select("id, type, title, description, completed_at")
    .eq("company_id", companyId)
    .eq("contact_id", contactId)
    .gte("completed_at", since)
    .order("completed_at", { ascending: true })
    .limit(25);

  if (!activities?.length) return "";

  const relevant = excludeActivityId
    ? activities.filter((a) => a.id !== excludeActivityId)
    : activities;

  if (!relevant.length) return "";

  const lines = relevant.map(formatActivityLine);

  return [
    `=== Historial de interacciones con este contacto (últimos ${daysBack} días, todos los canales) ===`,
    ...lines,
    `=== Fin del historial ===`,
  ].join("\n");
}

/**
 * Look up a contact by email and return their ID, or null if not found.
 * Useful to get context before the contact object is resolved.
 */
export async function findContactIdByEmail(
  email: string,
  companyId: string
): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .eq("company_id", companyId)
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}
