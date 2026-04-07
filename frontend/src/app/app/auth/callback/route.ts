import { Buffer } from "buffer";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { OAUTH_INTENT_COOKIE } from "@/lib/workspace-activity";
import { normalizeEmail, syncWorkspaceUserFromAuth } from "@/modules/auth/queries";

type OAuthIntent = {
  email: string;
  mode: "login" | "register";
  remember: boolean;
  joinToken?: string | null;
};

function getFromEmail() {
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL_MISSING");
  }

  return process.env.RESEND_FROM_EMAIL;
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function buildOtpEmailHtml(code: string, recipientName?: string | null) {
  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #0b0f14; color: #f5f7fa; padding: 32px;">
      <div style="max-width: 520px; margin: 0 auto; border: 1px solid rgba(255,255,255,.08); border-radius: 20px; background: #111827; padding: 32px;">
        <div style="font-size: 12px; letter-spacing: .24em; text-transform: uppercase; color: #f97316; margin-bottom: 12px;">Dilbert</div>
        <h1 style="font-size: 28px; margin: 0 0 12px;">Tu código de acceso</h1>
        <p style="margin: 0 0 24px; color: #cbd5e1;">
          ${recipientName ? `Hola ${recipientName},` : "Hola,"} usá este código para continuar con tu registro.
        </p>
        <div style="font-size: 40px; letter-spacing: .32em; font-weight: 700; text-align: center; padding: 20px 0; border-radius: 16px; background: #020617; border: 1px solid rgba(255,255,255,.08);">
          ${code}
        </div>
      </div>
    </div>
  `;
}

async function sendOauthOtp(email: string, fullName?: string | null) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error) {
    throw error;
  }

  if (!data.properties.email_otp) {
    throw new Error("OTP_NOT_GENERATED");
  }

  await getResendClient().emails.send({
    from: getFromEmail(),
    to: email,
    subject: "Tu código de acceso a Dilbert",
    html: buildOtpEmailHtml(data.properties.email_otp, fullName),
  });
}

function buildRedirect(request: Request, params?: Record<string, string>) {
  const url = new URL("/app/", request.url);

  Object.entries(params || {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
}

async function readIntent() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(OAUTH_INTENT_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthIntent;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const cookieStore = await cookies();
  const intent = await readIntent();

  if (!code) {
    return buildRedirect(request, {
      oauth_error: "missing_intent",
    });
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    cookieStore.set(OAUTH_INTENT_COOKIE, "", { path: "/", maxAge: 0 });
    return buildRedirect(request, {
      oauth_error: "missing_intent",
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    cookieStore.set(OAUTH_INTENT_COOKIE, "", { path: "/", maxAge: 0 });
    return buildRedirect(request, {
      oauth_error: "missing_intent",
    });
  }

  const normalizedEmail = normalizeEmail(user.email);

  if (!intent) {
    cookieStore.set(OAUTH_INTENT_COOKIE, "", { path: "/", maxAge: 0 });
    return buildRedirect(request, {
      oauth_error: "missing_intent",
      email: normalizedEmail,
    });
  }

  if (normalizeEmail(intent.email) !== normalizedEmail) {
    await supabase.auth.signOut();
    cookieStore.set(OAUTH_INTENT_COOKIE, "", { path: "/", maxAge: 0 });
    return buildRedirect(request, {
      oauth_error: "email_mismatch",
      email: intent.email,
    });
  }

  cookieStore.set(OAUTH_INTENT_COOKIE, "", { path: "/", maxAge: 0 });

  if (intent.mode === "register") {
    await sendOauthOtp(
      normalizedEmail,
      String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim() || null
    );

    const response = buildRedirect(request, {
      step: "otp",
      email: normalizedEmail,
      otp_type: "magiclink",
      ...(intent.joinToken ? { join: intent.joinToken } : {}),
    });
    return response;
  }

  const result = await syncWorkspaceUserFromAuth({
    authUser: user,
    joinToken: intent.joinToken || null,
  });

  return NextResponse.redirect(new URL(result.redirectTo, request.url));
}
