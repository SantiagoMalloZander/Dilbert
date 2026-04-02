import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  BROWSER_SESSION_COOKIE,
  LAST_ACTIVITY_COOKIE,
  REMEMBER_COOKIE,
} from "@/lib/activity";
import {
  IMPERSONATION_COOKIE,
  parseImpersonationCookieValue,
} from "@/lib/impersonation";

const APP_BASE_PATH = "/app";
const APP_PUBLIC_PATHS = ["/", "/api/auth"];
const MAX_IDLE_MS = 30 * 60 * 1000;
const ADMIN_EMAIL = (process.env.DILBERT_ADMIN_EMAIL || "dilbert@gmail.com").toLowerCase();
const AUTH_SECRET = process.env.NEXTAUTH_SECRET || "dilbert-app-local-secret";

function normalizePath(pathname: string) {
  if (!pathname.startsWith(APP_BASE_PATH)) {
    return pathname;
  }

  const normalized = pathname.slice(APP_BASE_PATH.length);
  return normalized || "/";
}

function redirectToSignIn(request: NextRequest, reason?: "timeout") {
  const url = request.nextUrl.clone();
  url.pathname = `${APP_BASE_PATH}/`;
  url.search = "";

  if (reason) {
    url.searchParams.set(reason, "1");
  }

  const response = NextResponse.redirect(url);
  response.cookies.delete(LAST_ACTIVITY_COOKIE);
  response.cookies.delete(BROWSER_SESSION_COOKIE);

  return response;
}

function redirectToAdmin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = `${APP_BASE_PATH}/admin`;
  url.search = "";

  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const normalizedPath = normalizePath(request.nextUrl.pathname);

  if (APP_PUBLIC_PATHS.some((publicPath) => normalizedPath === publicPath || normalizedPath.startsWith(`${publicPath}/`))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: AUTH_SECRET,
  });

  if (!token?.email) {
    return redirectToSignIn(request);
  }

  const remember = request.cookies.get(REMEMBER_COOKIE)?.value === "1";
  if (!remember && !request.cookies.get(BROWSER_SESSION_COOKIE)?.value) {
    return redirectToSignIn(request);
  }

  const rawLastActivity = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
  if (rawLastActivity) {
    const lastActivity = Number(rawLastActivity);
    if (Number.isFinite(lastActivity) && Date.now() - lastActivity > MAX_IDLE_MS) {
      return redirectToSignIn(request, "timeout");
    }
  }

  const email = token.email.toLowerCase();
  const isSuperAdmin = email === ADMIN_EMAIL;
  const impersonation = isSuperAdmin
    ? parseImpersonationCookieValue(request.cookies.get(IMPERSONATION_COOKIE)?.value)
    : null;
  const role = String(impersonation ? "owner" : token.role || "").toLowerCase();
  const companyId = impersonation?.companyId || String(token.companyId || "");

  if (normalizedPath.startsWith("/admin")) {
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL(`${APP_BASE_PATH}/crm`, request.url));
    }

    return NextResponse.next();
  }

  if (!companyId) {
    if (isSuperAdmin) {
      return redirectToAdmin(request);
    }

    return redirectToSignIn(request);
  }

  if (normalizedPath.startsWith("/users") && role !== "owner") {
    return NextResponse.redirect(new URL(`${APP_BASE_PATH}/crm`, request.url));
  }

  if (normalizedPath.startsWith("/integrations") && role !== "vendor") {
    return NextResponse.redirect(new URL(`${APP_BASE_PATH}/crm`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
