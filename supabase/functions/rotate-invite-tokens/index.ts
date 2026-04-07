import { createClient } from "jsr:@supabase/supabase-js@2";

type InviteLinkRow = {
  id: string;
  company_id: string;
  token: string;
  expires_at: string;
  created_at: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function isExpired(dateString: string) {
  return new Date(dateString).getTime() <= Date.now();
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id")
    .eq("status", "active");

  if (companiesError) {
    return json({ error: companiesError.message }, 500);
  }

  let rotated = 0;

  for (const company of companies ?? []) {
    const { data: latestInviteData, error: inviteError } = await supabase
      .from("invite_links")
      .select("id, company_id, token, expires_at, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteError) {
      return json({ error: inviteError.message }, 500);
    }

    const latestInvite = latestInviteData as InviteLinkRow | null;

    if (latestInvite && !isExpired(latestInvite.expires_at)) {
      continue;
    }

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: deleteError } = await supabase
      .from("invite_links")
      .delete()
      .eq("company_id", company.id);

    if (deleteError) {
      return json({ error: deleteError.message }, 500);
    }

    const { error: insertError } = await supabase.from("invite_links").insert({
      company_id: company.id,
      token,
      expires_at: expiresAt,
    });

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    rotated += 1;
  }

  return json({
    ok: true,
    companies: companies?.length || 0,
    rotated,
  });
});
