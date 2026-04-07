import { randomBytes } from "crypto";
import type { AppRole } from "@/lib/workspace-roles";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/modules/auth/queries";

type CompanyRow = {
  id: string;
  name: string;
  vendor_limit: number;
};

type CompanyUserRow = {
  id: string;
  company_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: AppRole;
  created_at: string;
  is_active: boolean;
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
  return process.env.DILBERT_APP_LOGIN_URL || "https://dilvert.netlify.app";
}

function buildInviteUrl(token: string) {
  const url = new URL("/app", getLoginUrl());
  url.searchParams.set("join", token);
  return url.toString();
}

function getHoursRemaining(expiresAt: string) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (60 * 60 * 1000)));
}

function getDisplayNameFromEmail(email: string) {
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildInviteLinkRecord(inviteLink: InviteLinkRow): InviteLinkRecord {
  return {
    url: buildInviteUrl(inviteLink.token),
    token: inviteLink.token,
    expiresAt: inviteLink.expires_at,
    hoursRemaining: getHoursRemaining(inviteLink.expires_at),
  };
}

function isExpired(dateString: string) {
  return new Date(dateString).getTime() <= Date.now();
}

export async function getCompany(companyId: string) {
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

export async function getAuthorizedEmail(companyId: string, email: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("authorized_emails")
    .select("id, company_id, email, role, created_at")
    .eq("company_id", companyId)
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AuthorizedEmailRow | null) ?? null;
}

export async function countVendorSeats(companyId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("authorized_emails")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "vendor");

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function assertVendorCapacity(params: {
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

  const occupiedSeats = await countVendorSeats(params.companyId);
  if (occupiedSeats >= company.vendor_limit) {
    throw new Error("VENDOR_LIMIT_REACHED");
  }
}

export async function findLatestInviteLink(companyId: string) {
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
  const [company, { data: activeUsers, error: activeUsersError }, { data: authorizedEmails, error: authorizedEmailsError }] =
    await Promise.all([
      getCompany(companyId),
      supabase
        .from("users")
        .select("id, company_id, email, name, avatar_url, role, created_at, is_active")
        .eq("company_id", companyId)
        .eq("is_active", true)
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
  const activeByEmail = new Map(activeUserRows.map((user) => [normalizeEmail(user.email), user]));

  const activeRecords: CompanyUserRecord[] = activeUserRows.map((user) => ({
    id: user.id,
    userId: user.id,
    avatarUrl: user.avatar_url,
    name: user.name,
    email: user.email,
    role: user.role,
    state: "active",
    joinedAt: user.created_at,
    canManage: user.role !== "owner",
  }));

  const pendingRecords: CompanyUserRecord[] = authorizedEmailRows
    .filter((entry) => entry.role !== "owner")
    .filter((entry) => !activeByEmail.has(normalizeEmail(entry.email)))
    .map((entry) => ({
      id: entry.id,
      userId: null,
      avatarUrl: null,
      name: getDisplayNameFromEmail(entry.email),
      email: entry.email,
      role: entry.role,
      state: "pending" as const,
      joinedAt: entry.created_at,
      canManage: true,
    }));

  const inviteLink = await ensureCompanyInviteLink(companyId);

  return {
    companyId,
    companyName: company.name,
    vendorLimit: company.vendor_limit,
    activeVendors: activeRecords.filter((user) => user.role === "vendor").length,
    inviteLink,
    users: [...activeRecords, ...pendingRecords].sort(
      (left, right) =>
        new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime()
    ),
  } satisfies UsersCenterData;
}
