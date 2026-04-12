/**
 * GET  /app/api/agent/questions  — list pending questions for the current vendor
 * POST /app/api/agent/questions  — answer or skip a question
 */

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { confirmLink } from "@/lib/agent/identity-resolver";
import { recordLearnedPreference } from "@/lib/agent/memory";

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

  if (action === "answer") {
    // 1. Confirm channel identity link
    if (linkToConfirm) {
      await confirmLink(
        session.user.companyId,
        linkToConfirm.contactId,
        linkToConfirm.channel,
        linkToConfirm.identifier
      );
    }

    // 2. Handle field_conflict: apply contact update if vendor says "sí"
    if (question.context) {
      try {
        const meta = JSON.parse(question.context) as {
          type?: string;
          contactId?: string;
          field?: string;
          newValue?: string;
        };

        if (
          meta.type === "field_conflict" &&
          meta.contactId &&
          meta.field &&
          meta.newValue
        ) {
          const userSaysYes = /^(s[íi]|yes|ok|actualiz|correcto|dale|anda|sip)/i.test(
            (answer ?? "").trim()
          );
          const userSaysNo = /^(no|manten|dejar|está bien así)/i.test(
            (answer ?? "").trim()
          );

          if (userSaysYes) {
            // Apply the update the agent detected
            await supabase
              .from("contacts")
              .update({ [meta.field]: meta.newValue })
              .eq("id", meta.contactId)
              .eq("company_id", session.user.companyId);
          }

          // Learn the preference either way (helps avoid future re-asks)
          if (userSaysYes || userSaysNo) {
            const preferenceKey = `field_${meta.field}_${meta.contactId.slice(0, 8)}`;
            const preferenceValue = userSaysYes
              ? `Para el campo "${meta.field}", el agente debe usar "${meta.newValue}" cuando lo detecte.`
              : `Para el campo "${meta.field}", el vendedor prefiere mantener el valor actual aunque el agente detecte uno diferente.`;
            await recordLearnedPreference(
              session.user.id,
              session.user.companyId,
              preferenceKey,
              preferenceValue
            );
          }
        }
      } catch {
        // context isn't JSON — ignore
      }
    }
  }

  return NextResponse.json({ ok: true });
}
