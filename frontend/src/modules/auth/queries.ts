import type { User } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type {
  AuthorizedEmailRecord,
  InviteLinkRecord,
  PublicUserRecord,
  WorkspaceAccess,
} from "@/modules/auth/types";
import { isSuperAdminEmail, type AppRole } from "@/lib/workspace-roles";

const PENDING_ACCESS_MESSAGE =
  "Compartí tu email con tu empresa y pediles que te habiliten en el Centro de Usuarios";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getPendingAccessMessage() {
  return PENDING_ACCESS_MESSAGE;
}

export function getPostAuthRedirect(email: string, companyId?: string | null) {
  if (isSuperAdminEmail(email)) {
    return "/app/admin" as const;
  }

  return companyId ? ("/app/crm" as const) : ("/app/pending-access" as const);
}

export async function findAuthUserByEmail(email: string) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  for (let page = 1; page <= 20; page += 1) {
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

export async function getAppUserByEmail(email: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PublicUserRecord | null) ?? null;
}

export async function getAppUserById(id: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PublicUserRecord | null) ?? null;
}

export async function getAuthorizedEmailByEmail(email: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("authorized_emails")
    .select("*")
    .eq("email", normalizeEmail(email))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AuthorizedEmailRecord | null) ?? null;
}

export async function getInviteLinkByToken(token: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("invite_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as InviteLinkRecord | null) ?? null;
}

export async function getCompanyOwnerId(companyId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("role", "owner")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id || null;
}

async function getCompanyStatus(companyId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("status")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.status || null;
}

function isExpired(dateString: string) {
  return new Date(dateString).getTime() <= Date.now();
}

export async function resolveWorkspaceAccess(params: {
  email: string;
  joinToken?: string | null;
}) {
  const normalizedEmail = normalizeEmail(params.email);
  const authorizedEmail = await getAuthorizedEmailByEmail(normalizedEmail);

  if (authorizedEmail) {
    const companyStatus = await getCompanyStatus(authorizedEmail.company_id);
    if (companyStatus !== "active") {
      return null;
    }

    return {
      companyId: authorizedEmail.company_id,
      role: authorizedEmail.role as AppRole,
    } satisfies WorkspaceAccess;
  }

  if (!params.joinToken) {
    return null;
  }

  const inviteLink = await getInviteLinkByToken(params.joinToken);
  if (!inviteLink || isExpired(inviteLink.expires_at)) {
    return null;
  }

  const companyStatus = await getCompanyStatus(inviteLink.company_id);
  if (companyStatus !== "active") {
    return null;
  }

  const ownerId = await getCompanyOwnerId(inviteLink.company_id);
  if (!ownerId) {
    throw new Error("INVITE_OWNER_NOT_FOUND");
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("authorized_emails")
    .insert({
      company_id: inviteLink.company_id,
      email: normalizedEmail,
      role: "analyst",
      added_by: ownerId,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    companyId: data.company_id,
    role: data.role as AppRole,
  } satisfies WorkspaceAccess;
}

function getDisplayName(email: string, preferredName?: string | null) {
  if (preferredName?.trim()) {
    return preferredName.trim();
  }

  return email.split("@")[0].replace(/[._-]+/g, " ").trim() || email;
}

export async function upsertWorkspaceUserFromAuth(params: {
  authUser: User;
  access: WorkspaceAccess;
  preferredName?: string | null;
  avatarUrl?: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(params.authUser.email || "");

  if (!normalizedEmail) {
    throw new Error("AUTH_USER_EMAIL_REQUIRED");
  }

  const payload = {
    id: params.authUser.id,
    company_id: params.access.companyId,
    email: normalizedEmail,
    name: getDisplayName(
      normalizedEmail,
      params.preferredName ||
        String(params.authUser.user_metadata?.full_name || params.authUser.user_metadata?.name || "")
    ),
    avatar_url: (
      params.avatarUrl ??
      String(
        params.authUser.user_metadata?.avatar_url || params.authUser.user_metadata?.picture || ""
      )
    ) || null,
    role: params.access.role,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PublicUserRecord;
}

export async function syncWorkspaceUserFromAuth(params: {
  authUser: User;
  joinToken?: string | null;
  preferredName?: string | null;
  avatarUrl?: string | null;
}) {
  const email = normalizeEmail(params.authUser.email || "");
  if (!email) {
    throw new Error("AUTH_USER_EMAIL_REQUIRED");
  }

  if (isSuperAdminEmail(email)) {
    return {
      status: "authorized" as const,
      appUser: null,
      redirectTo: "/app/admin" as const,
      access: null,
    };
  }

  const access = await resolveWorkspaceAccess({
    email,
    joinToken: params.joinToken,
  });

  if (!access) {
    return {
      status: "pending_access" as const,
      appUser: null,
      redirectTo: "/app/pending-access" as const,
      access: null,
    };
  }

  const appUser = await upsertWorkspaceUserFromAuth({
    authUser: params.authUser,
    access,
    preferredName: params.preferredName,
    avatarUrl: params.avatarUrl,
  });

  return {
    status: "authorized" as const,
    appUser,
    redirectTo: getPostAuthRedirect(email, appUser.company_id),
    access,
  };
}
