import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const config = {
  schedule: "@hourly",
};

type CompanyRow = {
  id: string;
};

type InviteLinkRow = {
  id: string;
  company_id: string;
  token: string;
  expires_at: string;
  created_at: string;
};

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

export default async function handler() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response("Missing Supabase env.", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id");

  if (companiesError) {
    return new Response(companiesError.message, { status: 500 });
  }

  for (const company of ((companies as CompanyRow[] | null) || [])) {
    const { data: latestInvite, error: inviteError } = await supabase
      .from("invite_links")
      .select("id, company_id, token, expires_at, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteError) {
      return new Response(inviteError.message, { status: 500 });
    }

    const invite = (latestInvite as InviteLinkRow | null) || null;
    if (invite && !isExpired(invite.expires_at)) {
      continue;
    }

    const { error: deleteError } = await supabase
      .from("invite_links")
      .delete()
      .eq("company_id", company.id);

    if (deleteError) {
      return new Response(deleteError.message, { status: 500 });
    }

    const { error: insertError } = await supabase.from("invite_links").insert({
      company_id: company.id,
      token: randomBytes(24).toString("hex"),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      return new Response(insertError.message, { status: 500 });
    }
  }

  return new Response("Invite links rotated.", { status: 200 });
}
