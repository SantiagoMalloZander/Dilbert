/**
 * Gmail API helpers — token refresh, message listing, MIME body extraction.
 * Uses the REST API directly (no SDK needed).
 */

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dilvert.netlify.app";
export const GMAIL_REDIRECT_URI = `${APP_URL}/app/api/integrations/gmail/callback`;

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

// ─── Token refresh ─────────────────────────────────────────────────────────────
export async function refreshGmailToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// ─── Gmail message types ───────────────────────────────────────────────────────
interface GmailMessagePart {
  mimeType: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
}

function header(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeB64(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractPlainText(parts: GmailMessagePart[] | undefined): string {
  if (!parts) return "";
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) return decodeB64(part.body.data);
    if (part.parts) {
      const found = extractPlainText(part.parts);
      if (found) return found;
    }
  }
  // HTML fallback
  for (const part of parts) {
    if (part.mimeType === "text/html" && part.body?.data) {
      return decodeB64(part.body.data)
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
    if (part.parts) {
      const found = extractPlainText(part.parts);
      if (found) return found;
    }
  }
  return "";
}

export interface ParsedEmail {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  toEmails: string[];
  date: Date;
  snippet: string;
  direction: "sent" | "received";
}

function extractEmails(raw: string): string[] {
  return Array.from(raw.matchAll(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gi)).map((m) =>
    m[0].toLowerCase()
  );
}

function parseMessage(msg: GmailMessage, vendorEmail: string): ParsedEmail {
  const hdrs = msg.payload.headers;
  const from = header(hdrs, "from");
  const to = header(hdrs, "to");
  const subject = header(hdrs, "subject") || "(Sin asunto)";
  const dateStr = header(hdrs, "date");
  const date = dateStr ? new Date(dateStr) : new Date(parseInt(msg.internalDate));
  const fromEmails = extractEmails(from);
  const toEmails = extractEmails(to);
  const direction: "sent" | "received" = fromEmails.includes(vendorEmail) ? "sent" : "received";
  return {
    id: msg.id,
    subject,
    from,
    fromEmail: fromEmails[0] ?? "",
    to,
    toEmails,
    date,
    snippet: extractPlainText(msg.payload.parts) ||
      (msg.payload.body?.data ? decodeB64(msg.payload.body.data) : ""),
    direction,
  };
}

// ─── Fetch a batch of messages matching a Gmail query ─────────────────────────
export async function listGmailMessages(
  accessToken: string,
  query: string,
  maxResults = 50
): Promise<{ id: string }[]> {
  const url = `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  const data = await res.json() as { messages?: { id: string }[] };
  return data.messages ?? [];
}

export async function getGmailMessage(
  accessToken: string,
  id: string
): Promise<GmailMessage | null> {
  const res = await fetch(`${GMAIL_BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<GmailMessage>;
}

export async function fetchParsedEmails(
  accessToken: string,
  vendorEmail: string,
  query: string,
  maxResults = 50
): Promise<ParsedEmail[]> {
  const ids = await listGmailMessages(accessToken, query, maxResults);
  if (!ids.length) return [];

  const results: ParsedEmail[] = [];
  // Fetch in batches of 10 to avoid overwhelming the API
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const msgs = await Promise.all(batch.map(({ id }) => getGmailMessage(accessToken, id)));
    for (const msg of msgs) {
      if (msg) results.push(parseMessage(msg, vendorEmail));
    }
  }
  return results;
}

// ─── Get vendor's Gmail address from Google ────────────────────────────────────
export async function getGmailProfile(accessToken: string): Promise<{ email: string } | null> {
  const res = await fetch(`${GMAIL_BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ email: string }>;
}
