/**
 * Evolution API client (v1.8.x, WHATSAPP-BAILEYS).
 *
 * Thin wrapper around the self-hosted Evolution server. Used only server-side
 * (needs the global apikey). One Evolution "instance" == one connected WhatsApp
 * line == one vendor in our model.
 *
 * Endpoints confirmed against the live server (v1.8.6):
 *   POST   /instance/create            { instanceName, qrcode, integration }
 *   GET    /instance/connect/{name}    -> { base64, code, pairingCode, count }
 *   GET    /instance/connectionState/{name} -> { instance: { state } }
 *   GET    /instance/fetchInstances    -> [{ instance: { owner, profileName, ... } }]
 *   POST   /webhook/set/{name}         { url, webhook_by_events, events }  (flat body)
 *   POST   /chat/findMessages/{name}   { where }
 *   DELETE /instance/delete/{name}
 *   POST   /instance/logout/{name}
 */

const BAILEYS = "WHATSAPP-BAILEYS";

function getConfig() {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("EVOLUTION_NOT_CONFIGURED");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

async function evoFetch<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<{ ok: boolean; status: number; data: T }> {
  const { baseUrl, apiKey } = getConfig();
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    // Evolution on Render free-tier can cold-start (~10s); give it room.
    signal: AbortSignal.timeout(60_000),
  });

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null as T;
  }
  return { ok: res.ok, status: res.status, data };
}

export type ConnectionState = "open" | "connecting" | "close" | "unknown";

export type QrPayload = {
  base64: string | null; // data:image/png;base64,... ready to render in <img>
  code: string | null; // raw QR string (fallback)
  pairingCode: string | null; // phone-pairing code (alternative to QR)
};

/** Create the instance if missing. Idempotent-ish: a 403/409 "already exists" is treated as ok. */
export async function ensureInstance(instanceName: string): Promise<void> {
  const { ok, status, data } = await evoFetch(`/instance/create`, {
    method: "POST",
    json: { instanceName, qrcode: true, integration: BAILEYS },
  });
  if (ok || status === 201) return;
  const msg = JSON.stringify(data ?? "");
  if (status === 403 || status === 409 || /already in use|already exists/i.test(msg)) {
    return; // instance already created previously
  }
  throw new Error(`EVOLUTION_CREATE_FAILED: ${status} ${msg.slice(0, 200)}`);
}

/** Point the instance's webhook at our receiver (flat body shape for v1.8.x). */
export async function setWebhook(instanceName: string, url: string): Promise<void> {
  const { ok, status, data } = await evoFetch(`/webhook/set/${instanceName}`, {
    method: "POST",
    json: {
      url,
      webhook_by_events: false,
      webhook_base64: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    },
  });
  if (!ok) {
    throw new Error(`EVOLUTION_WEBHOOK_FAILED: ${status} ${JSON.stringify(data).slice(0, 200)}`);
  }
}

/** Trigger a connect and return the QR / pairing payload. */
export async function connectInstance(instanceName: string): Promise<QrPayload> {
  const { ok, status, data } = await evoFetch<{
    base64?: string;
    code?: string;
    pairingCode?: string;
  }>(`/instance/connect/${instanceName}`, { method: "GET" });
  if (!ok) {
    throw new Error(`EVOLUTION_CONNECT_FAILED: ${status}`);
  }
  return {
    base64: data?.base64 ?? null,
    code: data?.code ?? null,
    pairingCode: data?.pairingCode ?? null,
  };
}

export async function getConnectionState(instanceName: string): Promise<ConnectionState> {
  const { ok, data } = await evoFetch<{ instance?: { state?: string } }>(
    `/instance/connectionState/${instanceName}`,
    { method: "GET" }
  );
  if (!ok) return "unknown";
  const state = data?.instance?.state;
  if (state === "open" || state === "connecting" || state === "close") return state;
  return "unknown";
}

/** Returns the connected owner phone (digits) once the line is open, else null. */
export async function getInstanceOwnerPhone(instanceName: string): Promise<string | null> {
  const { ok, data } = await evoFetch<
    Array<{ instance?: { instanceName?: string; owner?: string } }>
  >(`/instance/fetchInstances`, { method: "GET" });
  if (!ok || !Array.isArray(data)) return null;
  const match = data.find((i) => i.instance?.instanceName === instanceName);
  const owner = match?.instance?.owner;
  if (!owner) return null;
  return digitsFromJid(owner);
}

export async function logoutInstance(instanceName: string): Promise<void> {
  await evoFetch(`/instance/logout/${instanceName}`, { method: "DELETE" }).catch(() => undefined);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await evoFetch(`/instance/delete/${instanceName}`, { method: "DELETE" }).catch(() => undefined);
}

// ── Backfill ────────────────────────────────────────────────────────────────────

export type RawWhatsAppMessage = {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  message?: Record<string, unknown> | null;
  messageType?: string;
  pushName?: string;
  messageTimestamp?: number | string;
};

/** Fetch stored messages for history backfill. v1 returns a flat array. */
export async function findMessages(instanceName: string): Promise<RawWhatsAppMessage[]> {
  const { ok, data } = await evoFetch<RawWhatsAppMessage[] | { messages?: { records?: RawWhatsAppMessage[] } }>(
    `/chat/findMessages/${instanceName}`,
    { method: "POST", json: { where: {} } }
  );
  if (!ok) return [];
  if (Array.isArray(data)) return data;
  // Some builds wrap it; be defensive.
  return data?.messages?.records ?? [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract digits-only phone from a WhatsApp JID like "5491122334455@s.whatsapp.net". */
export function digitsFromJid(jid: string | undefined | null): string {
  if (!jid) return "";
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "");
}

const IGNORED_JID_SUFFIXES = ["@g.us", "@broadcast", "@newsletter"];

/** Groups, status broadcasts and newsletters are never CRM conversations. */
export function isIgnorableJid(jid: string | undefined | null): boolean {
  if (!jid) return true;
  if (jid === "status@broadcast") return true;
  return IGNORED_JID_SUFFIXES.some((suffix) => jid.endsWith(suffix));
}

/** Pull human-readable text out of the many WhatsApp message shapes. Returns "" if none. */
export function extractMessageText(message: Record<string, unknown> | null | undefined): string {
  if (!message) return "";
  const m = message as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.documentWithCaptionMessage?.message?.documentMessage?.caption ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    m.ephemeralMessage?.message?.extendedTextMessage?.text ??
    m.ephemeralMessage?.message?.conversation ??
    ""
  ).toString().trim();
}
