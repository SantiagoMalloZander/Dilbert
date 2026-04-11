import { redirect } from "next/navigation";
import { requireSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { MeetingsInbox } from "@/components/meetings-inbox";

async function getMeetings(companyId: string, userId: string, role: string) {
  const supabase = createAdminSupabaseClient();

  const query = supabase
    .from("activities")
    .select(`
      id, title, description, completed_at, created_at, contact_id, lead_id,
      contacts ( id, first_name, last_name, email, phone, company_name, position ),
      leads ( id, title, value, currency, probability, expected_close_date, status,
        pipeline_stages ( name ) )
    `)
    .eq("company_id", companyId)
    .eq("type", "meeting")
    .eq("source", "automatic")
    .order("completed_at", { ascending: false })
    .limit(30);

  if (role === "vendor") {
    query.eq("user_id", userId);
  }

  const { data } = await query;
  return data ?? [];
}

export default async function MeetingsPage() {
  const session = await requireSession();

  if (!session.user.companyId) redirect("/app/pending-access");
  if (session.user.role === "analyst") redirect("/app/crm");

  const meetings = await getMeetings(
    session.user.companyId,
    session.user.id,
    session.user.role
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Reuniones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reuniones procesadas automáticamente desde Google Meet, Zoom y Teams via Fathom.
        </p>
      </div>
      <MeetingsInbox meetings={meetings as any} />
    </div>
  );
}
