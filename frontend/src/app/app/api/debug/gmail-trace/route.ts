/**
 * GET /app/api/debug/gmail-trace
 *
 * Fast diagnostic: credentials, token, raw Gmail queries, and email list.
 * No AI extraction (that would timeout the function).
 */
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { refreshGmailToken, fetchParsedEmails } from "@/lib/gmail";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const userId = session.user.id;
  const companyId = session.user.companyId;
  const supabase = createAdminSupabaseClient();
  const trace: Record<string, unknown>[] = [];

  // ── Step 1: Load credentials ──────────────────────────────────────────────
  const { data: credRow, error: credErr } = await supabase
    .from("channel_credentials")
    .select("credentials, last_sync_at, status")
    .eq("user_id", userId)
    .eq("channel", "gmail")
    .maybeSingle();

  if (credErr || !credRow) {
    return NextResponse.json({ error: "Gmail no conectado", detail: credErr?.message });
  }

  const creds = credRow.credentials as Record<string, string>;
  trace.push({
    step: "credentials",
    status: credRow.status,
    gmailEmail: creds.gmailEmail ?? "(vacío)",
    hasRefreshToken: !!creds.refreshToken,
    lastSyncAt: credRow.last_sync_at ?? "(nunca)",
  });

  // ── Step 2: Refresh token ─────────────────────────────────────────────────
  const accessToken = await refreshGmailToken(creds.refreshToken);
  if (!accessToken) {
    return NextResponse.json({ error: "No se pudo renovar el token de Gmail. Reconectá Gmail.", trace });
  }
  trace.push({ step: "token_refresh", ok: true });

  const vendorEmail = creds.gmailEmail ?? "";
  const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

  // ── Step 3: Profile ───────────────────────────────────────────────────────
  const profileRes = await fetch(`${GMAIL_BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json() as Record<string, unknown>;
  trace.push({ step: "gmail_profile", status: profileRes.status, email: profile.emailAddress, messagesTotal: profile.messagesTotal });

  // ── Step 4: Quick query probe (3 queries only) ────────────────────────────
  async function rawQuery(q: string) {
    const url = `${GMAIL_BASE}/messages?q=${encodeURIComponent(q)}&maxResults=5`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json() as Record<string, unknown>;
    return { status: res.status, ok: res.ok, count: Array.isArray(body.messages) ? (body.messages as unknown[]).length : 0, error: body.error ?? null };
  }

  const [q1, q2, q3] = await Promise.all([
    rawQuery("newer_than:14d"),
    rawQuery(`-from:${vendorEmail} newer_than:14d -in:trash -in:draft`),
    rawQuery(`from:${vendorEmail} newer_than:14d`),
  ]);
  trace.push({
    step: "query_probe",
    "newer_than:14d": q1,
    [`-from:vendor newer_than:14d`]: q2,
    [`from:vendor newer_than:14d`]: q3,
  });

  // ── Step 5: Fetch email list (no AI) ──────────────────────────────────────
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const afterDate = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, "0")}/${String(since.getDate()).padStart(2, "0")}`;

  const [sentEmails, receivedEmails] = await Promise.all([
    fetchParsedEmails(accessToken, vendorEmail, `from:${vendorEmail} after:${afterDate}`, 5),
    fetchParsedEmails(accessToken, vendorEmail, `-from:${vendorEmail} after:${afterDate} -in:trash -in:draft`, 5),
  ]);

  const unique = [...new Map([...sentEmails, ...receivedEmails].map((e) => [e.id, e])).values()];

  trace.push({
    step: "fetch_emails",
    sent_count: sentEmails.length,
    received_count: receivedEmails.length,
    unique_count: unique.length,
    emails: unique.map((e) => ({
      id: e.id,
      subject: e.subject,
      from: e.from,
      to: e.to,
      direction: e.direction,
      date: e.date.toISOString(),
      fromEmail: e.fromEmail,
      toEmails: e.toEmails,
      snippet: e.snippet?.slice(0, 120),
    })),
  });

  // ── Step 6: Dedup check for each email ────────────────────────────────────
  const dedupResults = await Promise.all(
    unique.map(async (e) => {
      const marker = `<!-- gmail:${e.id} -->`;
      const { data } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .like("description", `%${marker}%`)
        .maybeSingle();
      return { id: e.id, subject: e.subject, already_imported: !!data };
    })
  );
  trace.push({ step: "dedup_check", results: dedupResults });

  // ── Step 7: Company context check ─────────────────────────────────────────
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  trace.push({
    step: "company_context",
    has_agent_context: !!(settings.agent_context as string)?.trim(),
    agent_context_length: (settings.agent_context as string)?.length ?? 0,
  });

  return NextResponse.json({
    summary: `${unique.length} email(s) encontrados en los últimos 14 días`,
    next_step: unique.length > 0
      ? "Hay emails — usá el botón Reimportar todo para procesarlos"
      : "No hay emails — revisá query_probe para ver si la API responde",
    trace,
  });
}
