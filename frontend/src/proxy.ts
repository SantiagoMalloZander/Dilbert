import { NextRequest, NextResponse } from "next/server";
import { decodeJwt, jwtVerify } from "jose";
import {
  canAccessAdmin,
  canAccessProtectedPath,
  resolveProtectedRouteRedirect,
} from "@/lib/auth/permissions";
import { isSupabaseAuthCookieName } from "@/lib/supabase/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/ssr";
import {
  BROWSER_SESSION_COOKIE,
  LAST_ACTIVITY_COOKIE,
  REMEMBER_COOKIE,
} from "@/lib/workspace-activity";
import {
  IMPERSONATION_COOKIE,
  parseImpersonationCookieValue,
} from "@/lib/workspace-impersonation";

const AUTH_SECRET = process.env.AUTH_SECRET
  ? new TextEncoder().encode(process.env.AUTH_SECRET)
  : null;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKSPACE_MAX_IDLE_MS = 30 * 60 * 1000;

const PUBLIC = [
  "/login",
  "/qr",
  "/waitlist",
  "/reservar",
  "/api/auth",
  "/api/waitlist",
  "/api/availability",
  "/api/book",
  "/landing.html",
  "/_next",
  "/favicon",
  "/CRMs",
  "/Canales",
  "/dilbert-crm-logo.svg",
  "/logos",
];

function isWorkspacePath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

function isWorkspacePublicPath(pathname: string) {
  return (
    pathname === "/app" ||
    pathname === "/app/" ||
    pathname.startsWith("/app/api/auth") ||
    pathname.startsWith("/app/auth/callback")
  );
}

export function buildAuthRedirectTarget(pathname: string, search = "") {
  return `${pathname}${search}`;
}

function clearAllAuthCookies(response: NextResponse, request?: NextRequest) {
  response.cookies.delete(LAST_ACTIVITY_COOKIE);
  response.cookies.delete(BROWSER_SESSION_COOKIE);
  response.cookies.delete(REMEMBER_COOKIE);
  response.cookies.delete(IMPERSONATION_COOKIE);

  const authCookieNames = new Set<string>([
    "dilbert-sb-auth",
    "dilbert-sb-auth.0",
    "dilbert-sb-auth.1",
    "dilbert-sb-auth.2",
    "dilbert-sb-auth.3",
  ]);

  request?.cookies.getAll().forEach(({ name }) => {
    if (isSupabaseAuthCookieName(name)) {
      authCookieNames.add(name);
    }
  });

  authCookieNames.forEach((name) => response.cookies.delete(name));
}

function redirectToWorkspaceSignIn(request: NextRequest, reason?: "timeout") {
  const url = new URL("/app/", request.url);
  if (reason) {
    url.searchParams.set(reason, "1");
  }
  url.searchParams.set(
    "redirect",
    buildAuthRedirectTarget(request.nextUrl.pathname, request.nextUrl.search)
  );

  const response = NextResponse.redirect(url);
  clearAllAuthCookies(response, request);
  return response;
}

function redirectToWorkspaceRevoked(request: NextRequest) {
  const url = new URL("/app/", request.url);
  url.searchParams.set("revoked", "1");

  const response = NextResponse.redirect(url);
  clearAllAuthCookies(response, request);
  return response;
}

function continueWithPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

function redirectWorkspaceAuthenticated(request: NextRequest, destination: string) {
  const resp = NextResponse.redirect(new URL(destination, request.url));
  resp.cookies.set(BROWSER_SESSION_COOKIE, "1", { path: "/", sameSite: "lax" });
  return resp;
}

async function fetchWorkspaceUserSnapshot(userId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/users`);
  url.searchParams.set("select", "id,email,company_id,role,is_active");
  url.searchParams.set("id", `eq.${userId}`);
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
    is_active: boolean;
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

function getSessionIssuedAt(accessToken?: string | null) {
  if (!accessToken) {
    return null;
  }

  try {
    const payload = decodeJwt(accessToken);
    return typeof payload.iat === "number" ? payload.iat * 1000 : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const response = continueWithPathname(request, pathname);
    const supabase = createMiddlewareSupabaseClient(request, response);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const redirectLocation = resolveProtectedRouteRedirect({
      pathname,
      email: user?.email,
      role: null,
      isAuthenticated: Boolean(user?.email && !error),
      originalUrl: buildAuthRedirectTarget(request.nextUrl.pathname, request.nextUrl.search),
    });

    if (redirectLocation) {
      return NextResponse.redirect(new URL(redirectLocation, request.url));
    }

    return response;
  }

  if (isWorkspacePath(pathname)) {
    if (isWorkspacePublicPath(pathname)) {
      const hasSupabaseCookieForPublic = request.cookies
        .getAll()
        .some(({ name }) => isSupabaseAuthCookieName(name));
      if (hasSupabaseCookieForPublic) {
        const tempResponse = continueWithPathname(request, pathname);
        const supabase = createMiddlewareSupabaseClient(request, tempResponse);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email) {
          const isSuperAdmin = canAccessAdmin(user.email.toLowerCase());
          const workspaceUser = !isSuperAdmin
            ? await fetchWorkspaceUserSnapshot(user.id)
            : null;
          let destination = isSuperAdmin
            ? "/app/admin"
            : workspaceUser?.company_id
              ? "/app/crm"
              : "/app/pending-access";
          const redirectParam = request.nextUrl.searchParams.get("redirect");
          if (redirectParam?.startsWith("/app/") && !redirectParam.startsWith("/app/?")) {
            destination = redirectParam;
          }
          return redirectWorkspaceAuthenticated(request, destination);
        }
      }
      return continueWithPathname(request, pathname);
    }

    const response = continueWithPathname(request, pathname);
    const supabase = createMiddlewareSupabaseClient(request, response);

    const remember = request.cookies.get(REMEMBER_COOKIE)?.value === "1";
    const hasBrowserSession = Boolean(request.cookies.get(BROWSER_SESSION_COOKIE)?.value);

    // Fast-path: if neither remember nor browser-session cookie is present,
    // there is no valid session. Authenticated users always arrive here with
    // BROWSER_SESSION_COOKIE already set (bootstrapped via the public-path branch).
    if (!remember && !hasBrowserSession) {
      return redirectToWorkspaceSignIn(request);
    }

    const rawLastActivity = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    if (rawLastActivity && hasBrowserSession) {
      const lastActivity = Number(rawLastActivity);
      if (Number.isFinite(lastActivity) && Date.now() - lastActivity > WORKSPACE_MAX_IDLE_MS) {
        return redirectToWorkspaceSignIn(request, "timeout");
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return redirectToWorkspaceSignIn(request);
    }

    const email = user.email.toLowerCase();
    const isSuperAdmin = canAccessAdmin(email);
    const impersonation = isSuperAdmin
      ? parseImpersonationCookieValue(request.cookies.get(IMPERSONATION_COOKIE)?.value)
      : null;
    const workspaceUser = !isSuperAdmin ? await fetchWorkspaceUserSnapshot(user.id) : null;
    const authControl = !isSuperAdmin ? await fetchWorkspaceAuthControl(user.id) : null;
    const sessionIssuedAt = getSessionIssuedAt(session?.access_token);

    if (authControl?.sessionRevokedAt && sessionIssuedAt) {
      const revokedAtMs = new Date(authControl.sessionRevokedAt).getTime();
      if (Number.isFinite(revokedAtMs) && revokedAtMs > sessionIssuedAt) {
        return redirectToWorkspaceRevoked(request);
      }
    }

    if (workspaceUser && workspaceUser.is_active === false) {
      return redirectToWorkspaceRevoked(request);
    }

    const role = String(impersonation ? "owner" : workspaceUser?.role || "").toLowerCase();
    const companyId = impersonation?.companyId || String(workspaceUser?.company_id || "");

    if (!companyId) {
      if (isSuperAdmin) {
        if (!pathname.startsWith("/app/admin")) {
          return redirectWorkspaceAuthenticated(request, "/app/admin");
        }
        return response;
      }

      if (pathname !== "/app/pending-access") {
        return redirectWorkspaceAuthenticated(request, "/app/pending-access");
      }

      return response;
    }

    if (pathname === "/app/pending-access") {
      return redirectWorkspaceAuthenticated(request, "/app/crm");
    }

    if (
      !canAccessProtectedPath({
        pathname,
        email,
        role: role === "owner" || role === "analyst" || role === "vendor" ? role : null,
        isAuthenticated: true,
      })
    ) {
      return redirectWorkspaceAuthenticated(request, "/app/crm");
    }

    return response;
  }

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("dilbert_session")?.value;
  let session = null;

  if (token && AUTH_SECRET) {
    try {
      const { payload } = await jwtVerify(token, AUTH_SECRET);
      session = payload as { username: string; companyName: string; role: string };
    } catch {
      // invalid token
    }
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

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
