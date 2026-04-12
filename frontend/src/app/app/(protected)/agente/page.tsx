import { redirect } from "next/navigation";
import { requireSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { AgentInbox } from "@/components/agent-inbox";

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

  // Fetch related contacts separately (agent_questions has no FK in types)
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

export default async function AgentePage() {
  const session = await requireSession();
  if (!session?.user?.companyId) redirect("/app/account");

  const questions = await getQuestions(session.user.companyId, session.user.id);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Agente IA</h1>
        <p className="text-muted-foreground text-sm mt-1">
          El agente procesa tus conversaciones de WhatsApp, emails y reuniones automáticamente.
          Acá te muestra lo que necesita tu confirmación.
        </p>
      </div>
      <AgentInbox initialQuestions={questions} />
    </div>
  );
}
