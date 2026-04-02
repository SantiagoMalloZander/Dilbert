import { createAdminSupabaseClient } from "@/lib/workspace-supabase";

export type IntegrationChannelType =
  | "whatsapp"
  | "whatsapp_personal"
  | "gmail"
  | "instagram"
  | "meet"
  | "zoom"
  | "teams";

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
  user_id: string;
  channel_type: string;
  status: "pending" | "connected";
  connected_at: string;
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
    channelType: "whatsapp",
    name: "WhatsApp Business",
    subtitle: "Meta API",
    fields: [
      {
        key: "businessAccountId",
        label: "Business Account ID",
        placeholder: "123456789012345",
      },
      {
        key: "phoneNumberId",
        label: "Phone Number ID",
        placeholder: "109876543210987",
      },
      {
        key: "permanentToken",
        label: "Permanent Token",
        placeholder: "EAAG...",
      },
    ],
  },
  {
    channelType: "whatsapp_personal",
    name: "WhatsApp (Personal)",
    subtitle: "Bridge personal",
    fields: [
      {
        key: "deviceName",
        label: "Nombre del dispositivo",
        placeholder: "iPhone de Ventas",
      },
      {
        key: "sessionToken",
        label: "Token de sesión",
        placeholder: "session_...",
      },
      {
        key: "webhookSecret",
        label: "Webhook Secret",
        placeholder: "secret_...",
      },
    ],
  },
  {
    channelType: "gmail",
    name: "Gmail",
    subtitle: "Inbox comercial",
    fields: [
      {
        key: "workspaceEmail",
        label: "Email de la cuenta",
        placeholder: "ventas@empresa.com",
      },
      {
        key: "clientId",
        label: "Client ID",
        placeholder: "google-client-id.apps.googleusercontent.com",
      },
      {
        key: "refreshToken",
        label: "Refresh Token",
        placeholder: "1//0g...",
      },
    ],
  },
  {
    channelType: "instagram",
    name: "Instagram DMs",
    subtitle: "Meta Messaging",
    fields: [
      {
        key: "appId",
        label: "App ID",
        placeholder: "1234567890",
      },
      {
        key: "appSecret",
        label: "App Secret",
        placeholder: "meta-secret",
      },
      {
        key: "instagramAccountId",
        label: "Instagram Account ID",
        placeholder: "1784...",
      },
    ],
  },
  {
    channelType: "meet",
    name: "Google Meet + Fathom",
    subtitle: "Meetings y notas",
    fields: [
      {
        key: "workspaceEmail",
        label: "Email de Google Workspace",
        placeholder: "reuniones@empresa.com",
      },
      {
        key: "calendarId",
        label: "Calendar ID",
        placeholder: "primary",
      },
      {
        key: "fathomApiKey",
        label: "Fathom API Key",
        placeholder: "fathom_...",
      },
    ],
  },
  {
    channelType: "zoom",
    name: "Zoom",
    subtitle: "Video sales",
    fields: [
      {
        key: "accountEmail",
        label: "Email de la cuenta",
        placeholder: "ventas@empresa.com",
      },
      {
        key: "clientId",
        label: "Client ID",
        placeholder: "zoom-client-id",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        placeholder: "zoom-client-secret",
      },
    ],
  },
  {
    channelType: "teams",
    name: "Microsoft Teams",
    subtitle: "Meetings y mensajes",
    fields: [
      {
        key: "tenantId",
        label: "Tenant ID",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
      {
        key: "clientId",
        label: "Client ID",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        placeholder: "teams-client-secret",
      },
    ],
  },
];

function getDefinition(channelType: string) {
  return INTEGRATION_DEFINITIONS.find((channel) => channel.channelType === channelType);
}

function mapRowStatus(row?: ChannelCredentialRow | null): IntegrationConnectionStatus {
  if (!row) {
    return "disconnected";
  }

  return row.status === "pending" ? "pending" : "connected";
}

export async function getVendorIntegrationsData(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("channel_credentials")
    .select("user_id, channel_type, status, connected_at, credentials")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const rows = ((data as ChannelCredentialRow[] | null) || []).filter((row) =>
    getDefinition(row.channel_type)
  );
  const rowsByType = new Map(rows.map((row) => [row.channel_type, row]));

  return {
    channels: INTEGRATION_DEFINITIONS.map((channel) => {
      const row = rowsByType.get(channel.channelType);
      return {
        channelType: channel.channelType,
        name: channel.name,
        subtitle: channel.subtitle,
        status: mapRowStatus(row),
        connectedAt: row?.connected_at || null,
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
      .select("user_id, channel_type, status, connected_at, credentials")
      .in("user_id", vendorIds);

    if (error) {
      throw error;
    }

    credentialRows = ((data as ChannelCredentialRow[] | null) || []).filter((row) =>
      getDefinition(row.channel_type)
    );
  }

  const credentialsByVendor = new Map<string, OwnerVendorIntegrationRecord[]>();
  for (const row of credentialRows) {
    const definition = getDefinition(row.channel_type);
    if (!definition) {
      continue;
    }

    const existing = credentialsByVendor.get(row.user_id) || [];
    existing.push({
      channelType: definition.channelType,
      name: definition.name,
      status: row.status === "pending" ? "pending" : "connected",
      connectedAt: row.connected_at || null,
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
  channelType: IntegrationChannelType;
  credentials: Record<string, string>;
}) {
  const supabase = createAdminSupabaseClient();
  const payload = {
    ...params.credentials,
    submitted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("channel_credentials").upsert(
    {
      user_id: params.userId,
      channel_type: params.channelType,
      credentials: payload,
      status: "pending",
      connected_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,channel_type",
    }
  );

  if (error) {
    throw error;
  }
}

export async function disconnectVendorIntegration(params: {
  userId: string;
  channelType: IntegrationChannelType;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("channel_credentials")
    .delete()
    .eq("user_id", params.userId)
    .eq("channel_type", params.channelType);

  if (error) {
    throw error;
  }
}
