/**
 * POST /app/api/integrations/gmail/sync
 *
 * Fetches emails sent/received since last_sync_at and creates new activities.
 * Called manually (e.g. from settings page) or via a scheduled cron.
 * Returns { imported, skipped }.
 */
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { refreshGmailToken, fetchParsedEmails } from "@/lib/gmail";

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const userId = session.user.id;
  const companyId = session.user.companyId;
  const supabase = createAdminSupabaseClient();

  // Load stored credentials
  const { data: credRow } = await supabase
    .from("channel_credentials")
    .select("credentials, last_sync_at")
    .eq("user_id", userId)
    .eq("channel", "gmail")
    .maybeSingle();

  if (!credRow?.credentials) {
    return NextResponse.json({ error: "Gmail no conectado." }, { status: 400 });
  }

  const creds = credRow.credentials as Record<string, string>;
  const accessToken = await refreshGmailToken(creds.refreshToken);
  if (!accessToken) {
    return NextResponse.json({ error: "No se pudo renovar el token de Gmail." }, { status: 401 });
  }

  const vendorEmail = creds.gmailEmail ?? "";
  const lastSync = credRow.last_sync_at
    ? new Date(credRow.last_sync_at)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // default: last 7 days

  // Build date filter for Gmail query (after:YYYY/MM/DD)
  const afterDate = `${lastSync.getFullYear()}/${String(lastSync.getMonth() + 1).padStart(2, "0")}/${String(lastSync.getDate()).padStart(2, "0")}`;

  const [sentEmails, receivedEmails] = await Promise.all([
    fetchParsedEmails(accessToken, vendorEmail, `is:sent after:${afterDate}`, 30),
    fetchParsedEmails(accessToken, vendorEmail, `is:inbox after:${afterDate}`, 30),
  ]);

  const all = [...sentEmails, ...receivedEmails];
  const unique = [...new Map(all.map((e) => [e.id, e])).values()];

  // Load contacts map
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email")
    .eq("company_id", companyId)
    .not("email", "is", null);

  const contactByEmail = new Map(
    (contacts ?? []).map((c) => [c.email!.toLowerCase(), c])
  );

  let imported = 0;
  let skipped = 0;

  for (const email of unique) {
    const marker = `<!-- gmail:${email.id} -->`;

    // Dedup check
    const { data: existing } = await supabase
      .from("activities")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .like("description", `%${marker}%`)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const contactEmail = email.direction === "sent"
      ? email.toEmails.find((e) => contactByEmail.has(e))
      : contactByEmail.has(email.fromEmail) ? email.fromEmail : null;

    if (!contactEmail) { skipped++; continue; }

    const contact = contactByEmail.get(contactEmail)!;
    const dirLabel = email.direction === "sent" ? "Enviado a" : "Recibido de";
    const description = [
      `**${dirLabel}:** ${email.direction === "sent" ? email.to : email.from}`,
      email.snippet.slice(0, 800).trim() || null,
      marker,
    ].filter(Boolean).join("\n\n");

    await supabase.from("activities").insert({
      company_id: companyId,
      user_id: userId,
      contact_id: contact.id,
      type: "email" as const,
      source: "automatic" as const,
      title: email.subject,
      description,
      completed_at: email.date.toISOString(),
    });

    imported++;
  }

  // Update last_sync_at
  await supabase
    .from("channel_credentials")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("channel", "gmail");

  return NextResponse.json({ ok: true, imported, skipped });
}
