// @ts-nocheck
import { randomBytes } from "crypto";
import { Resend } from "resend";
import type { AppRole } from "@/lib/workspace-roles";
import {
  findAuthUserByEmail,
  getAppUserByEmail,
  normalizeEmail,
  syncWorkspaceAccessByEmail,
} from "@/lib/workspace-auth-flow";
import { revokeAuthSessionsByUserId } from "@/lib/workspace-session-security";
import { createAdminSupabaseClient } from "@/lib/workspace-supabase";

type CompanyRow = {
  id: string;
  name: string;
  vendor_limit: number;
};

type CompanyUserRow = {
  id: string;
  company_id: string | null;
  email: string;
  name: string;
  avatar_url: string | null;
  role: AppRole | null;
  created_at: string;
};

type AuthorizedEmailRow = {
  id: string;
  company_id: string;
  email: string;
  role: AppRole;
  created_at: string;
};

type InviteLinkRow = {
  id: string;
  company_id: string;
  token: string;
  expires_at: string;
  created_at: string;
};

export type CompanyUserState = "active" | "pending";

export type CompanyUserRecord = {
  id: string;
  userId: string | null;
  avatarUrl: string | null;
  name: string;
  email: string;
  role: AppRole;
  state: CompanyUserState;
  joinedAt: string;
  canManage: boolean;
};

export type InviteLinkRecord = {
  url: string;
  token: string;
  expiresAt: string;
  hoursRemaining: number;
};

export type UsersCenterData = {
  companyId: string;
  companyName: string;
  vendorLimit: number;
  activeVendors: number;
  users: CompanyUserRecord[];
  inviteLink: InviteLinkRecord;
};

function getLoginUrl() {
  return process.env.DILBERT_APP_LOGIN_URL || "https://dilvert.netlify.app/app/";
}

function buildInviteUrl(token: string) {
  const url = new URL(getLoginUrl());
  url.searchParams.set("join", token);
  return url.toString();
}

function getHoursRemaining(expiresAt: string) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (60 * 60 * 1000)));
}

function getDisplayNameFromEmail(email: string) {
  return email.split("@")[0].replace(/[._-]+/g, " ");
}

function buildAuthIdentityFromAuthUser(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const email = normalizeEmail(authUser.email || "");
  return {
    id: authUser.id,
    email,
    name:
      String(authUser.user_metadata?.full_name || "").trim() ||
      getDisplayNameFromEmail(email),
    avatarUrl: String(authUser.user_metadata?.avatar_url || "") || null,
  };
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function generateTemporaryPassword() {
  return `Dilbert!${randomBytes(5).toString("hex")}9`;
}

async function sendCollaboratorProvisioningEmail(params: {
  collaboratorName: string;
  collaboratorEmail: string;
  companyName: string;
  temporaryPassword: string;
  role: AppRole;
}) {
  const resend = getResendClient();
  const loginUrl = getLoginUrl();
  const roleLabel = params.role === "vendor" ? "Vendedor" : "Analista";

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.collaboratorEmail,
    subject: `Fuiste agregado a ${params.companyName} en Dilbert`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#F5F0E8;color:#1A1A1A;padding:32px">
        <div style="max-width:560px;margin:0 auto;background:white;border:3px solid #2A1A0A;border-radius:12px;padding:32px;box-shadow:4px 4px 0px #2A1A0A">
          <p style="margin:0 0 16px;font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:#D4420A;font-weight:600">DILBERT.</p>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#1A1A1A;font-weight:700">Bienvenido a ${params.companyName}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1A1A1A">Hola ${params.collaboratorName},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1A1A1A">Fuiste agregado como <strong>${roleLabel}</strong> en <strong>${params.companyName}</strong>. Aquí están tus credenciales de acceso:</p>

          <p style="margin:0 0 8px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#1A1A1A;font-weight:600">Email</p>
          <p style="margin:0 0 20px;font-size:15px;color:#1A1A1A;font-weight:500">${params.collaboratorEmail}</p>

          <p style="margin:0 0 8px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#1A1A1A;font-weight:600">Contraseña temporal</p>
          <div style="margin:0 0 20px;padding:16px;background:#F5F0E8;border:2px solid #2A1A0A;border-radius:6px;font-family:monospace">
            <p style="margin:0;font-size:18px;font-weight:700;color:#1A1A1A;letter-spacing:.05em">${params.temporaryPassword}</p>
          </div>

          <p style="margin:0 0 8px;font-size:12px;color:#1A1A1A/70;letter-spacing:.05em">🔗 ENLACE DE ACCESO</p>
          <p style="margin:0 0 24px"><a href="${loginUrl}" style="display:inline-block;background:#D4420A;color:#F5F0E8;padding:12px 24px;text-decoration:none;border-radius:24px;font-weight:600;font-size:14px">Abrir Dilbert</a></p>

          <div style="margin:24px 0 0;padding:16px;background:#F5F0E8;border-left:3px solid #D4420A;border-radius:4px">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1A1A1A">⚙️ Lo que sigue</p>
            <ol style="margin:0;padding-left:20px;font-size:13px;color:#1A1A1A;line-height:1.6">
              <li>Abre el link de arriba</li>
              <li>Accedé con tu email y contraseña temporal</li>
              <li>Cambia tu contraseña en "Mi Perfil" → "Cambiar contraseña"</li>
              <li>¡Listo! Podés conectar tus canales de venta</li>
            </ol>
          </div>

          <p style="margin:24px 0 0;font-size:12px;color:#1A1A1A/60;text-align:center;border-top:1px solid #2A1A0A;padding-top:16px">Si tienes dudas, contacta a tu gerente o administrador de ${params.companyName}.</p>
        </div>
      </div>
    `,
  });
}

async function getCompany(companyId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, vendor_limit")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CompanyRow | null) ?? null;
}

async function getAuthorizedEmail(companyId: string, email: string) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from("authorized_emails")
    .select("id, company_id, email, role, created_at")
    .eq("company_id", companyId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AuthorizedEmailRow | null) ?? null;
}

async function countActiveVendors(companyId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "vendor");

  if (error) {
    throw error;
  }

  return count || 0;
}

async function assertVendorCapacity(params: {
  companyId: string;
  nextRole: AppRole;
  currentRole?: AppRole | null;
}) {
  if (params.nextRole !== "vendor" || params.currentRole === "vendor") {
    return;
  }

  const company = await getCompany(params.companyId);
  if (!company) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  const activeVendors = await countActiveVendors(params.companyId);
  if (activeVendors >= company.vendor_limit) {
    throw new Error("VENDOR_LIMIT_REACHED");
  }
}

async function findLatestInviteLink(companyId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("invite_links")
    .select("id, company_id, token, expires_at, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as InviteLinkRow | null) ?? null;
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

function buildInviteLinkRecord(inviteLink: InviteLinkRow): InviteLinkRecord {
  return {
    url: buildInviteUrl(inviteLink.token),
    token: inviteLink.token,
    expiresAt: inviteLink.expires_at,
    hoursRemaining: getHoursRemaining(inviteLink.expires_at),
  };
}

export async function regenerateCompanyInviteLink(companyId: string) {
  const supabase = createAdminSupabaseClient();
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: deleteError } = await supabase
    .from("invite_links")
    .delete()
    .eq("company_id", companyId);

  if (deleteError) {
    throw deleteError;
  }

  const { data, error } = await supabase
    .from("invite_links")
    .insert({
      company_id: companyId,
      token,
      expires_at: expiresAt,
    })
    .select("id, company_id, token, expires_at, created_at")
    .single();

  if (error) {
    throw error;
  }

  return buildInviteLinkRecord(data as InviteLinkRow);
}

export async function ensureCompanyInviteLink(companyId: string) {
  const inviteLink = await findLatestInviteLink(companyId);

  if (!inviteLink || isExpired(inviteLink.expires_at)) {
    return regenerateCompanyInviteLink(companyId);
  }

  return buildInviteLinkRecord(inviteLink);
}

export async function rotateExpiredInviteLinks() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("companies").select("id");

  if (error) {
    throw error;
  }

  const companies = (data as Array<{ id: string }> | null) || [];
  for (const company of companies) {
    await ensureCompanyInviteLink(company.id);
  }
}

export async function getUsersCenterData(companyId: string) {
  const supabase = createAdminSupabaseClient();

  // Fetch company + users + authorized_emails in parallel
  const [company, { data: activeUsers, error: activeUsersError }, { data: authorizedEmails, error: authorizedEmailsError }] =
    await Promise.all([
      getCompany(companyId),
      supabase
        .from("users")
        .select("id, company_id, email, name, avatar_url, role, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("authorized_emails")
        .select("id, company_id, email, role, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
    ]);

  if (!company) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  if (activeUsersError) {
    throw activeUsersError;
  }

  if (authorizedEmailsError) {
    throw authorizedEmailsError;
  }

  const activeUserRows = (activeUsers as CompanyUserRow[] | null) || [];
  const authorizedEmailRows = (authorizedEmails as AuthorizedEmailRow[] | null) || [];
  const activeByEmail = new Map(
    activeUserRows.map((user) => [normalizeEmail(user.email), user])
  );

  const pendingEmailList = authorizedEmailRows
    .map((entry) => normalizeEmail(entry.email))
    .filter((email) => !activeByEmail.has(email));

  let pendingProfiles = new Map<string, CompanyUserRow>();
  if (pendingEmailList.length > 0) {
    const { data: pendingUsers, error: pendingUsersError } = await supabase
      .from("users")
      .select("id, company_id, email, name, avatar_url, role, created_at")
      .eq("company_id", companyId)
      .in("email", pendingEmailList);

    if (pendingUsersError) {
      throw pendingUsersError;
    }

    pendingProfiles = new Map(
      ((pendingUsers as CompanyUserRow[] | null) || []).map((user) => [
        normalizeEmail(user.email),
        user,
      ])
    );
  }

  const activeRecords: CompanyUserRecord[] = activeUserRows.map((user) => ({
    id: normalizeEmail(user.email),
    userId: user.id,
    avatarUrl: user.avatar_url,
    name: user.name,
    email: user.email,
    role: (user.role || "analyst") as AppRole,
    state: "active",
    joinedAt: user.created_at,
    canManage: user.role !== "owner",
  }));

  const pendingRecords: CompanyUserRecord[] = authorizedEmailRows
    .filter((entry) => !activeByEmail.has(normalizeEmail(entry.email)))
    .map((entry) => {
      const profile = pendingProfiles.get(normalizeEmail(entry.email));
      return {
        id: normalizeEmail(entry.email),
        userId: profile?.id || null,
        avatarUrl: profile?.avatar_url || null,
        name:
          profile?.name ||
          getDisplayNameFromEmail(entry.email)
            .split(" ")
            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join(" "),
        email: entry.email,
        role: entry.role,
        state: "pending" as const,
        joinedAt: entry.created_at,
        canManage: entry.role !== "owner",
      };
    });

  const activeVendors = activeRecords.filter((user) => user.role === "vendor").length;
  const inviteLink = await ensureCompanyInviteLink(companyId);

  return {
    companyId,
    companyName: company.name,
    vendorLimit: company.vendor_limit,
    activeVendors,
    inviteLink,
    users: [...activeRecords, ...pendingRecords].sort(
      (left, right) =>
        new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime()
    ),
  } satisfies UsersCenterData;
}

export async function addCompanyUser(params: {
  companyId: string;
  addedBy: string;
  email: string;
  role: Exclude<AppRole, "owner">;
}) {
  const supabase = createAdminSupabaseClient();
  const email = normalizeEmail(params.email);

  await assertVendorCapacity({
    companyId: params.companyId,
    nextRole: params.role,
  });

  const [existingAuthorization, existingUser, existingAuthUser] = await Promise.all([
    getAuthorizedEmail(params.companyId, email),
    getAppUserByEmail(email),
    findAuthUserByEmail(email),
  ]);

  if (existingUser?.company_id && existingUser.company_id !== params.companyId) {
    throw new Error("EMAIL_BELONGS_TO_OTHER_COMPANY");
  }

  if (existingAuthorization) {
    throw new Error("AUTHORIZED_EMAIL_ALREADY_EXISTS");
  }

  let authUserId: string | null = null;
  let temporaryPassword: string | null = null;
  let collaboratorName = "";

  // If user doesn't have an auth account, create one with temporary password
  if (!existingAuthUser) {
    await getResendClient();
    temporaryPassword = generateTemporaryPassword();
    collaboratorName = getDisplayNameFromEmail(email)
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");

    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: collaboratorName,
        },
      });

      if (authError || !authData.user) {
        throw authError || new Error("COLLABORATOR_AUTH_CREATION_FAILED");
      }

      authUserId = authData.user.id;
    } catch (error) {
      throw error;
    }
  } else {
    authUserId = existingAuthUser.id;
    collaboratorName = String(existingAuthUser.user_metadata?.full_name || "").trim() || getDisplayNameFromEmail(email);
  }

  // Insert authorized email entry
  const { error: authEmailError } = await supabase.from("authorized_emails").insert({
    company_id: params.companyId,
    email,
    added_by: params.addedBy,
    role: params.role,
  });

  if (authEmailError) {
    throw authEmailError;
  }

  // If we created a new user, also create the users table entry and send email
  if (!existingUser && authUserId) {
    const { error: userError } = await supabase.from("users").insert({
      id: authUserId,
      company_id: params.companyId,
      email,
      name: collaboratorName,
      role: params.role,
    });

    if (userError) {
      throw userError;
    }

    // Send provisioning email if we created a new auth account
    if (temporaryPassword) {
      const company = await getCompany(params.companyId);
      if (company) {
        await sendCollaboratorProvisioningEmail({
          collaboratorName,
          collaboratorEmail: email,
          companyName: company.name,
          temporaryPassword,
          role: params.role,
        });
      }
    }
  } else {
    // User already exists, just sync access
    await syncWorkspaceAccessByEmail({
      email,
      authIdentity: existingAuthUser ? buildAuthIdentityFromAuthUser(existingAuthUser) : null,
    });
  }
}

export async function updateCompanyUserRole(params: {
  companyId: string;
  email: string;
  role: Exclude<AppRole, "owner">;
}) {
  const supabase = createAdminSupabaseClient();
  const email = normalizeEmail(params.email);
  const [authorization, existingUser] = await Promise.all([
    getAuthorizedEmail(params.companyId, email),
    getAppUserByEmail(email),
  ]);

  if (!authorization) {
    throw new Error("AUTHORIZED_EMAIL_NOT_FOUND");
  }

  if (authorization.role === "owner") {
    throw new Error("OWNER_ROLE_LOCKED");
  }

  await assertVendorCapacity({
    companyId: params.companyId,
    nextRole: params.role,
    currentRole: authorization.role,
  });

  const { error } = await supabase
    .from("authorized_emails")
    .update({
      role: params.role,
    })
    .eq("company_id", params.companyId)
    .eq("email", email);

  if (error) {
    throw error;
  }

  await syncWorkspaceAccessByEmail({
    email,
    authIdentity:
      existingUser && existingUser.id
        ? {
            id: existingUser.id,
            email,
            name: existingUser.name,
            avatarUrl: existingUser.avatar_url,
          }
        : null,
  });
}

export async function revokeCompanyUserAccess(params: {
  companyId: string;
  email: string;
  actorUserId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const email = normalizeEmail(params.email);
  const [authorization, activeUser] = await Promise.all([
    getAuthorizedEmail(params.companyId, email),
    getAppUserByEmail(email),
  ]);

  if (!authorization) {
    throw new Error("AUTHORIZED_EMAIL_NOT_FOUND");
  }

  if (authorization.role === "owner") {
    throw new Error("OWNER_ACCESS_LOCKED");
  }

  if (activeUser?.id === params.actorUserId) {
    throw new Error("SELF_ACCESS_LOCKED");
  }

  const { error: authorizedEmailError } = await supabase
    .from("authorized_emails")
    .delete()
    .eq("company_id", params.companyId)
    .eq("email", email);

  if (authorizedEmailError) {
    throw authorizedEmailError;
  }

  const { error: pendingRegistrationError } = await supabase
    .from("pending_registrations")
    .delete()
    .eq("email", email);

  if (pendingRegistrationError) {
    throw pendingRegistrationError;
  }

  if (activeUser?.id) {
    await revokeAuthSessionsByUserId(activeUser.id);
  }

  const { error: userDeleteError } = await supabase
    .from("users")
    .delete()
    .eq("company_id", params.companyId)
    .eq("email", email);

  if (userDeleteError) {
    throw userDeleteError;
  }
}
