/**
 * GET /app/api/agent/activity
 * Returns the last N activities created automatically by the agent (source = "automatic").
 */
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("activities")
    .select(`
      id, type, title, description, completed_at, created_at, contact_id, lead_id,
      contacts ( id, first_name, last_name, company_name ),
      leads ( id, title )
    `)
    .eq("company_id", session.user.companyId)
    .eq("user_id", session.user.id)
    .eq("source", "automatic")
    .order("created_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({ activities: data ?? [] });
}
