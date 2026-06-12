"use server";

import { Buffer } from "buffer";
import { randomInt } from "crypto";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr";
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
  getAppUserByEmail,
  getAuthorizedEmailByEmail,
  getPendingAccessMessage,
  normalizeEmail,
  syncWorkspaceUserFromAuth,
} from "@/modules/auth/queries";
import { isSuperAdminEmail } from "@/lib/workspace-roles";

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

  const [existingAuthUser, appUser, authorizedEmail] = await Promise.all([
    findAuthUserByEmail(normalized),
    getAppUserByEmail(normalized),
    getAuthorizedEmailByEmail(normalized),
  ]);

  // "Verified" = registration fully completed. We gate the password screen on
  // this so a half-finished signup (auth user exists but never verified) can
  // never slip in via password — it's always routed back through the OTP code.
  const verified = Boolean(appUser) || isSuperAdminEmail(normalized);

  return {
    exists: Boolean(existingAuthUser),
    verified,
    preAuthorized: Boolean(authorizedEmail),
    email: normalized,
  };
}

export async function requestRegistrationOtpAction(
  input: z.infer<typeof requestOtpSchema>
): Promise<RequestOtpResult> {
  const { email, fullName, password } = requestOtpSchema.parse(input);
  const normalized = normalizeEmail(email);
  const existingAuthUser = await findAuthUserByEmail(normalized);

  // Already fully registered → send them to login instead.
  if (existingAuthUser) {
    const appUser = await getAppUserByEmail(normalized);
    if (appUser || isSuperAdminEmail(normalized)) {
      throw new Error("Ese email ya tiene una cuenta. Iniciá sesión.");
    }

    // Half-finished signup (auth user exists but never verified): update the
    // password to what they just typed and re-issue a verification code.
    const admin = createAdminSupabaseClient();
    await admin.auth.admin.updateUserById(existingAuthUser.id, {
      password,
      user_metadata: { full_name: fullName, name: fullName },
    });

    const resumeCode = await generateCustomOtp({ type: "magiclink", email: normalized, fullName });
    await sendOtpEmail({ email: normalized, code: resumeCode, fullName });

    return { ok: true, email: normalized, otpType: "magiclink" };
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

// ─── Self-service onboarding (post-OTP) ─────────────────────────────────────────
// These run AFTER the user verified their email (so they already hold a session).
// We re-check the session server-side and require it to match, so nobody can
// create a company for someone else's email.

const ownerOnboardingSchema = z.object({
  companyName: z.string().trim().min(2, "Ingresá el nombre de tu inmobiliaria."),
  phone: z.string().trim().max(40).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
});

function slugifyCompany(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "inmobiliaria"
  );
}

async function uniqueCompanySlug(companyName: string) {
  const base = slugifyCompany(companyName);
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from("companies").select("slug").ilike("slug", `${base}%`);
  const taken = new Set(((data as Array<{ slug: string }> | null) ?? []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Returns the verified session's auth user, asserting it matches `email`. */
async function requireVerifiedSelf(email: string) {
  const normalized = normalizeEmail(email);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || normalizeEmail(user.email || "") !== normalized) {
    throw new Error("Tu sesión no coincide. Verificá tu email de nuevo.");
  }
  return user;
}

/**
 * Creates a brand-new inmobiliaria with the current user as owner, then sends
 * them to choose a plan. Idempotent-ish: if they already belong to a company we
 * just route them in instead of creating a duplicate.
 */
export async function createCompanyAsOwnerAction(input: {
  email: string;
  companyName: string;
  phone?: string;
  city?: string;
}): Promise<{ redirectTo: string }> {
  const authUser = await requireVerifiedSelf(input.email);
  const normalized = normalizeEmail(input.email);
  const { companyName, phone, city } = ownerOnboardingSchema.parse(input);

  const supabase = createAdminSupabaseClient();

  // Already onboarded? Don't create a second company.
  const [{ data: existingUser }, { data: existingAuth }] = await Promise.all([
    supabase.from("users").select("company_id").eq("id", authUser.id).maybeSingle(),
    supabase.from("authorized_emails").select("company_id, role").eq("email", normalized).maybeSingle(),
  ]);
  if (existingUser?.company_id || existingAuth?.company_id) {
    return { redirectTo: "/app/suscripcion" };
  }

  const fullName =
    String(authUser.user_metadata?.full_name || authUser.user_metadata?.name || "").trim() ||
    normalized.split("@")[0];
  const slug = await uniqueCompanySlug(companyName);

  let companyId: string | null = null;
  try {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        slug,
        vendor_limit: 1,
        status: "active",
        settings: { onboarding: { phone: phone || null, city: city || null } } as never,
      })
      .select("id")
      .single();
    if (companyError) throw companyError;
    companyId = company.id as string;

    const { error: authorizedError } = await supabase.from("authorized_emails").insert({
      company_id: companyId,
      email: normalized,
      role: "owner",
      added_by: null,
    });
    if (authorizedError) throw authorizedError;

    const { error: userError } = await supabase.from("users").upsert(
      {
        id: authUser.id,
        company_id: companyId,
        email: normalized,
        name: fullName,
        role: "owner",
        is_active: true,
      },
      { onConflict: "id" }
    );
    if (userError) throw userError;
  } catch (error) {
    if (companyId) {
      await supabase.from("authorized_emails").delete().eq("company_id", companyId);
      await supabase.from("companies").delete().eq("id", companyId);
    }
    throw error;
  }

  await sendWelcomeEmail({ email: normalized, fullName });

  // New owners always start on the plan chooser.
  return { redirectTo: "/app/suscripcion" };
}

/**
 * Joins an existing inmobiliaria as an employee: works both when the owner
 * pre-loaded the email in Centro de Usuarios and when they bring an invite code.
 */
export async function registerEmployeeAction(input: {
  email: string;
  joinToken?: string | null;
}): Promise<RegistrationResult> {
  const authUser = await requireVerifiedSelf(input.email);
  const normalized = normalizeEmail(input.email);

  const result = await syncWorkspaceUserFromAuth({
    authUser,
    joinToken: input.joinToken?.trim() || null,
  });

  await sendWelcomeEmail({
    email: normalized,
    fullName:
      String(authUser.user_metadata?.full_name || authUser.user_metadata?.name || "").trim() || null,
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
