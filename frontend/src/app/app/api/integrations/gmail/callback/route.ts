import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GMAIL_REDIRECT_URI,
  APP_URL,
  getGmailProfile,
} from "@/lib/gmail";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REDIRECT_ERR = `${APP_URL}/app/integrations?gmail=error`;

// ─── OAuth callback ────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    console.error("[gmail/callback] error:", error);
    return NextResponse.redirect(REDIRECT_ERR);
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: GMAIL_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("[gmail/callback] token exchange failed", await tokenRes.text());
    return NextResponse.redirect(REDIRECT_ERR);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.refresh_token) {
    console.error("[gmail/callback] no refresh_token in response");
    return NextResponse.redirect(REDIRECT_ERR);
  }

  // Get the Gmail address this token belongs to
  const profile = await getGmailProfile(tokens.access_token);
  const gmailEmail = profile?.email?.toLowerCase() ?? "";

  const supabase = createAdminSupabaseClient();

  const { data: user } = await supabase
    .from("users")
    .select("company_id, email, name")
    .eq("id", userId)
    .single();

  if (!user?.company_id) {
    return NextResponse.redirect(REDIRECT_ERR);
  }

  const companyId = user.company_id;
  const vendorEmail = gmailEmail || (user.email?.toLowerCase() ?? "");

  // Persist credentials — set last_sync_at to 14 days ago so first sync picks up history
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("channel_credentials").upsert(
    {
      company_id: companyId,
      user_id: userId,
      channel: "gmail",
      credentials: {
        refreshToken: tokens.refresh_token,
        gmailEmail: vendorEmail,
        connectedAt: new Date().toISOString(),
      },
      status: "connected",
      last_sync_at: fourteenDaysAgo,
    },
    { onConflict: "user_id,channel" }
  );

  // Redirect with auto_process=true so the frontend kicks off sync+process immediately
  return NextResponse.redirect(`${APP_URL}/app/integrations?gmail=connected&auto_process=true`);
}
