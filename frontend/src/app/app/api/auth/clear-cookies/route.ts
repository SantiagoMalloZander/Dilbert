import { NextResponse } from "next/server";

/**
 * POST /app/api/auth/clear-cookies
 *
 * Public endpoint to clear all authentication cookies.
 * Useful when cookies become corrupted or invalid.
 * Redirects to /app/ (login page) after clearing.
 */
export async function POST() {
  const response = NextResponse.json({ success: true, message: "Cookies cleared" });

  // Clear workspace cookies
  response.cookies.delete("browser-session");
  response.cookies.delete("last-activity");
  response.cookies.delete("remember-me");
  response.cookies.delete("impersonation");

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

  // Also clear session cookie from dashboard
  response.cookies.delete("dashboard-session");

  return response;
}

/**
 * GET /app/api/auth/clear-cookies
 *
 * Clears cookies and redirects to login page.
 * Can be called via browser navigation for user-initiated cookie clearing.
 */
export async function GET() {
  const response = NextResponse.redirect(new URL("/app/", process.env.NEXTAUTH_URL || "http://localhost:3000"));

  // Clear workspace cookies
  response.cookies.delete("browser-session");
  response.cookies.delete("last-activity");
  response.cookies.delete("remember-me");
  response.cookies.delete("impersonation");

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

  // Also clear session cookie from dashboard
  response.cookies.delete("dashboard-session");

  return response;
}
