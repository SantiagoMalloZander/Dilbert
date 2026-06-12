/**
 * YCloud API client (v2) — WhatsApp Business API provider for the company bot.
 *
 * Unlike Evolution (one shared self-hosted server), each tenant brings their OWN
 * YCloud account: the API key lives in companies.settings.bot_whatsapp and every
 * call here is made with that tenant key.
 *
 * Endpoints used (https://docs.ycloud.com):
 *   GET  /v2/whatsapp/phoneNumbers          -> list the account's WABA numbers
 *   GET  /v2/webhookEndpoints               -> list registered webhook endpoints
 *   POST /v2/webhookEndpoints               { url, enabledEvents }
 *   PATCH /v2/webhookEndpoints/{id}         update an existing endpoint
 */

const BASE_URL = "https://api.ycloud.com/v2";

/** Events we need: customer messages in, bot messages out. */
const WEBHOOK_EVENTS = [
  "whatsapp.inbound_message.received",
  "whatsapp.message.updated",
];

async function ycFetch<T = unknown>(
  apiKey: string,
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<{ ok: boolean; status: number; data: T }> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    signal: AbortSignal.timeout(20_000),
  });

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null as T;
  }
  return { ok: res.ok, status: res.status, data };
}

export type YCloudPhoneNumber = {
  phoneNumber?: string;
  displayPhoneNumber?: string;
  status?: string;
  verifiedName?: string;
};

/**
 * Validates the API key by listing the account's WhatsApp numbers.
 * Returns the numbers on success, throws YCLOUD_INVALID_KEY on 401/403.
 */
export async function listWhatsAppNumbers(apiKey: string): Promise<YCloudPhoneNumber[]> {
  const { ok, status, data } = await ycFetch<{ items?: YCloudPhoneNumber[] }>(
    apiKey,
    "/whatsapp/phoneNumbers?limit=100",
    { method: "GET" }
  );
  if (status === 401 || status === 403) throw new Error("YCLOUD_INVALID_KEY");
  if (!ok) throw new Error(`YCLOUD_LIST_NUMBERS_FAILED: ${status}`);
  return data?.items ?? [];
}

type WebhookEndpoint = { id?: string; url?: string; enabledEvents?: string[]; status?: string };

/**
 * Points the tenant's YCloud account at our webhook receiver. Idempotent: if an
 * endpoint for this exact URL already exists it's updated, otherwise created.
 */
export async function ensureWebhookEndpoint(apiKey: string, url: string): Promise<void> {
  const list = await ycFetch<{ items?: WebhookEndpoint[] }>(apiKey, "/webhookEndpoints?limit=100", {
    method: "GET",
  });

  const existing = (list.data?.items ?? []).find((e) => e.url === url);

  if (existing?.id) {
    const { ok, status } = await ycFetch(apiKey, `/webhookEndpoints/${existing.id}`, {
      method: "PATCH",
      json: { enabledEvents: WEBHOOK_EVENTS, status: "enabled" },
    });
    if (!ok) throw new Error(`YCLOUD_WEBHOOK_UPDATE_FAILED: ${status}`);
    return;
  }

  const { ok, status, data } = await ycFetch(apiKey, "/webhookEndpoints", {
    method: "POST",
    json: { url, enabledEvents: WEBHOOK_EVENTS },
  });
  if (!ok) {
    throw new Error(`YCLOUD_WEBHOOK_CREATE_FAILED: ${status} ${JSON.stringify(data).slice(0, 200)}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Digits-only phone ("+54 9 11..." -> "549 11..."). */
export function phoneDigits(phone: string | undefined | null): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** Loose phone equality tolerant to country-code / 9-prefix differences. */
export function samePhone(a: string, b: string): boolean {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const sa = da.slice(-10);
  const sb = db.slice(-10);
  return sa.length >= 8 && sa === sb;
}

// ── Webhook payload shapes ────────────────────────────────────────────────────

export type YCloudInboundMessage = {
  id?: string;
  wamid?: string;
  from?: string;
  to?: string;
  sendTime?: string;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  customerProfile?: { name?: string };
};

export type YCloudOutboundMessage = {
  id?: string;
  wamid?: string;
  from?: string;
  to?: string;
  status?: string;
  createTime?: string;
  type?: string;
  text?: { body?: string };
};

export type YCloudEvent = {
  id?: string;
  type?: string;
  createTime?: string;
  whatsappInboundMessage?: YCloudInboundMessage;
  whatsappMessage?: YCloudOutboundMessage;
};

/** Pulls human-readable text out of the message shapes we care about. */
export function extractInboundText(msg: YCloudInboundMessage): string {
  return (
    msg.text?.body ??
    msg.image?.caption ??
    msg.video?.caption ??
    msg.document?.caption ??
    msg.button?.text ??
    msg.interactive?.button_reply?.title ??
    msg.interactive?.list_reply?.title ??
    ""
  )
    .toString()
    .trim();
}
