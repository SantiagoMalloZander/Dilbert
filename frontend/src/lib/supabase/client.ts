import { createBrowserClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { REMEMBER_COOKIE } from "@/lib/workspace-activity";

let browserClient: SupabaseClient<Database> | null = null;

export const SUPABASE_AUTH_COOKIE_NAME = "dilbert-sb-auth";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function getCookieOptions(): CookieOptionsWithName {
  return {
    name: SUPABASE_AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
  };
}

function getDocumentCookies() {
  if (typeof document === "undefined") {
    return [];
  }

  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        return {
          name: entry,
          value: "",
        };
      }

      return {
        name: entry.slice(0, separatorIndex),
        value: entry.slice(separatorIndex + 1),
      };
    });
}

function shouldPersistAuthCookies() {
  return getDocumentCookies().some(
    ({ name, value }) => name === REMEMBER_COOKIE && value === "1"
  );
}

function writeCookie(name: string, value: string, options: Record<string, unknown>) {
  if (typeof document === "undefined") {
    return;
  }

  const parts = [`${name}=${value}`];
  parts.push(`Path=${String(options.path || "/")}`);

  if (options.domain) {
    parts.push(`Domain=${String(options.domain)}`);
  }

  if (options.sameSite) {
    parts.push(`SameSite=${String(options.sameSite)}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${String(options.maxAge)}`);
  }

  if (options.expires instanceof Date) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  document.cookie = parts.join("; ");
}

export function createBrowserSupabaseClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(url, anonKey, {
      cookies: {
        getAll() {
          return getDocumentCookies();
        },
        setAll(cookiesToSet) {
          const persistent = shouldPersistAuthCookies();

          cookiesToSet.forEach(({ name, value, options }) => {
            if (!persistent) {
              const nextOptions = { ...options };
              delete nextOptions.maxAge;
              delete nextOptions.expires;
              writeCookie(name, value, nextOptions);
              return;
            }

            writeCookie(name, value, options);
          });
        },
      },
      cookieOptions: getCookieOptions(),
      isSingleton: true,
      auth: {
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }

  return browserClient;
}

export const getSupabaseBrowserClient = createBrowserSupabaseClient;
