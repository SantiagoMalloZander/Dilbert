export const LAST_ACTIVITY_COOKIE = "dilbert-last-activity";
export const REMEMBER_COOKIE = "dilbert-remember";
export const BROWSER_SESSION_COOKIE = "dilbert-browser-session";
export const OAUTH_INTENT_COOKIE = "dilbert-oauth-intent";

const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

function buildCookie(
  name: string,
  value: string,
  options?: {
    persistent?: boolean;
    httpOnly?: boolean;
    maxAge?: number;
  }
) {
  const parts = [`${name}=${value}`, "path=/", "SameSite=Lax"];

  if (options?.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options?.persistent) {
    parts.push(`Max-Age=${options.maxAge ?? THIRTY_DAYS_IN_SECONDS}`);
  } else if (typeof options?.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join("; ");
}

export function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1];

  return value || null;
}

export function shouldRememberSession() {
  return readCookie(REMEMBER_COOKIE) === "1";
}

export function applySessionPreference(remember: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  if (remember) {
    document.cookie = buildCookie(REMEMBER_COOKIE, "1", {
      persistent: true,
    });
  } else {
    document.cookie = `${REMEMBER_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
  }

  // Browser-session cookie disappears when the browser closes.
  document.cookie = buildCookie(BROWSER_SESSION_COOKIE, "1");
}

export function writeLastActivity(timestamp = Date.now()) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = buildCookie(LAST_ACTIVITY_COOKIE, String(timestamp), {
    persistent: shouldRememberSession(),
  });
}

export function getLastActivity() {
  const rawValue = readCookie(LAST_ACTIVITY_COOKIE);
  const parsed = rawValue ? Number(rawValue) : NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

export function clearSessionTrackingCookies() {
  if (typeof document === "undefined") {
    return;
  }

  [LAST_ACTIVITY_COOKIE, REMEMBER_COOKIE, BROWSER_SESSION_COOKIE].forEach((cookieName) => {
    document.cookie = `${cookieName}=; path=/; Max-Age=0; SameSite=Lax`;
  });
}
