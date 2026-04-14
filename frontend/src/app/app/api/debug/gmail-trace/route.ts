/**
 * GET /app/api/debug/gmail-trace
 *
 * Runs the Gmail sync pipeline step-by-step with full tracing.
 * Returns a JSON report showing exactly what happens with each email.
 * Use this to diagnose why emails aren't being imported.
 */
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { refreshGmailToken, fetchParsedEmails } from "@/lib/gmail";
import { resolveIdentity } from "@/lib/agent/identity-resolver";
import { extractStructuredData } from "@/lib/agent/data-extractor";

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

  // ── Step 3: Raw Gmail API probe — test several queries to find what works ──
  const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

  async function rawQuery(q: string, max = 5) {
    const url = `${GMAIL_BASE}/messages?q=${encodeURIComponent(q)}&maxResults=${max}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json() as Record<string, unknown>;
    return { status: res.status, ok: res.ok, count: Array.isArray(body.messages) ? (body.messages as unknown[]).length : 0, raw: body };
  }

  // Profile check
  const profileRes = await fetch(`${GMAIL_BASE}/profile`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const profile = await profileRes.json() as Record<string, unknown>;
  trace.push({ step: "gmail_profile", status: profileRes.status, profile });

  // Try multiple queries from simple to complex
  const queries = [
    "in:inbox",
    "newer_than:30d",
    `-from:${vendorEmail} newer_than:30d`,
    `-from:${vendorEmail} newer_than:30d -in:trash -in:draft`,
    `from:orbitalcreators@gmail.com`,
    `after:2026/03/31`,
    `-from:${vendorEmail} after:2026/03/31 -in:trash -in:draft`,
    `from:${vendorEmail} after:2026/03/31`,
  ];

  const queryResults: Record<string, unknown>[] = [];
  for (const q of queries) {
    const r = await rawQuery(q, 5);
    queryResults.push({ query: q, ...r });
  }
  trace.push({ step: "query_probe", results: queryResults });

  // ── Step 4: Fetch emails with the query that returns results ──────────────
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const afterDate = [
    since.getFullYear(),
    String(since.getMonth() + 1).padStart(2, "0"),
    String(since.getDate()).padStart(2, "0"),
  ].join("/");

  const [sentEmails, receivedEmails] = await Promise.all([
    fetchParsedEmails(accessToken, vendorEmail, `from:${vendorEmail} after:${afterDate}`, 10),
    fetchParsedEmails(accessToken, vendorEmail, `-from:${vendorEmail} after:${afterDate} -in:trash -in:draft`, 10),
  ]);

  const unique = [...new Map(
    [...sentEmails, ...receivedEmails].map((e) => [e.id, e])
  ).values()];

  trace.push({
    step: "fetch_emails",
    query_after: afterDate,
    vendor_email: vendorEmail,
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
    })),
  });

  if (unique.length === 0) {
    return NextResponse.json({
      summary: "No se encontraron emails — revisá query_probe arriba para ver qué queries sí devuelven resultados.",
      trace,
    });
  }

  // ── Step 4: Trace each email through the pipeline ────────────────────────
  for (const email of unique) {
    const emailTrace: Record<string, unknown> = {
      step: "email_pipeline",
      id: email.id,
      subject: email.subject,
      direction: email.direction,
    };

    const marker = `<!-- gmail:${email.id} -->`;

    // Dedup check
    const { data: existingActivity } = await supabase
      .from("activities")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .like("description", `%${marker}%`)
      .maybeSingle();

    emailTrace.dedup_marker = marker;
    emailTrace.already_imported = !!existingActivity;
    if (existingActivity) {
      emailTrace.result = "SKIP — ya importado (actividad existente con este marker)";
      trace.push(emailTrace);
      continue;
    }

    // External email
    const externalEmail = email.direction === "sent"
      ? email.toEmails[0]
      : email.fromEmail;

    emailTrace.external_email = externalEmail ?? "(no encontrado)";

    if (!externalEmail || externalEmail === vendorEmail) {
      emailTrace.result = "SKIP — email interno (de/para el mismo vendedor)";
      trace.push(emailTrace);
      continue;
    }

    // Identity resolution
    const resolved = await resolveIdentity({
      companyId,
      channel: "gmail",
      identifier: externalEmail.toLowerCase(),
    });

    emailTrace.identity_resolved = !!resolved;
    emailTrace.contact_id = resolved?.contactId ?? null;
    emailTrace.resolution_method = resolved?.method ?? "none";

    // Existing contact check in contacts table
    const { data: contactByEmail } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .eq("company_id", companyId)
      .eq("email", externalEmail.toLowerCase())
      .maybeSingle();

    emailTrace.contact_by_email_in_db = contactByEmail ?? null;

    // Check existing contact_channel_links
    const { data: channelLink } = await supabase
      .from("contact_channel_links")
      .select("id, contact_id, confidence")
      .eq("company_id", companyId)
      .eq("channel", "gmail")
      .eq("identifier", externalEmail.toLowerCase())
      .maybeSingle();

    emailTrace.channel_link_in_db = channelLink ?? null;

    // Quick AI extraction (dry run — no DB writes)
    const rawText = [
      marker,
      `Asunto: ${email.subject}`,
      `De: ${email.from}`,
      `Para: ${email.to}`,
      email.snippet,
    ].filter(Boolean).join("\n\n");

    emailTrace.raw_text_preview = rawText.slice(0, 300);

    const extracted = await extractStructuredData(rawText, "gmail", {
      knownContactName: email.direction === "received"
        ? email.from.split("<")[0].trim() || undefined
        : undefined,
    });

    emailTrace.ai_extraction = {
      first_name: extracted.contact_info.first_name,
      last_name: extracted.contact_info.last_name,
      email: extracted.contact_info.email,
      has_purchase_intent: extracted.has_purchase_intent,
      is_relevant_for_crm: extracted.is_relevant_for_crm,
      is_relevant_raw_value: (extracted as unknown as Record<string, unknown>).is_relevant_for_crm,
      deal_title: extracted.deal_info.title,
      sentiment: extracted.sentiment,
      crm_note: extracted.crm_note,
      confidence: extracted.confidence_level,
      topics: extracted.topics,
    };

    // Check if activities table has the right schema
    const { error: schemaTestErr } = await supabase
      .from("activities")
      .select("id")
      .limit(0);

    emailTrace.activities_table_accessible = !schemaTestErr;
    if (schemaTestErr) {
      emailTrace.activities_table_error = schemaTestErr.message;
    }

    // Check if default pipeline exists
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("is_default", true)
      .maybeSingle();

    emailTrace.default_pipeline = pipeline ?? null;

    emailTrace.result = "READY_TO_IMPORT — ejecutá Reimportar todo para procesar";
    trace.push(emailTrace);
  }

  return NextResponse.json({ summary: `${unique.length} email(s) encontrados`, trace }, { status: 200 });
}
