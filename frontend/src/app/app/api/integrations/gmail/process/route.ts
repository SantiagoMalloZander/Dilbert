/**
 * POST /app/api/integrations/gmail/process
 *
 * Picks the oldest pending email from gmail_queue for this user,
 * runs the full AI agent pipeline on it, writes to CRM, then
 * deletes the queue row.
 *
 * Returns:
 *   { processed: 1, remaining: N, status, contactId }  — one email processed
 *   { processed: 0, remaining: 0 }                     — queue empty
 *
 * The browser calls this in a loop until remaining === 0.
 * Each call takes ~2s (one OpenAI call), well within Netlify's 10s limit.
 */
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agent/orchestrator";

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const userId = session.user.id;
  const companyId = session.user.companyId;
  const supabase = createAdminSupabaseClient();

  // ── How many are left? ────────────────────────────────────────────────────
  const { count } = await supabase
    .from("gmail_queue")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("company_id", companyId);

  const remaining = count ?? 0;

  if (remaining === 0) {
    return NextResponse.json({ processed: 0, remaining: 0 });
  }

  // ── Pick the oldest item ──────────────────────────────────────────────────
  const { data: row, error: fetchErr } = await supabase
    .from("gmail_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ processed: 0, remaining });
  }

  // ── Run the AI agent pipeline ─────────────────────────────────────────────
  let agentStatus = "error";
  let contactId: string | null = null;

  try {
    const result = await runAgent({
      companyId,
      userId,
      source: "gmail",
      rawText: row.raw_text as string,
      channelIdentifier: row.external_email as string,
      senderName: (row.sender_name as string | null) ?? undefined,
      occurredAt: row.occurred_at as string,
    });

    agentStatus = result.status;
    contactId = result.contactId;

    console.log(`[gmail/process] email:${row.email_id} → ${result.status} contact:${contactId}`);
  } catch (err) {
    console.error(`[gmail/process] error on email:${row.email_id}`, err);
  }

  // ── Delete from queue regardless of outcome ───────────────────────────────
  // A failed email stays out — don't retry infinitely.
  await supabase
    .from("gmail_queue")
    .delete()
    .eq("id", row.id);

  return NextResponse.json({
    processed: 1,
    remaining: Math.max(0, remaining - 1),
    status: agentStatus,
    contactId,
    emailId: row.email_id,
  });
}
