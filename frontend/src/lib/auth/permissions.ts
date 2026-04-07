import type { AppRole } from "@/lib/workspace-roles";
import { getAdminEmail, normalizeEmail } from "@/lib/workspace-roles";

export type WorkspaceProtectedPath =
  | "/app/crm"
  | "/app/users"
  | "/app/integrations"
  | "/app/account"
  | "/app/admin"
  | "/admin";

export function canManageUsers(role?: AppRole | null): boolean {
  return role === "owner";
}

export function canEditLeads(role?: AppRole | null): boolean {
  return role === "owner" || role === "vendor";
}

export function canViewAllLeads(role?: AppRole | null): boolean {
  return role === "owner" || role === "analyst";
}

export function canConnectChannels(role?: AppRole | null): boolean {
  return role === "vendor";
}

export function canAccessAdmin(email?: string | null): boolean {
  return normalizeEmail(email) === getAdminEmail();
}

export function canEditContact(
  role?: AppRole | null,
  assignedTo?: string | null,
  userId?: string | null
): boolean {
  if (role === "owner") {
    return true;
  }

  return role === "vendor" && Boolean(assignedTo && userId && assignedTo === userId);
}

export function canAccessProtectedPath(params: {
  pathname: string;
  email?: string | null;
  role?: AppRole | null;
  isAuthenticated: boolean;
}) {
  const pathname = params.pathname;

  if (!params.isAuthenticated) {
    return false;
  }

  if (pathname.startsWith("/app/users")) {
    return canManageUsers(params.role);
  }

  if (pathname.startsWith("/app/integrations")) {
    return params.role === "owner" || canConnectChannels(params.role);
  }

  if (pathname.startsWith("/app/admin") || pathname.startsWith("/admin")) {
    return canAccessAdmin(params.email);
  }

  return true;
}

export function resolveProtectedRouteRedirect(params: {
  pathname: string;
  email?: string | null;
  role?: AppRole | null;
  isAuthenticated: boolean;
  originalUrl?: string;
}) {
  if (!params.isAuthenticated) {
    const redirectTarget = encodeURIComponent(params.originalUrl || params.pathname);
    return `/app?redirect=${redirectTarget}`;
  }

  if (
    !canAccessProtectedPath({
      pathname: params.pathname,
      email: params.email,
      role: params.role,
      isAuthenticated: params.isAuthenticated,
    })
  ) {
    return "/app/crm";
  }

  return null;
}

export type PermissionSnapshot = {
  canManageUsers: boolean;
  canEditLeads: boolean;
  canViewAllLeads: boolean;
  canConnectChannels: boolean;
  canAccessAdmin: boolean;
};

export function buildPermissionSnapshot(params: {
  role?: AppRole | null;
  email?: string | null;
}) {
  return {
    canManageUsers: canManageUsers(params.role),
    canEditLeads: canEditLeads(params.role),
    canViewAllLeads: canViewAllLeads(params.role),
    canConnectChannels: canConnectChannels(params.role),
    canAccessAdmin: canAccessAdmin(params.email),
  } satisfies PermissionSnapshot;
}

export { getAdminEmail, normalizeEmail };
export type { AppRole };
