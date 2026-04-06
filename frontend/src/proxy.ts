import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getToken } from "next-auth/jwt";
import { SESSION_COOKIE } from "@/lib/auth";
import {
  BROWSER_SESSION_COOKIE,
  LAST_ACTIVITY_COOKIE,
  REMEMBER_COOKIE,
} from "@/lib/workspace-activity";
import {
  IMPERSONATION_COOKIE,
  parseImpersonationCookieValue,
} from "@/lib/workspace-impersonation";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dilbert-hackitba-secret-2026"
);
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "dilbert-app-local-secret";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKSPACE_ADMIN_EMAIL = (
  process.env.DILBERT_ADMIN_EMAIL || "dilbert@gmail.com"
).toLowerCase();
const WORKSPACE_MAX_IDLE_MS = 30 * 60 * 1000;

const PUBLIC = ["/login", "/qr", "/waitlist", "/reservar", "/api/auth", "/api/waitlist", "/api/availability", "/api/book", "/landing.html", "/_next", "/favicon", "/CRMs", "/Canales", "/dilbert-crm-logo.svg", "/logos"];

function isWorkspacePath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

function isWorkspacePublicPath(pathname: string) {
  return (
    pathname === "/app" ||
    pathname === "/app/" ||
    pathname.startsWith("/app/api/auth")
  );
}

function clearAllAuthCookies(response: NextResponse) {
  // Clear workspace cookies
  response.cookies.delete(LAST_ACTIVITY_COOKIE);
  response.cookies.delete(BROWSER_SESSION_COOKIE);
  response.cookies.delete(REMEMBER_COOKIE);
  response.cookies.delete(IMPERSONATION_COOKIE);

  // Clear NextAuth JWT and related
  response.cookies.delete("next-auth.session-token");
  response.cookies.delete("__Secure-next-auth.session-token");
  response.cookies.delete("next-auth.callback-url");
  response.cookies.delete("__Secure-next-auth.callback-url");
  response.cookies.delete("next-auth.csrf-token");
  response.cookies.delete("__Secure-next-auth.csrf-token");

  // Clear any other potential auth cookies
  response.cookies.delete("nextauth");
  response.cookies.delete("__Secure-nextauth");
}

function redirectToWorkspaceSignIn(request: NextRequest, reason?: "timeout") {
  const url = new URL("/app/", request.url);
  if (reason) {
    url.searchParams.set(reason, "1");
  }

  const response = NextResponse.redirect(url);
  clearAllAuthCookies(response);
  return response;
}

function redirectToWorkspaceRevoked(request: NextRequest) {
  const url = new URL("/app/", request.url);
  url.searchParams.set("revoked", "1");

  const response = NextResponse.redirect(url);
  clearAllAuthCookies(response);
  return response;
}

function redirectToWorkspaceAdmin(request: NextRequest) {
  return NextResponse.redirect(new URL("/app/admin", request.url));
}

function continueWithPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

async function fetchWorkspaceUserSnapshot(email: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/users`);
  url.searchParams.set("select", "id,email,company_id,role");
  url.searchParams.set("email", `eq.${email}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Array<{
    id: string;
    email: string;
    company_id: string | null;
    role: string | null;
  }>;

  return data[0] || null;
}

async function fetchWorkspaceAuthControl(userId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    user?: {
      app_metadata?: {
        session_revoked_at?: string | null;
      } | null;
    } | null;
  };

  return {
    sessionRevokedAt: payload.user?.app_metadata?.session_revoked_at || null,
  };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isWorkspacePath(pathname)) {
    if (isWorkspacePublicPath(pathname)) {
      return continueWithPathname(request, pathname);
    }

    let token;
    try {
      token = await getToken({
        req: request,
        secret: NEXTAUTH_SECRET,
      });
    } catch {
      // Token parsing failed (corrupted, invalid signature, etc.)
      // Clear all auth cookies and redirect to login
      const response = redirectToWorkspaceSignIn(request);
      return response;
    }

    if (!token?.email) {
      return redirectToWorkspaceSignIn(request);
    }

    const remember = request.cookies.get(REMEMBER_COOKIE)?.value === "1";
    if (!remember && !request.cookies.get(BROWSER_SESSION_COOKIE)?.value) {
      return redirectToWorkspaceSignIn(request);
    }

    const rawLastActivity = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    if (rawLastActivity) {
      const lastActivity = Number(rawLastActivity);
      if (Number.isFinite(lastActivity) && Date.now() - lastActivity > WORKSPACE_MAX_IDLE_MS) {
        return redirectToWorkspaceSignIn(request, "timeout");
      }
    }

    const email = token.email.toLowerCase();
    const isSuperAdmin = email === WORKSPACE_ADMIN_EMAIL;
    const impersonation = isSuperAdmin
      ? parseImpersonationCookieValue(request.cookies.get(IMPERSONATION_COOKIE)?.value)
      : null;
    const workspaceUser = isSuperAdmin ? null : await fetchWorkspaceUserSnapshot(email);
    const authControl =
      !isSuperAdmin && typeof token.sub === "string"
        ? await fetchWorkspaceAuthControl(token.sub)
        : null;
    const role = String(
      impersonation ? "owner" : workspaceUser?.role || token.role || ""
    ).toLowerCase();
    const companyId =
      impersonation?.companyId ||
      String(workspaceUser?.company_id || token.companyId || "");

    if (authControl?.sessionRevokedAt && typeof token.iat === "number") {
      const revokedAtMs = new Date(authControl.sessionRevokedAt).getTime();
      if (Number.isFinite(revokedAtMs) && revokedAtMs > token.iat * 1000) {
        return redirectToWorkspaceRevoked(request);
      }
    }

    if (pathname.startsWith("/app/admin")) {
      if (!isSuperAdmin) {
        return NextResponse.redirect(new URL("/app/crm", request.url));
      }

      return continueWithPathname(request, pathname);
    }

    if (!companyId) {
      if (isSuperAdmin) {
        return redirectToWorkspaceAdmin(request);
      }

      if (!workspaceUser?.id) {
        return redirectToWorkspaceRevoked(request);
      }

      if (pathname !== "/app/pending-access") {
        return NextResponse.redirect(new URL("/app/pending-access", request.url));
      }

      return continueWithPathname(request, pathname);
    }

    if (pathname === "/app/pending-access") {
      return NextResponse.redirect(new URL("/app/crm", request.url));
    }

    if (pathname.startsWith("/app/users") && role !== "owner") {
      return NextResponse.redirect(new URL("/app/crm", request.url));
    }

    if (
      pathname.startsWith("/app/integrations") &&
      role !== "vendor" &&
      role !== "owner"
    ) {
      return NextResponse.redirect(new URL("/app/crm", request.url));
    }

    return continueWithPathname(request, pathname);
  }

  // Always allow public paths
  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let session = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      session = payload as { username: string; companyName: string; role: string };
    } catch {
      // invalid token
    }
  }

  // Root → landing (no auth needed)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Not authenticated → login
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin-only
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Pass session info to layout via headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-company-name", session.companyName);
  requestHeaders.set("x-user-role", session.role);
  requestHeaders.set("x-username", session.username);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
