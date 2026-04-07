import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { getAppUserByEmail, getAppUserById, normalizeEmail } from "@/modules/auth/queries";
import {
  BROWSER_SESSION_COOKIE,
  LAST_ACTIVITY_COOKIE,
  OAUTH_INTENT_COOKIE,
  REMEMBER_COOKIE,
} from "@/lib/workspace-activity";
import {
  IMPERSONATION_COOKIE,
  parseImpersonationCookieValue,
  type ImpersonationPayload,
} from "@/lib/workspace-impersonation";
import { canAccessAdmin, canManageUsers } from "@/lib/auth/permissions";
import { isSuperAdminEmail, type AppRole } from "@/lib/workspace-roles";

export type WorkspaceSessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: AppRole;
  companyId: string;
  isSuperAdmin: boolean;
  impersonation?: ImpersonationPayload;
};

export type WorkspaceSession = {
  user: WorkspaceSessionUser;
};

export type AuthenticatedWorkspaceContext = {
  user: WorkspaceSessionUser;
  company_id: string;
};

function buildDisplayName(user: User, fallbackEmail: string) {
  return (
    String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim() ||
    fallbackEmail
  );
}

function buildAvatarUrl(user: User) {
  return (
    String(user.user_metadata?.avatar_url || user.user_metadata?.picture || "").trim() || null
  );
}

function buildSessionUser(params: {
  authUser: User;
  role: AppRole;
  companyId: string;
  isSuperAdmin: boolean;
  name?: string | null;
  image?: string | null;
}) {
  const email = normalizeEmail(params.authUser.email || "");

  return {
    id: params.authUser.id,
    email,
    name: params.name?.trim() || buildDisplayName(params.authUser, email),
    image: params.image ?? buildAvatarUrl(params.authUser),
    role: params.role,
    companyId: params.companyId,
    isSuperAdmin: params.isSuperAdmin,
  } satisfies WorkspaceSessionUser;
}

export const getAuthSession = cache(async function getCachedAuthSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser?.email) {
    return null;
  }

  const email = normalizeEmail(authUser.email);
  const isSuperAdmin = isSuperAdminEmail(email);

  let appUser = null;
  if (!isSuperAdmin) {
    appUser = await getAppUserById(authUser.id);
    if (!appUser) {
      appUser = await getAppUserByEmail(email);
    }
  }

  const hasAccess = Boolean(appUser?.company_id && appUser?.role && appUser.is_active);
  const session: WorkspaceSession = {
    user: buildSessionUser({
      authUser,
      role: (hasAccess ? appUser?.role : isSuperAdmin ? "owner" : "analyst") as AppRole,
      companyId: hasAccess ? appUser?.company_id || "" : "",
      isSuperAdmin,
      name: appUser?.name || null,
      image: appUser?.avatar_url || null,
    }),
  };

  if (isSuperAdmin) {
    const cookieStore = await cookies();
    const impersonation = parseImpersonationCookieValue(
      cookieStore.get(IMPERSONATION_COOKIE)?.value
    );

    if (impersonation) {
      session.user.companyId = impersonation.companyId;
      session.user.role = "owner";
      session.user.impersonation = impersonation;
    }
  }

  return session;
});

export async function requireSession() {
  const session = await getAuthSession();

  if (!session?.user?.email) {
    redirect("/app/");
  }

  return session;
}

export async function requireAuth(options?: {
  requireCompany?: boolean;
  role?: AppRole;
  allowSuperAdminWithoutCompany?: boolean;
}) {
  const session = await requireSession();
  const requireCompany = options?.requireCompany ?? true;

  if (options?.role && session.user.role !== options.role) {
    throw new Error("FORBIDDEN");
  }

  if (
    requireCompany &&
    !session.user.companyId &&
    !(options?.allowSuperAdminWithoutCompany && session.user.isSuperAdmin)
  ) {
    throw new Error("FORBIDDEN");
  }

  return {
    user: session.user,
    company_id: session.user.companyId,
  } satisfies AuthenticatedWorkspaceContext;
}

export async function requireOwner() {
  const session = await requireSession();
  if (!canManageUsers(session.user.role)) {
    redirect("/app/crm");
  }

  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();

  if (!canAccessAdmin(session.user.email)) {
    redirect("/app/crm");
  }

  return session;
}

export async function requireVendor() {
  const session = await requireSession();

  if (session.user.role !== "vendor") {
    redirect("/app/crm");
  }

  return session;
}

export async function clearAuthTrackingCookies() {
  const cookieStore = await cookies();
  [
    LAST_ACTIVITY_COOKIE,
    REMEMBER_COOKIE,
    BROWSER_SESSION_COOKIE,
    OAUTH_INTENT_COOKIE,
    IMPERSONATION_COOKIE,
  ].forEach((cookieName) => cookieStore.set(cookieName, "", { path: "/", maxAge: 0 }));
}
