const LOCAL_NEXTAUTH_URL = "http://localhost:3000/app/api/auth";

function normalizeUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function deriveNextAuthUrl() {
  if (process.env.NEXTAUTH_URL) {
    return normalizeUrl(process.env.NEXTAUTH_URL);
  }

  if (process.env.DILBERT_APP_LOGIN_URL) {
    const authUrl = new URL("api/auth", process.env.DILBERT_APP_LOGIN_URL);
    return normalizeUrl(authUrl.toString());
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_NEXTAUTH_URL;
  }

  return null;
}

export function ensureNextAuthEnvironment() {
  const nextAuthUrl = deriveNextAuthUrl();

  if (!nextAuthUrl) {
    return;
  }

  process.env.NEXTAUTH_URL ??= nextAuthUrl;
  process.env.NEXTAUTH_URL_INTERNAL ??= nextAuthUrl;
}

ensureNextAuthEnvironment();
