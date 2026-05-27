import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agent/orchestrator";

/**
 * Webhook receiver for Fathom meeting recordings.
 *
 * Auth: ?token=<userId> in the URL (Fathom doesn't support custom headers).
 *
 * This handler ONLY normalizes Fathom's payload into raw text and delegates to
 * the unified agent pipeline (runAgent). All CRM logic — identity resolution,
 * extraction, contact/lead/activity writing, idempotency — lives in the agent,
 * exactly like Gmail and WhatsApp. No parallel logic here.
 */

// ─── Fathom payload normalization ────────────────────────────────────────────
// Fathom's nested format (as of 2026):
// { "call": { "id", "name", "created_at" },
//   "recording": { "id", "share_url", "summary", "action_items", "transcript",
//                  "participants": [{ "name", "email" }] } }
// We also accept a flat fallback in case the format changes.

interface FathomParticipant {
  name?: string;
  email?: string;
}

interface NormalizedMeeting {
  /** Stable id of this recording — used for idempotency */
  externalId: string;
  title: string;
  date: string;
  participants: FathomParticipant[];
  summary: string;
  actionItems: string[];
  transcript: string;
  shareUrl: string;
}

function normalizeFathomPayload(raw: Record<string, unknown>): NormalizedMeeting {
  const call = raw.call as Record<string, unknown> | undefined;
  const recording = raw.recording as Record<string, unknown> | undefined;

  const title =
    (call?.name as string) || (raw.meeting_title as string) || (raw.title as string) || "Reunión";

  const date =
    (call?.created_at as string) ||
    (raw.meeting_date as string) ||
    (raw.started_at as string) ||
    new Date().toISOString();

  const rawParticipants =
    (recording?.participants as FathomParticipant[]) ||
    (raw.attendees as FathomParticipant[]) ||
    (raw.participants as FathomParticipant[]) ||
    [];
  const participants = Array.isArray(rawParticipants) ? rawParticipants : [];

  const rawSummary = recording?.summary ?? raw.summary;
  const summary =
    typeof rawSummary === "string"
      ? rawSummary
      : typeof rawSummary === "object" && rawSummary !== null
      ? ((rawSummary as Record<string, unknown>).text as string) ?? ""
      : "";

  const rawItems = (recording?.action_items as unknown[]) || (raw.action_items as unknown[]) || [];
  const actionItems = Array.isArray(rawItems)
    ? rawItems
        .map((item) =>
          typeof item === "string"
            ? item
            : typeof item === "object" && item !== null
            ? ((item as Record<string, unknown>).text as string) ?? ""
            : ""
        )
        .filter(Boolean)
    : [];

  const rawTranscript = recording?.transcript ?? raw.transcript;
  const transcript =
    typeof rawTranscript === "string"
      ? rawTranscript
      : Array.isArray(rawTranscript)
      ? rawTranscript
          .map((t: unknown) =>
            typeof t === "object" && t !== null
              ? `${(t as Record<string, unknown>).speaker ?? ""}: ${(t as Record<string, unknown>).text ?? ""}`
              : String(t)
          )
          .join("\n")
      : "";

  const shareUrl =
    (recording?.share_url as string) ||
    (raw.transcript_url as string) ||
    (raw.share_url as string) ||
    "";

  const externalId =
    (recording?.id as string) ||
    (call?.id as string) ||
    shareUrl ||
    (raw.id as string) ||
    `fathom:${title}:${date}`;

  return { externalId, title, date, participants, summary, actionItems, transcript, shareUrl };
}

// ─── Build the raw text the agent will analyse ────────────────────────────────
function buildRawText(meeting: NormalizedMeeting, vendorEmail: string): string {
  const externals = meeting.participants.filter(
    (p) => p.email && p.email.toLowerCase() !== vendorEmail
  );
  const parts = [
    `Reunión: ${meeting.title}`,
    externals.length
      ? `Participantes (clientes): ${externals.map((p) => `${p.name ?? ""} <${p.email}>`).join(", ")}`
      : "",
    meeting.summary ? `\nResumen:\n${meeting.summary}` : "",
    meeting.actionItems.length
      ? `\nProximos pasos / action items:\n${meeting.actionItems.map((a) => `• ${a}`).join("\n")}`
      : "",
    meeting.transcript ? `\nTranscripción:\n${meeting.transcript.slice(0, 8000)}` : "",
    meeting.shareUrl ? `\n[Ver en Fathom](${meeting.shareUrl})` : "",
  ];
  return parts.filter(Boolean).join("\n");
}

// ─── Webhook handler ──────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("token");
    if (!vendorId) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const rawBody = (await request.json()) as Record<string, unknown>;
    console.log("[webhook/fathom] raw payload:", JSON.stringify(rawBody).slice(0, 500));

    const supabase = createAdminSupabaseClient();

    // Resolve the vendor + company from the token
    const { data: vendorRow } = await supabase
      .from("users")
      .select("id, email, company_id")
      .eq("id", vendorId)
      .single();

    if (!vendorRow?.company_id) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const companyId = vendorRow.company_id;
    const vendorEmail = vendorRow.email?.toLowerCase() ?? "";

    const meeting = normalizeFathomPayload(rawBody);

    // The external attendee (not the vendor) is the contact this meeting is about.
    const externalAttendee = meeting.participants.find(
      (p) => p.email && p.email.toLowerCase() !== vendorEmail
    );

    // Delegate everything to the unified pipeline.
    const result = await runAgent({
      companyId,
      userId: vendorId,
      source: "fathom",
      rawText: buildRawText(meeting, vendorEmail),
      // Pass the attendee email as identifier — resolves by exact-email match.
      channelIdentifier: externalAttendee?.email?.toLowerCase(),
      senderName: externalAttendee?.name,
      occurredAt: meeting.date,
      externalId: meeting.externalId,
    });

    // Mark integration as active.
    await supabase
      .from("channel_credentials")
      .update({ status: "connected", last_sync_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("user_id", vendorId)
      .eq("channel", "fathom");

    console.log(`[webhook/fathom] recording:${meeting.externalId} → ${result.status} ${result.summary}`);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    console.error("[webhook/fathom]", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
