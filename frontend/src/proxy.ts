import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
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
import {
  WORKSPACE_SNAPSHOT_COOKIE,
  readWorkspaceSnapshot,
  signWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from "@/lib/workspace-snapshot-cache";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKSPACE_MAX_IDLE_MS = 30 * 60 * 1000;

const PUBLIC = [
  "/qr",
  "/waitlist",
  "/reservar",
  "/api/auth",
  "/api/waitlist",
  "/api/availability",
  "/api/book",
  "/api/webhooks",
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
    pathname.startsWith("/app/auth/callback") ||
    pathname.startsWith("/app/api/webhooks")
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
  response.cookies.delete(WORKSPACE_SNAPSHOT_COOKIE);

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

const BILLING_ACTIVE_STATUSES = ["active", "trialing", "free"];

/** Company name + whether billing grants access. Two cheap REST reads (only on
 *  the 60s snapshot refresh). Defensive: failures degrade to "active" so we
 *  never wrongly lock a paying/exempt company out. */
async function fetchCompanyBilling(companyId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { name: null as string | null, billingActive: true };
  }
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };
  try {
    const companyUrl = new URL(`${SUPABASE_URL}/rest/v1/companies`);
    companyUrl.searchParams.set("select", "name,billing_exempt");
    companyUrl.searchParams.set("id", `eq.${companyId}`);
    companyUrl.searchParams.set("limit", "1");

    const subUrl = new URL(`${SUPABASE_URL}/rest/v1/subscriptions`);
    subUrl.searchParams.set("select", "status");
    subUrl.searchParams.set("company_id", `eq.${companyId}`);
    subUrl.searchParams.set("limit", "1");

    const [companyRes, subRes] = await Promise.all([
      fetch(companyUrl, { headers, cache: "no-store" }),
      fetch(subUrl, { headers, cache: "no-store" }),
    ]);

    const company = companyRes.ok ? (await companyRes.json())[0] : null;
    const sub = subRes.ok ? (await subRes.json())[0] : null;
    const exempt = Boolean(company?.billing_exempt);
    const status = String(sub?.status || "none");
    return {
      name: (company?.name as string | null) ?? null,
      billingActive: exempt || BILLING_ACTIVE_STATUSES.includes(status),
    };
  } catch {
    return { name: null, billingActive: true };
  }
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

  // Webhook endpoints are called by external services (no session cookies)
  if (pathname.startsWith("/app/api/webhooks") || pathname.startsWith("/api/webhooks")) {
    return NextResponse.next();
  }

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
      // No cookies — let the auth page render without middleware intervention
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-pathname", pathname);
      return NextResponse.next({ request: { headers: requestHeaders } });
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

    // Workspace snapshot (company / role / is_active / session_revoked_at).
    // Cached in a signed cookie for 60s so we don't hit Supabase (Oregon) on
    // every navigation + prefetch. Only non-super-admins need it.
    let snapshot: WorkspaceSnapshot | null = null;
    if (!isSuperAdmin) {
      const cached = await readWorkspaceSnapshot(
        request.cookies.get(WORKSPACE_SNAPSHOT_COOKIE)?.value,
        user.id
      );
      if (cached) {
        snapshot = cached;
      } else {
        // Cache miss → refresh both checks in parallel (was sequential before).
        const [workspaceUser, authControl] = await Promise.all([
          fetchWorkspaceUserSnapshot(user.id),
          fetchWorkspaceAuthControl(user.id),
        ]);
        const billing = workspaceUser?.company_id
          ? await fetchCompanyBilling(workspaceUser.company_id)
          : { name: null, billingActive: true };
        snapshot = {
          uid: user.id,
          companyId: workspaceUser?.company_id ?? null,
          role: workspaceUser?.role ?? null,
          isActive: workspaceUser?.is_active !== false,
          revokedAt: authControl?.sessionRevokedAt ?? null,
          companyName: billing.name,
          billingActive: billing.billingActive,
        };
        const token = await signWorkspaceSnapshot(snapshot);
        if (token) {
          response.cookies.set(WORKSPACE_SNAPSHOT_COOKIE, token, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60,
          });
        }
      }
    }

    const sessionIssuedAt = getSessionIssuedAt(session?.access_token);

    if (snapshot?.revokedAt && sessionIssuedAt) {
      const revokedAtMs = new Date(snapshot.revokedAt).getTime();
      if (Number.isFinite(revokedAtMs) && revokedAtMs > sessionIssuedAt) {
        return redirectToWorkspaceRevoked(request);
      }
    }

    if (snapshot && snapshot.isActive === false) {
      return redirectToWorkspaceRevoked(request);
    }

    const role = String(impersonation ? "owner" : snapshot?.role || "").toLowerCase();
    const companyId = impersonation?.companyId || String(snapshot?.companyId || "");

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

  // Legacy CRM paths are mapped to workspace equivalents by next.config
  // redirects(); anything else falls through (unknown paths 404 naturally).
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|css|js|map|txt|xml|html)$).*)",
  ],
};
