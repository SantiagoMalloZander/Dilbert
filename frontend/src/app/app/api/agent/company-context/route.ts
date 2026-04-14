/**
 * GET  /app/api/agent/company-context  — load current context
 * POST /app/api/agent/company-context  — save context (owner only)
 *
 * Stored in companies.settings.agent_context (JSONB).
 */
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", session.user.companyId)
    .single();

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  return NextResponse.json({ context: (settings.agent_context as string) ?? "" });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (session.user.role !== "owner") {
    return NextResponse.json({ error: "Solo el owner puede modificar el contexto." }, { status: 403 });
  }

  const { context } = await request.json() as { context: string };
  if (typeof context !== "string") {
    return NextResponse.json({ error: "Contexto inválido." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Load current settings and merge
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", session.user.companyId)
    .single();

  const current = (company?.settings ?? {}) as Record<string, unknown>;
  await supabase
    .from("companies")
    .update({ settings: { ...current, agent_context: context.trim() } })
    .eq("id", session.user.companyId);

  return NextResponse.json({ ok: true });
}
