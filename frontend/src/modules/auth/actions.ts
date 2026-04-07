"use server";

import { Buffer } from "buffer";
import { randomInt } from "crypto";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  BROWSER_SESSION_COOKIE,
  OAUTH_INTENT_COOKIE,
  REMEMBER_COOKIE,
} from "@/lib/workspace-activity";
import type {
  AuthOtpType,
  EmailStatusResult,
  RegistrationResult,
  RequestOtpResult,
} from "@/modules/auth/types";
import {
  findAuthUserByEmail,
  getPendingAccessMessage,
  normalizeEmail,
  syncWorkspaceUserFromAuth,
} from "@/modules/auth/queries";

const passwordRule = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const emailSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
});

const requestOtpSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  fullName: z.string().min(2, "Ingresá tu nombre completo."),
  password: z
    .string()
    .regex(
      passwordRule,
      "La contraseña debe tener al menos 8 caracteres, 1 número y 1 carácter especial."
    ),
  joinToken: z.string().min(8).optional(),
});

const oauthPrepareSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  mode: z.enum(["login", "register"]),
  remember: z.boolean().default(true),
  joinToken: z.string().min(8).optional(),
});

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function getFromEmail() {
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL_MISSING");
  }

  return process.env.RESEND_FROM_EMAIL;
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
        <p style="margin: 24px 0 0; color: #94a3b8; font-size: 14px;">
          El código vence en unos minutos. Si no lo pediste, podés ignorar este email.
        </p>
      </div>
    </div>
  `;
}

function buildWelcomeEmailHtml(fullName?: string | null) {
  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #0b0f14; color: #f5f7fa; padding: 32px;">
      <div style="max-width: 520px; margin: 0 auto; border: 1px solid rgba(255,255,255,.08); border-radius: 20px; background: #111827; padding: 32px;">
        <div style="font-size: 12px; letter-spacing: .24em; text-transform: uppercase; color: #f97316; margin-bottom: 12px;">Dilbert</div>
        <h1 style="font-size: 28px; margin: 0 0 12px;">Bienvenido a Dilbert</h1>
        <p style="margin: 0 0 16px; color: #cbd5e1;">
          ${fullName ? `Hola ${fullName},` : "Hola,"} tu cuenta ya quedó creada correctamente.
        </p>
        <p style="margin: 0; color: #94a3b8; font-size: 14px;">
          Entrá a <strong>dilvert.netlify.app/app</strong> para acceder a tu workspace.
        </p>
      </div>
    </div>
  `;
}

async function sendOtpEmail(params: {
  email: string;
  code: string;
  fullName?: string | null;
}) {
  const resend = getResendClient();

  await resend.emails.send({
    from: getFromEmail(),
    to: params.email,
    subject: "Tu código de acceso a Dilbert",
    html: buildOtpEmailHtml(params.code, params.fullName),
  });
}

async function sendWelcomeEmail(params: {
  email: string;
  fullName?: string | null;
}) {
  const resend = getResendClient();

  await resend.emails.send({
    from: getFromEmail(),
    to: params.email,
    subject: "Bienvenido a Dilbert",
    html: buildWelcomeEmailHtml(params.fullName),
  });
}

async function generateCustomOtp(params: {
  type: AuthOtpType;
  email: string;
  password?: string;
  fullName?: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  if (params.type === "signup" && !params.password) {
    throw new Error("PASSWORD_REQUIRED_FOR_SIGNUP");
  }

  const response =
    params.type === "signup"
      ? await supabase.auth.admin.generateLink({
          type: "signup",
          email: params.email,
          password: params.password!,
          options: {
            data: {
              full_name: params.fullName || params.email,
              name: params.fullName || params.email,
            },
          },
        })
      : await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: params.email,
        });

  const { data, error } = response;

  if (error) {
    throw error;
  }

  const otpCode = data.properties.email_otp;
  if (!otpCode) {
    throw new Error("OTP_NOT_GENERATED");
  }

  return otpCode;
}

function applyRememberPreference(cookieStore: Awaited<ReturnType<typeof cookies>>, remember: boolean) {
  cookieStore.set(BROWSER_SESSION_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
  });

  if (remember) {
    cookieStore.set(REMEMBER_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    });
  } else {
    cookieStore.set(REMEMBER_COOKIE, "", {
      path: "/",
      sameSite: "lax",
      maxAge: 0,
    });
  }
}

export async function lookupEmailAction(input: { email: string }): Promise<EmailStatusResult> {
  const { email } = emailSchema.parse(input);
  const normalized = normalizeEmail(email);
  const existingAuthUser = await findAuthUserByEmail(normalized);

  return {
    exists: Boolean(existingAuthUser),
    email: normalized,
  };
}

export async function requestRegistrationOtpAction(
  input: z.infer<typeof requestOtpSchema>
): Promise<RequestOtpResult> {
  const { email, fullName, password } = requestOtpSchema.parse(input);
  const normalized = normalizeEmail(email);
  const existingAuthUser = await findAuthUserByEmail(normalized);

  if (existingAuthUser) {
    throw new Error("Ese email ya existe. Iniciá sesión.");
  }

  const code = await generateCustomOtp({
    type: "signup",
    email: normalized,
    password,
    fullName,
  });

  await sendOtpEmail({
    email: normalized,
    code,
    fullName,
  });

  return {
    ok: true,
    email: normalized,
    otpType: "signup",
  };
}

export async function prepareOauthFlowAction(
  input: z.infer<typeof oauthPrepareSchema>
) {
  const { email, mode, remember, joinToken } = oauthPrepareSchema.parse(input);
  const cookieStore = await cookies();

  const encoded = Buffer.from(
    JSON.stringify({
      email: normalizeEmail(email),
      mode,
      remember,
      joinToken: joinToken || null,
      nonce: randomInt(100_000, 999_999).toString(),
    })
  ).toString("base64url");

  cookieStore.set(OAUTH_INTENT_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  applyRememberPreference(cookieStore, remember);

  return {
    ok: true,
    mode,
  };
}

export async function requestOauthOtpAction(input: {
  email: string;
  fullName?: string | null;
}) {
  const { email } = emailSchema.parse(input);
  const normalized = normalizeEmail(email);

  const code = await generateCustomOtp({
    type: "magiclink",
    email: normalized,
    fullName: input.fullName,
  });

  await sendOtpEmail({
    email: normalized,
    code,
    fullName: input.fullName,
  });

  return {
    ok: true,
    email: normalized,
    otpType: "magiclink" as const,
  };
}

export async function finalizeRegistrationAction(input: {
  email: string;
  joinToken?: string | null;
}): Promise<RegistrationResult> {
  const { email } = emailSchema.parse(input);
  const normalized = normalizeEmail(email);
  const authUser = await findAuthUserByEmail(normalized);

  if (!authUser) {
    throw new Error("No pude encontrar tu cuenta en Supabase Auth.");
  }

  const result = await syncWorkspaceUserFromAuth({
    authUser,
    joinToken: input.joinToken || null,
  });

  await sendWelcomeEmail({
    email: normalized,
    fullName:
      String(authUser.user_metadata?.full_name || authUser.user_metadata?.name || "").trim() ||
      null,
  });

  if (result.status === "pending_access") {
    return {
      status: "pending_access",
      redirectTo: "/app/pending-access",
      message: getPendingAccessMessage(),
    };
  }

  return {
    status: "authorized",
    redirectTo: result.redirectTo === "/app/admin" ? "/app/admin" : "/app/crm",
    companyId: result.appUser?.company_id || "",
    role: (result.appUser?.role || "analyst") as "owner" | "analyst" | "vendor",
  };
}

export async function syncExistingUserAccessAction(input: {
  email: string;
  joinToken?: string | null;
}) {
  const { email } = emailSchema.parse(input);
  const normalized = normalizeEmail(email);
  const authUser = await findAuthUserByEmail(normalized);

  if (!authUser) {
    throw new Error("No pude encontrar tu cuenta en Supabase Auth.");
  }

  const result = await syncWorkspaceUserFromAuth({
    authUser,
    joinToken: input.joinToken || null,
  });

  return {
    redirectTo: result.redirectTo,
  };
}
