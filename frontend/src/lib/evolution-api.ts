export type EvolutionInstanceStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface EvolutionMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  media?: {
    url: string;
    type: string;
  };
}

interface EvolutionInstanceResponse {
  instance?: {
    instanceName: string;
    status?: EvolutionInstanceStatus;
  };
}

interface EvolutionQrResponse {
  qrcode?: {
    base64: string;
  };
}

interface EvolutionInfoResponse {
  instance?: {
    status?: EvolutionInstanceStatus;
  };
}

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || "";

/**
 * Create a new WhatsApp instance in Evolution API
 */
export async function createEvolutionInstance(params: {
  phoneNumber?: string;
  isBusinessAccount: boolean;
  webhookUrl: string;
}): Promise<{ instanceName: string }> {
  const instanceName = `${
    params.isBusinessAccount ? "wpp-biz" : "wpp-personal"
  }-${Date.now()}`;

  const body: Record<string, unknown> = {
    instanceName,
    businessAccount: params.isBusinessAccount,
    webhook: {
      url: params.webhookUrl,
      enabled: true,
      events: ["messages.upsert", "messages.update", "connection.update"],
    },
  };

  if (params.phoneNumber) {
    body.number = params.phoneNumber.replace(/\D/g, "");
  }

  const response = await fetch(`${EVOLUTION_URL}/instance/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Evolution API error: ${error}`);
  }

  const data = (await response.json()) as EvolutionInstanceResponse;
  return { instanceName: data.instance?.instanceName || instanceName };
}

/**
 * Get QR code for WhatsApp Personal scanning
 */
export async function getInstanceQrCode(instanceName: string): Promise<string> {
  const response = await fetch(
    `${EVOLUTION_URL}/instance/qrcode/${instanceName}`,
    {
      headers: {
        apikey: EVOLUTION_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get QR code");
  }

  const data = (await response.json()) as EvolutionQrResponse;
  return data.qrcode?.base64 || "";
}

/**
 * Get current connection status of instance
 */
export async function getInstanceStatus(
  instanceName: string
): Promise<EvolutionInstanceStatus> {
  try {
    const response = await fetch(
      `${EVOLUTION_URL}/instance/info/${instanceName}`,
      {
        headers: {
          apikey: EVOLUTION_KEY,
        },
      }
    );

    if (!response.ok) return "error";

    const data = (await response.json()) as EvolutionInfoResponse;
    const rawStatus = data.instance?.status as string | undefined;
    // Evolution API v1 uses "open"/"close" as states
    if (rawStatus === "open") return "connected";
    if (rawStatus === "close" || rawStatus === "disconnected") return "disconnected";
    if (rawStatus === "connecting") return "connecting";
    return (rawStatus as EvolutionInstanceStatus) || "disconnected";
  } catch (error) {
    console.error("Failed to get instance status:", error);
    return "error";
  }
}

/**
 * Delete an Evolution API instance
 */
export async function deleteEvolutionInstance(
  instanceName: string
): Promise<void> {
  const response = await fetch(
    `${EVOLUTION_URL}/instance/delete/${instanceName}`,
    {
      method: "DELETE",
      headers: {
        apikey: EVOLUTION_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete instance");
  }
}
