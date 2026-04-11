import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import {
  GOOGLE_CLIENT_ID,
  GMAIL_REDIRECT_URI,
  GMAIL_SCOPES,
} from "@/lib/gmail";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.redirect(new URL("/login", "https://dilvert.netlify.app"));
  }

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: "Google OAuth no configurado." }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GMAIL_REDIRECT_URI,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",            // force refresh_token on every connect
    state: session.user.id,       // carry userId through the OAuth flow
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
