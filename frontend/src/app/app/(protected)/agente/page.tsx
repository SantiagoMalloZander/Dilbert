import { redirect } from "next/navigation";
import { requireSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { AgentInbox } from "@/components/agent-inbox";
import { AgentCompanyContext } from "@/components/agent-company-context";
import { AgentVoiceButton } from "@/components/agent-voice-button";

async function getCompanyContext(companyId: string): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  return (settings.agent_context as string) ?? "";
}

async function getQuestions(companyId: string, userId: string) {
  const supabase = createAdminSupabaseClient();

  const { data: questions } = await supabase
    .from("agent_questions")
    .select("id, question, context, status, answer, created_at, answered_at, contact_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!questions?.length) return [];

  const contactIds = [...new Set(questions.map((q) => q.contact_id).filter(Boolean))] as string[];
  const { data: contacts } = contactIds.length
    ? await supabase
        .from("contacts")
        .select("id, first_name, last_name, company_name, email, phone")
        .in("id", contactIds)
    : { data: [] };

  const contactMap = new Map((contacts ?? []).map((c) => [c.id, c]));
  return questions.map((q) => ({
    ...q,
    contacts: q.contact_id ? (contactMap.get(q.contact_id) ?? null) : null,
  }));
}

async function getRecentActivity(companyId: string, userId: string) {
  const supabase = createAdminSupabaseClient();

  const { data: activities } = await supabase
    .from("activities")
    .select(`
      id, type, title, description, completed_at, created_at, contact_id, lead_id,
      contacts ( id, first_name, last_name, company_name ),
      leads ( id, title )
    `)
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("source", "automatic")
    .order("created_at", { ascending: false })
    .limit(20);

  return activities ?? [];
}

export default async function AgentePage() {
  const session = await requireSession();
  if (!session?.user?.companyId) redirect("/app/account");

  const isOwner = session.user.role === "owner";

  const [questions, activities, companyContext] = await Promise.all([
    getQuestions(session.user.companyId, session.user.id),
    getRecentActivity(session.user.companyId, session.user.id),
    isOwner ? getCompanyContext(session.user.companyId) : Promise.resolve(""),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agente IA</h1>
        <p className="text-muted-foreground text-sm mt-1">
          El agente procesa tus conversaciones de WhatsApp, emails y reuniones automáticamente.
          Acá te muestra lo que necesita tu confirmación y un log de lo que hizo.
        </p>
      </div>

      {/* Voice recording */}
      <div className="rounded-2xl border border-white/10 bg-card/90 p-6">
        <p className="text-sm font-medium text-foreground mb-1">Cargar llamada o reunión presencial</p>
        <p className="text-xs text-muted-foreground mb-4">Grabá lo que hablaste y el agente crea el contacto y el lead automáticamente.</p>
        <AgentVoiceButton />
      </div>

      {isOwner && (
        <AgentCompanyContext initialContext={companyContext} />
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <AgentInbox initialQuestions={questions as any} initialActivities={activities as any} />
    </div>
  );
}
