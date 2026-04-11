import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GMAIL_REDIRECT_URI,
  APP_URL,
  refreshGmailToken,
  fetchParsedEmails,
  getGmailProfile,
  type ParsedEmail,
} from "@/lib/gmail";
import { getContactContext } from "@/lib/contact-context";

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

  // Fetch sent emails (last 90 days) + received from known contacts
  const [sentEmails, receivedEmails] = await Promise.all([
    fetchParsedEmails(accessToken, vendorEmail, "is:sent newer_than:90d", 40),
    fetchParsedEmails(accessToken, vendorEmail, "is:inbox newer_than:90d", 40),
  ]);

  const all = [...sentEmails, ...receivedEmails];
  // Dedup by message ID
  const unique = [...new Map(all.map((e) => [e.id, e])).values()];

  // Get all contact emails for this company+vendor to filter irrelevant messages
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email, first_name, last_name, company_name, position")
    .eq("company_id", companyId)
    .not("email", "is", null);

  const contactByEmail = new Map(
    (contacts ?? []).map((c) => [c.email!.toLowerCase(), c])
  );

  let imported = 0;
  let skipped = 0;

  for (const email of unique) {
    const marker = `<!-- gmail:${email.id} -->`;

    // Check dedup
    const { data: existing } = await supabase
      .from("activities")
      .select("id")
      .eq("user_id", vendorId)
      .eq("company_id", companyId)
      .like("description", `%${marker}%`)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    // Find matching contact
    const contactEmail = email.direction === "sent"
      ? email.toEmails.find((e) => contactByEmail.has(e))
      : contactByEmail.has(email.fromEmail) ? email.fromEmail : null;

    if (!contactEmail) { skipped++; continue; } // skip emails unrelated to CRM contacts

    const contact = contactByEmail.get(contactEmail)!;

    // Build description
    const bodySnippet = email.snippet.slice(0, 800).trim();
    const dirLabel = email.direction === "sent" ? "Enviado a" : "Recibido de";
    const description = [
      `**${dirLabel}:** ${email.direction === "sent" ? email.to : email.from}`,
      bodySnippet || null,
      marker,
    ].filter(Boolean).join("\n\n");

    await supabase.from("activities").insert({
      company_id: companyId,
      user_id: vendorId,
      contact_id: contact.id,
      type: "email" as const,
      source: "automatic" as const,
      title: email.subject,
      description,
      completed_at: email.date.toISOString(),
    });

    imported++;
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
