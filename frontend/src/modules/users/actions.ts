"use server";

import { canManageUsers } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/workspace-auth";
import { revokeAuthSessionsByUserId } from "@/lib/workspace-session-security";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getAppUserByEmail, normalizeEmail } from "@/modules/auth/queries";
import {
  assertVendorCapacity,
  ensureCompanyInviteLink,
  getAuthorizedEmail,
  getCompany,
  regenerateCompanyInviteLink,
  rotateExpiredInviteLinks,
} from "@/modules/users/queries";

async function requireUsersManager() {
  const { user, company_id } = await requireAuth();

  if (!canManageUsers(user.role)) {
    throw new Error("FORBIDDEN");
  }

  return { user, company_id };
}

async function assertEmailAvailableForCompany(companyId: string, email: string) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const [{ data: authorization, error: authorizationError }, existingUser] = await Promise.all([
    supabase
      .from("authorized_emails")
      .select("id, company_id")
      .eq("email", normalizedEmail)
      .maybeSingle(),
    getAppUserByEmail(normalizedEmail),
  ]);

  if (authorizationError) {
    throw authorizationError;
  }

  if (authorization && authorization.company_id !== companyId) {
    throw new Error("EMAIL_BELONGS_TO_OTHER_COMPANY");
  }

  if (existingUser?.company_id && existingUser.company_id !== companyId) {
    throw new Error("EMAIL_BELONGS_TO_OTHER_COMPANY");
  }
}

export async function addCompanyUser(params: {
  companyId: string;
  addedBy: string;
  email: string;
  role: "analyst" | "vendor";
}) {
  const { user, company_id } = await requireUsersManager();
  if (company_id !== params.companyId || user.id !== params.addedBy) {
    throw new Error("FORBIDDEN");
  }

  const supabase = createAdminSupabaseClient();
  const email = normalizeEmail(params.email);
  const [company, existingAuthorization] = await Promise.all([
    getCompany(params.companyId),
    getAuthorizedEmail(params.companyId, email),
  ]);

  if (!company) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  if (existingAuthorization) {
    throw new Error("AUTHORIZED_EMAIL_ALREADY_EXISTS");
  }

  await assertEmailAvailableForCompany(params.companyId, email);
  await assertVendorCapacity({
    companyId: params.companyId,
    nextRole: params.role,
  });

  const { error } = await supabase.from("authorized_emails").insert({
    company_id: params.companyId,
    email,
    added_by: params.addedBy,
    role: params.role,
  });

  if (error) {
    throw error;
  }
}

export async function updateCompanyUserRole(params: {
  companyId: string;
  email: string;
  role: "analyst" | "vendor";
}) {
  const { company_id } = await requireUsersManager();
  if (company_id !== params.companyId) {
    throw new Error("FORBIDDEN");
  }

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

  const { error: authError } = await supabase
    .from("authorized_emails")
    .update({
      role: params.role,
    })
    .eq("company_id", params.companyId)
    .eq("email", email);

  if (authError) {
    throw authError;
  }

  if (existingUser?.company_id === params.companyId) {
    const { error: userError } = await supabase
      .from("users")
      .update({
        role: params.role,
        is_active: true,
      })
      .eq("id", existingUser.id);

    if (userError) {
      throw userError;
    }

    await revokeAuthSessionsByUserId(existingUser.id);
  }
}

export async function revokeCompanyUserAccess(params: {
  companyId: string;
  email: string;
  actorUserId: string;
}) {
  const { user, company_id } = await requireUsersManager();
  if (company_id !== params.companyId || user.id !== params.actorUserId) {
    throw new Error("FORBIDDEN");
  }

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

  if (activeUser?.company_id === params.companyId) {
    const { error: userError } = await supabase
      .from("users")
      .update({
        is_active: false,
      })
      .eq("id", activeUser.id);

    if (userError) {
      throw userError;
    }

    await revokeAuthSessionsByUserId(activeUser.id);
  }
}

export async function regenerateCompanyInviteLinkAction(companyId: string) {
  const { company_id } = await requireUsersManager();
  if (company_id !== companyId) {
    throw new Error("FORBIDDEN");
  }

  return regenerateCompanyInviteLink(companyId);
}

export async function ensureCompanyInviteLinkAction(companyId: string) {
  const { company_id } = await requireUsersManager();
  if (company_id !== companyId) {
    throw new Error("FORBIDDEN");
  }

  return ensureCompanyInviteLink(companyId);
}

export async function rotateExpiredInviteLinksAction() {
  const { user } = await requireAuth({
    requireCompany: false,
    allowSuperAdminWithoutCompany: true,
  });

  if (!user.isSuperAdmin) {
    throw new Error("FORBIDDEN");
  }

  return rotateExpiredInviteLinks();
}
