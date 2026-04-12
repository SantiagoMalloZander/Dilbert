/**
 * GET  /app/api/agent/questions  — list pending questions for the current vendor
 * POST /app/api/agent/questions  — answer or skip a question
 */

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { confirmLink } from "@/lib/agent/identity-resolver";
import { recordLearnedPreference } from "@/lib/agent/memory";
import { runAgent } from "@/lib/agent/orchestrator";
import type { DataSource } from "@/lib/agent/data-extractor";
import type { Channel } from "@/lib/agent/identity-resolver";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  const supabase = createAdminSupabaseClient();

  const query = supabase
    .from("agent_questions")
    .select(`
      id, question, context, status, answer, created_at, answered_at,
      contact_id,
      contacts ( id, first_name, last_name, company_name, email, phone )
    `)
    .eq("company_id", session.user.companyId)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query.eq("status", status as "pending" | "answered" | "skipped");
  }

  const { data, error } = await query;
  if (error) {
    console.error("[agent/questions GET]", error);
    return NextResponse.json({ error: "Error al obtener preguntas." }, { status: 500 });
  }

  return NextResponse.json({ questions: data ?? [] });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

interface AnswerBody {
  questionId: string;
  action: "answer" | "skip";
  answer?: string;
  /**
   * Optional: if the question was about contact identity, confirm the link
   * so the agent learns and never asks again.
   */
  confirmLink?: {
    contactId: string;
    channel: "whatsapp" | "gmail" | "fathom" | "manual";
    identifier: string;
  };
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = (await request.json()) as AnswerBody;
  const { questionId, action, answer, confirmLink: linkToConfirm } = body;

  if (!questionId || !action) {
    return NextResponse.json({ error: "Faltan campos." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Verify the question belongs to this vendor
  const { data: question } = await supabase
    .from("agent_questions")
    .select("id, status, contact_id, context")
    .eq("id", questionId)
    .eq("company_id", session.user.companyId)
    .eq("user_id", session.user.id)
    .single();

  if (!question) {
    return NextResponse.json({ error: "Pregunta no encontrada." }, { status: 404 });
  }

  if (question.status !== "pending") {
    return NextResponse.json({ error: "Esta pregunta ya fue respondida." }, { status: 409 });
  }

  // Update the question
  const now = new Date().toISOString();
  await supabase
    .from("agent_questions")
    .update({
      status: action === "answer" ? "answered" : "skipped",
      answer: answer ?? null,
      answered_at: now,
    })
    .eq("id", questionId);

  // ── Apply structured actions from the context ────────────────────────────

  if (action === "answer" && question.context) {
    try {
      const meta = JSON.parse(question.context) as {
        type?: string;
        // identity_unknown fields
        source?: DataSource;
        channel?: Channel;
        channelIdentifier?: string | null;
        rawText?: string;
        occurredAt?: string;
        senderName?: string | null;
        // field_conflict fields
        contactId?: string;
        field?: string;
        newValue?: string;
      };

      // ── Case 1: vendor answered who the unknown contact is ─────────────────
      if (meta.type === "identity_unknown" && answer?.trim()) {
        // Search for the contact by name or email from the vendor's answer
        const searchTerm = answer.trim();
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone")
          .eq("company_id", session.user.companyId)
          .or(
            `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
          )
          .limit(3);

        const contact = contacts?.[0] ?? null;

        if (contact) {
          // Register the channel link so the agent recognises this next time
          if (meta.channel && meta.channelIdentifier) {
            await confirmLink(
              session.user.companyId,
              contact.id,
              meta.channel,
              meta.channelIdentifier
            );
          }

          // Also confirm the explicit confirmLink if the UI sent one
          if (linkToConfirm) {
            await confirmLink(
              session.user.companyId,
              linkToConfirm.contactId,
              linkToConfirm.channel,
              linkToConfirm.identifier
            );
          }

          // Re-run the orchestrator with the now-resolved contactId (fire-and-forget)
          if (meta.rawText && meta.source) {
            runAgent({
              companyId: session.user.companyId,
              userId: session.user.id,
              source: meta.source,
              rawText: meta.rawText,
              channelIdentifier: meta.channelIdentifier ?? undefined,
              senderName: meta.senderName ?? undefined,
              occurredAt: meta.occurredAt,
              resolvedContactId: contact.id,
            }).catch((err) => console.error("[questions/replay]", err));
          }
        }
      }

      // ── Case 2: vendor answered a field conflict ───────────────────────────
      if (meta.type === "field_conflict" && meta.contactId && meta.field && meta.newValue) {
        const answerText = (answer ?? "").trim();
        const userSaysYes = /^(s[íi]|yes|ok|actualiz|correcto|dale|anda|sip)/i.test(answerText);
        const userSaysNo  = /^(no|manten|dejar|está bien así)/i.test(answerText);

        if (userSaysYes) {
          await supabase
            .from("contacts")
            .update({ [meta.field]: meta.newValue })
            .eq("id", meta.contactId)
            .eq("company_id", session.user.companyId);
        }

        if (userSaysYes || userSaysNo) {
          await recordLearnedPreference(
            session.user.id,
            session.user.companyId,
            `field_${meta.field}_${meta.contactId.slice(0, 8)}`,
            userSaysYes
              ? `Para el campo "${meta.field}", usar "${meta.newValue}" cuando el agente lo detecte.`
              : `Para el campo "${meta.field}", mantener el valor actual aunque el agente detecte uno diferente.`
          );
        }
      }
    } catch {
      // context not JSON or malformed — no-op
    }
  }

  // Explicit confirmLink (without context replay)
  if (action === "answer" && linkToConfirm && !question.context) {
    await confirmLink(
      session.user.companyId,
      linkToConfirm.contactId,
      linkToConfirm.channel,
      linkToConfirm.identifier
    );
  }

  return NextResponse.json({ ok: true });
}
