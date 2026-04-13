import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GMAIL_REDIRECT_URI,
  APP_URL,
  fetchParsedEmails,
  getGmailProfile,
} from "@/lib/gmail";
import { runAgent } from "@/lib/agent/orchestrator";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REDIRECT_OK = `${APP_URL}/app/integrations?gmail=connected`;
const REDIRECT_ERR = `${APP_URL}/app/integrations?gmail=error`;

// ─── Import historical sent + received emails ─────────────────────────────────
async function importEmails(
  accessToken: string,
  vendorId: string,
  companyId: string,
  vendorEmail: string
): Promise<{ imported: number; skipped: number }> {
  const supabase = createAdminSupabaseClient();

  const [sentEmails, receivedEmails] = await Promise.all([
    fetchParsedEmails(accessToken, vendorEmail, `from:${vendorEmail} newer_than:90d`, 40),
    fetchParsedEmails(accessToken, vendorEmail, `-from:${vendorEmail} newer_than:90d -in:trash -in:draft`, 40),
  ]);

  const unique = [...new Map(
    [...sentEmails, ...receivedEmails].map((e) => [e.id, e])
  ).values()];

  let imported = 0;
  let skipped = 0;

  for (const email of unique) {
    try {
      const marker = `<!-- gmail:${email.id} -->`;

      // Dedup check
      const { data: existing } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", vendorId)
        .eq("company_id", companyId)
        .like("description", `%${marker}%`)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      const externalEmail = email.direction === "sent"
        ? email.toEmails[0]
        : email.fromEmail;

      if (!externalEmail || externalEmail === vendorEmail) { skipped++; continue; }

      // Marker goes FIRST so it's always within the 600-char CRM snippet (dedup)
      const rawText = [
        marker,
        `Asunto: ${email.subject}`,
        `De: ${email.from}`,
        `Para: ${email.to}`,
        email.snippet,
      ].filter(Boolean).join("\n\n");

      const result = await runAgent({
        companyId,
        userId: vendorId,
        source: "gmail",
        rawText,
        channelIdentifier: externalEmail.toLowerCase(),
        senderName: email.direction === "received" ? email.from.split("<")[0].trim() || undefined : undefined,
        occurredAt: email.date.toISOString(),
      });

      if (result.status === "ok" || result.status === "new_contact") {
        imported++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[gmail/callback] email ${email.id}:`, err);
      skipped++;
    }
  }

  return { imported, skipped };
}

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

  // Persist credentials
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
      last_sync_at: new Date().toISOString(),
    },
    { onConflict: "user_id,channel" }
  );

  // Fire-and-forget historical import (don't block the redirect)
  importEmails(tokens.access_token, userId, companyId, vendorEmail).catch((err) =>
    console.error("[gmail/callback] import error:", err)
  );

  return NextResponse.redirect(REDIRECT_OK);
}
