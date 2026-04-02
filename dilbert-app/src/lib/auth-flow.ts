import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
} from "crypto";
import { Resend } from "resend";
import { createAdminSupabaseClient } from "@/lib/supabase";
import type { AppRole } from "@/lib/roles";

const OTP_EXPIRY_MINUTES = 10;
const REGISTRATION_SESSION_EXPIRY_MINUTES = 15;
const DEFAULT_AUTH_FLOW_SECRET =
  process.env.AUTH_FLOW_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "dilbert-app-local-secret";

export const OTP_LENGTH = 6;

export type PendingRegistration = {
  id: string;
  email: string;
  full_name: string | null;
  password_ciphertext: string | null;
  oauth_provider: string | null;
  oauth_provider_account_id: string | null;
  avatar_url: string | null;
  otp_hash: string;
  otp_expires_at: string;
  completed_session_token: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppUserRecord = {
  id: string;
  company_id: string | null;
  email: string;
  name: string;
  avatar_url: string | null;
  role: AppRole | null;
  department: string | null;
  phone: string | null;
  created_at: string;
};

type AuthorizedEmailRecord = {
  id: string;
  company_id: string;
  email: string;
  role: AppRole;
  created_at: string;
};

type PendingRegistrationInput = {
  email: string;
  fullName?: string | null;
  password?: string | null;
  avatarUrl?: string | null;
  oauthProvider?: string | null;
  oauthProviderAccountId?: string | null;
};

type AuthUserInput = {
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  password?: string | null;
};

function getEncryptionKey() {
  return createHash("sha256").update(DEFAULT_AUTH_FLOW_SECRET).digest();
}

function hashValue(value: string) {
  return createHash("sha256")
    .update(`${DEFAULT_AUTH_FLOW_SECRET}:${value}`)
    .digest("hex");
}

function encryptValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptValue(payload: string) {
  const [ivPart, authTagPart, encryptedPart] = payload.split(".");

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Invalid encrypted payload.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function generateOtpCode() {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

function generateSessionToken() {
  return randomBytes(24).toString("hex");
}

function getOtpExpiryIso() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
}

function isExpired(isoString: string) {
  return new Date(isoString).getTime() < Date.now();
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function getDisplayNameFromEmail(email: string) {
  return email.split("@")[0].replace(/[._-]+/g, " ");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function userHasWorkspaceAccess(user: AppUserRecord | null | undefined) {
  return Boolean(user?.company_id && user?.role);
}

export async function getAppUserByEmail(email: string) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from("users")
    .select("id, company_id, email, name, avatar_url, role, department, phone, created_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AppUserRecord | null) ?? null;
}

async function getAuthorizedAccessByEmail(email: string) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from("authorized_emails")
    .select("id, company_id, email, role, created_at")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AuthorizedEmailRecord | null) ?? null;
}

export async function getPendingRegistrationByEmail(email: string) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from("pending_registrations")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PendingRegistration | null) ?? null;
}

async function savePendingRegistration(
  input: PendingRegistrationInput,
  otpCode: string
) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(input.email);
  const existing = await getPendingRegistrationByEmail(normalizedEmail);

  const payload = {
    email: normalizedEmail,
    full_name: input.fullName?.trim() || null,
    password_ciphertext: input.password ? encryptValue(input.password) : null,
    oauth_provider: input.oauthProvider || null,
    oauth_provider_account_id: input.oauthProviderAccountId || null,
    avatar_url: input.avatarUrl || null,
    otp_hash: hashValue(otpCode),
    otp_expires_at: getOtpExpiryIso(),
    completed_session_token: null,
    completed_at: null,
  };

  if (existing) {
    const { error } = await supabase
      .from("pending_registrations")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      throw error;
    }

    return existing.id;
  }

  const { data, error } = await supabase
    .from("pending_registrations")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

async function sendOtpEmail(params: {
  email: string;
  code: string;
  fullName?: string | null;
}) {
  const resend = getResendClient();
  const friendlyName = params.fullName?.trim() || getDisplayNameFromEmail(params.email);

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.email,
    subject: "Tu código de acceso a Dilbert",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#08111f;color:#f7f9fb;padding:32px">
        <div style="max-width:520px;margin:0 auto;background:#101a2e;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px">
          <p style="margin:0 0 12px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#69e6c5">Dilbert</p>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1">Verificación de email</h1>
          <p style="margin:0 0 24px;color:#b5c0d5">Hola ${friendlyName}, usá este código para continuar tu alta en Dilbert. Vence en ${OTP_EXPIRY_MINUTES} minutos.</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:.4em;background:#08111f;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:18px 24px;text-align:center">${params.code}</div>
        </div>
      </div>
    `,
  });
}

export async function createPendingRegistration(input: PendingRegistrationInput) {
  const otpCode = generateOtpCode();
  const id = await savePendingRegistration(input, otpCode);
  await sendOtpEmail({
    email: normalizeEmail(input.email),
    code: otpCode,
    fullName: input.fullName,
  });
  return id;
}

async function findAuthUserByEmail(email: string) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (candidate) => normalizeEmail(candidate.email || "") === normalizedEmail
    );

    if (user) {
      return user;
    }

    if (data.users.length < 200) {
      break;
    }
  }

  return null;
}

async function ensureAuthUser(input: AuthUserInput) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(input.email);
  const existingUser = await findAuthUserByEmail(normalizedEmail);

  const password =
    input.password ||
    `${randomBytes(18).toString("base64url")}Aa1!`;

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email: normalizedEmail,
      password: input.password || undefined,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName || existingUser.user_metadata?.full_name || null,
        avatar_url: input.avatarUrl || existingUser.user_metadata?.avatar_url || null,
      },
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName || null,
      avatar_url: input.avatarUrl || null,
    },
  });

  if (error) {
    throw error;
  }

  return data.user;
}

async function upsertAppUser(params: {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  companyId?: string | null;
  role?: AppRole | null;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("users").upsert(
    {
      id: params.id,
      email: normalizeEmail(params.email),
      name: params.name,
      avatar_url: params.avatarUrl || null,
      company_id: params.companyId || null,
      role: params.role || null,
    },
    {
      onConflict: "id",
    }
  );

  if (error) {
    throw error;
  }
}

async function markPendingRegistrationCompleted(id: string, sessionToken: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("pending_registrations")
    .update({
      completed_session_token: sessionToken,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function finalizeRegistration(params: {
  email: string;
  otp: string;
}) {
  const normalizedEmail = normalizeEmail(params.email);
  const pending = await getPendingRegistrationByEmail(normalizedEmail);

  if (!pending) {
    return { status: "not_found" as const };
  }

  if (isExpired(pending.otp_expires_at)) {
    return { status: "expired" as const };
  }

  if (hashValue(params.otp) !== pending.otp_hash) {
    return { status: "invalid_code" as const };
  }

  const password = pending.password_ciphertext
    ? decryptValue(pending.password_ciphertext)
    : null;

  const authUser = await ensureAuthUser({
    email: normalizedEmail,
    fullName: pending.full_name,
    avatarUrl: pending.avatar_url,
    password,
  });

  const accessRecord = await getAuthorizedAccessByEmail(normalizedEmail);
  const fullName =
    pending.full_name ||
    String(authUser.user_metadata?.full_name || "").trim() ||
    getDisplayNameFromEmail(normalizedEmail);

  await upsertAppUser({
    id: authUser.id,
    email: normalizedEmail,
    name: fullName,
    avatarUrl: pending.avatar_url || String(authUser.user_metadata?.avatar_url || "") || null,
    companyId: accessRecord?.company_id || null,
    role: accessRecord?.role || null,
  });

  if (!accessRecord) {
    const supabase = createAdminSupabaseClient();
    await supabase
      .from("pending_registrations")
      .delete()
      .eq("id", pending.id);

    return { status: "pending_access" as const };
  }

  const sessionToken = generateSessionToken();
  await markPendingRegistrationCompleted(pending.id, sessionToken);

  return {
    status: "authorized" as const,
    sessionToken,
  };
}

export async function consumeRegistrationSessionToken(sessionToken: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("pending_registrations")
    .select("*")
    .eq("completed_session_token", sessionToken)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const pending = data as PendingRegistration | null;

  if (!pending || !pending.completed_at) {
    return null;
  }

  const completionAgeMs =
    Date.now() - new Date(pending.completed_at).getTime();
  if (completionAgeMs > REGISTRATION_SESSION_EXPIRY_MINUTES * 60 * 1000) {
    return null;
  }

  const appUser = await getAppUserByEmail(pending.email);
  if (!appUser || !userHasWorkspaceAccess(appUser)) {
    return null;
  }

  await supabase
    .from("pending_registrations")
    .delete()
    .eq("id", pending.id);

  return appUser;
}

export function buildSessionUser(user: AppUserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.avatar_url,
    role: user.role as AppRole,
    companyId: user.company_id as string,
    isSuperAdmin: normalizeEmail(user.email) === "dilbert@gmail.com",
  };
}

export async function prepareOAuthRegistration(params: {
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  provider: string;
  providerAccountId?: string | null;
}) {
  return createPendingRegistration({
    email: params.email,
    fullName: params.fullName,
    avatarUrl: params.avatarUrl,
    oauthProvider: params.provider,
    oauthProviderAccountId: params.providerAccountId,
  });
}
