import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type IntegrationChannelType =
  | "whatsapp_personal"
  | "whatsapp_business"
  | "gmail"
  | "fathom";

export type IntegrationConnectionStatus =
  | "disconnected"
  | "pending"
  | "connected";

export type IntegrationFieldDefinition = {
  key: string;
  label: string;
  placeholder: string;
};

export type IntegrationDefinition = {
  channelType: IntegrationChannelType;
  name: string;
  subtitle: string;
  fields: IntegrationFieldDefinition[];
};

type ChannelCredentialRow = {
  company_id: string;
  user_id: string;
  channel: string;
  status: "pending" | "connected" | "error" | "disconnected";
  updated_at: string;
  last_sync_at: string | null;
  credentials: Record<string, string> | null;
};

type VendorRow = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
};

export type VendorIntegrationRecord = {
  channelType: IntegrationChannelType;
  name: string;
  subtitle: string;
  status: IntegrationConnectionStatus;
  connectedAt: string | null;
};

export type VendorIntegrationsData = {
  channels: VendorIntegrationRecord[];
};

export type OwnerVendorIntegrationRecord = {
  channelType: IntegrationChannelType;
  name: string;
  status: Exclude<IntegrationConnectionStatus, "disconnected">;
  connectedAt: string | null;
};

export type OwnerVendorRecord = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  channels: OwnerVendorIntegrationRecord[];
};

export type OwnerIntegrationsData = {
  vendors: OwnerVendorRecord[];
};

export const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    channelType: "whatsapp_business",
    name: "WhatsApp Business",
    subtitle: "Evolution API",
    fields: [],
  },
  {
    channelType: "whatsapp_personal",
    name: "WhatsApp Personal",
    subtitle: "Evolution API",
    fields: [],
  },
  {
    channelType: "gmail",
    name: "Gmail",
    subtitle: "Emails comerciales",
    fields: [
      {
        key: "workspaceEmail",
        label: "Email de la cuenta",
        placeholder: "ventas@empresa.com",
      },
    ],
  },
  {
    channelType: "fathom",
    name: "Videollamadas — Fathom",
    subtitle: "Google Meet, Zoom y Teams",
    fields: [],
  },
];

function getDefinition(channelType: string) {
  return INTEGRATION_DEFINITIONS.find((channel) => channel.channelType === channelType);
}

export function toDatabaseChannelType(
  channelType: IntegrationChannelType
): "whatsapp_business" | "whatsapp_personal" | "gmail" | "fathom" {
  return channelType;
}

export function fromDatabaseChannelType(channel: string): IntegrationChannelType | null {
  switch (channel) {
    case "whatsapp_business":
    case "whatsapp_personal":
    case "gmail":
    case "fathom":
      return channel;
    default:
      return null;
  }
}

function getConnectedAt(row?: ChannelCredentialRow | null) {
  return row?.last_sync_at || row?.updated_at || null;
}

function mapRowStatus(row?: ChannelCredentialRow | null): IntegrationConnectionStatus {
  if (!row) {
    return "disconnected";
  }

  if (row.status === "pending") {
    return "pending";
  }

  return row.status === "connected" ? "connected" : "disconnected";
}

export async function getVendorIntegrationsData(userId: string, companyId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("channel_credentials")
    .select("company_id, user_id, channel, status, updated_at, last_sync_at, credentials")
    .eq("company_id", companyId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const rows = ((data as ChannelCredentialRow[] | null) || []).flatMap((row) => {
    const channelType = fromDatabaseChannelType(row.channel);
    return channelType ? [{ ...row, channel: channelType }] : [];
  });
  const rowsByType = new Map(rows.map((row) => [row.channel, row]));

  return {
    channels: INTEGRATION_DEFINITIONS.map((channel) => {
      const row = rowsByType.get(channel.channelType);
      return {
        channelType: channel.channelType,
        name: channel.name,
        subtitle: channel.subtitle,
        status: mapRowStatus(row),
        connectedAt: getConnectedAt(row),
      } satisfies VendorIntegrationRecord;
    }),
  } satisfies VendorIntegrationsData;
}

export async function getOwnerIntegrationsData(companyId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: vendors, error: vendorsError } = await supabase
    .from("users")
    .select("id, name, email, avatar_url")
    .eq("company_id", companyId)
    .eq("role", "vendor")
    .order("created_at", { ascending: true });

  if (vendorsError) {
    throw vendorsError;
  }

  const vendorRows = (vendors as VendorRow[] | null) || [];
  const vendorIds = vendorRows.map((vendor) => vendor.id);

  let credentialRows: ChannelCredentialRow[] = [];
  if (vendorIds.length > 0) {
    const { data, error } = await supabase
      .from("channel_credentials")
      .select("company_id, user_id, channel, status, updated_at, last_sync_at, credentials")
      .eq("company_id", companyId)
      .in("user_id", vendorIds);

    if (error) {
      throw error;
    }

    credentialRows = ((data as ChannelCredentialRow[] | null) || []).flatMap((row) => {
      const channelType = fromDatabaseChannelType(row.channel);
      return channelType ? [{ ...row, channel: channelType }] : [];
    });
  }

  const credentialsByVendor = new Map<string, OwnerVendorIntegrationRecord[]>();
  for (const row of credentialRows) {
    const definition = getDefinition(row.channel);
    if (!definition) {
      continue;
    }

    if (row.status !== "pending" && row.status !== "connected") {
      continue;
    }

    const existing = credentialsByVendor.get(row.user_id) || [];
    existing.push({
      channelType: definition.channelType,
      name: definition.name,
      status: row.status,
      connectedAt: getConnectedAt(row),
    });
    credentialsByVendor.set(row.user_id, existing);
  }

  return {
    vendors: vendorRows.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      email: vendor.email,
      avatarUrl: vendor.avatar_url,
      channels: (credentialsByVendor.get(vendor.id) || []).sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
    })),
  } satisfies OwnerIntegrationsData;
}

export async function connectVendorIntegration(params: {
  userId: string;
  companyId: string;
  channelType: IntegrationChannelType;
  credentials: Record<string, string>;
}) {
  const supabase = createAdminSupabaseClient();
  const payload = {
    ...params.credentials,
    submitted_at: new Date().toISOString(),
  };

  // Fathom and Gmail set their own status via their own routes —
  // this generic path is only used for WhatsApp.
  const initialStatus =
    params.channelType === "fathom" || params.channelType === "gmail"
      ? "connected"
      : "pending";

  const { error } = await supabase.from("channel_credentials").upsert(
    {
      company_id: params.companyId,
      user_id: params.userId,
      channel: toDatabaseChannelType(params.channelType),
      credentials: payload,
      status: initialStatus,
      last_sync_at: initialStatus === "connected" ? new Date().toISOString() : undefined,
    },
    {
      onConflict: "user_id,channel",
    }
  );

  if (error) {
    throw error;
  }
}

export async function disconnectVendorIntegration(params: {
  userId: string;
  companyId: string;
  channelType: IntegrationChannelType;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("channel_credentials")
    .delete()
    .eq("company_id", params.companyId)
    .eq("user_id", params.userId)
    .eq("channel", toDatabaseChannelType(params.channelType));

  if (error) {
    throw error;
  }
}
