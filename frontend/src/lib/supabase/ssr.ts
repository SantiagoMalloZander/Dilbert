import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_AUTH_COOKIE_NAME } from "@/lib/supabase/client";
import { REMEMBER_COOKIE } from "@/lib/workspace-activity";

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function getSharedCookieOptions() {
  return {
    name: SUPABASE_AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax" as const,
  };
}

function getCookieWriteOptions(
  options: Record<string, unknown>,
  persistent: boolean
) {
  if (persistent) {
    return options;
  }

  const nextOptions = { ...options };
  delete nextOptions.maxAge;
  delete nextOptions.expires;
  return nextOptions;
}

export async function createServerSupabaseClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const cookieStore = await cookies();
  const persistent = cookieStore.get(REMEMBER_COOKIE)?.value === "1";

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: getSharedCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, getCookieWriteOptions(options, persistent));
          });
        } catch {
          // Server components cannot always mutate cookies.
        }
      },
    },
    auth: {
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
}

export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const persistent = request.cookies.get(REMEMBER_COOKIE)?.value === "1";

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: getSharedCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, getCookieWriteOptions(options, persistent));
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
    auth: {
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
}
