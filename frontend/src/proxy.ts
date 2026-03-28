import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dilbert-hackitba-secret-2026"
);

const PUBLIC = ["/login", "/api/auth", "/landing.html", "/_next", "/favicon", "/CRMs", "/Canales"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
