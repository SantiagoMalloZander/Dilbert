import { randomUUID } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { getRoleLabel, type AppRole } from "@/lib/workspace-roles";
import {
  INTEGRATION_DEFINITIONS,
  fromDatabaseChannelType,
  type IntegrationChannelType,
} from "@/lib/workspace-integrations";
import { revokeAuthSessionsByUserId } from "@/lib/workspace-session-security";
import { getCompanyById } from "@/modules/admin/queries";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const PASSWORD_REGEX = /^(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

type UserRow = {
  id: string;
  company_id: string | null;
  email: string;
  name: string;
  avatar_url: string | null;
  role: AppRole | null;
  phone: string | null;
  created_at: string;
};

type ChannelCredentialRow = {
  channel_type: string;
  connected_at: string;
  status: "pending" | "connected" | null;
};

export type AccountChannelRecord = {
  type: IntegrationChannelType;
  label: string;
  status: "connected" | "disconnected";
  connectedAt: string | null;
};

export type AccountPageData = {
  name: string;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  companyName: string;
  role: AppRole;
  roleLabel: string;
  createdAt: string;
  hasPassword: boolean;
  oauthOnly: boolean;
  channels: AccountChannelRecord[];
};

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}

function getAvatarPathFromUrl(url: string | null) {
  if (!url) {
    return null;
  }

  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) {
    return null;
  }

  return url.slice(index + marker.length);
}

function readProviders(authUser: {
  app_metadata?: Record<string, unknown> | null;
  identities?: Array<{ provider?: string | null }> | null;
}) {
  const providers = new Set<string>();
  const rawProviders = authUser.app_metadata?.providers;

  if (Array.isArray(rawProviders)) {
    for (const provider of rawProviders) {
      if (typeof provider === "string" && provider) {
        providers.add(provider);
      }
    }
  }

  const provider = authUser.app_metadata?.provider;
  if (typeof provider === "string" && provider) {
    providers.add(provider);
  }

  if (Array.isArray(authUser.identities)) {
    for (const identity of authUser.identities) {
      if (typeof identity?.provider === "string" && identity.provider) {
        providers.add(identity.provider);
      }
    }
  }

  return [...providers];
}

function validatePasswordStrength(password: string) {
  return PASSWORD_REGEX.test(password);
}

async function getAuthUserById(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    throw error;
  }

  return data.user;
}

async function getAccountUser(userId: string, companyId?: string | null) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("users")
    .select("id, company_id, email, name, avatar_url, role, phone, created_at")
    .eq("id", userId);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return (data as UserRow | null) ?? null;
}

async function ensureAvatarBucket() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw error;
  }

  const exists = data.some((bucket) => bucket.name === AVATAR_BUCKET);
  if (exists) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_AVATAR_SIZE_BYTES}`,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });

  if (createError && !String(createError.message || "").includes("already exists")) {
    throw createError;
  }
}

async function syncAuthUserMetadata(params: {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const authUser = await getAuthUserById(params.userId);
  const nextUserMetadata = {
    ...(authUser.user_metadata || {}),
    full_name: params.fullName,
    avatar_url: params.avatarUrl,
  };

  const { error } = await supabase.auth.admin.updateUserById(params.userId, {
    user_metadata: nextUserMetadata,
  });

  if (error) {
    throw error;
  }
}

export async function getAccountPageData(params: {
  userId: string;
  companyId?: string | null;
  email?: string | null;
  role?: AppRole;
}) {
  const supabase = await createServerSupabaseClient();
  const [userRow, company] = await Promise.all([
    getAccountUser(params.userId, params.companyId),
    params.companyId ? getCompanyById(params.companyId) : Promise.resolve(null),
  ]);

  // Try to fetch auth user for provider info — optional, userRow is enough fallback
  let authUser = null;
  try {
    authUser = await getAuthUserById(params.userId);
  } catch {
    // auth.admin may fail in some contexts; fall back to userRow data
  }

  let channelRows: ChannelCredentialRow[] = [];
  try {
    // @ts-ignore - Supabase types may not reflect latest schema; runtime query is correct
    const { data: channelData, error: channelError } = await supabase
      .from("channel_credentials")
      .select("channel_type, connected_at, status")
      .eq("user_id", params.userId);

    if (!channelError && channelData) {
      channelRows = (channelData as unknown as ChannelCredentialRow[]) || [];
    }
  } catch {
    // If channel_credentials query fails, continue without channels (not a critical field)
  }

  const providers = authUser ? readProviders(authUser) : [];
  const hasPassword = providers.includes("email");
  const channelMap = new Map(
    ((channelRows || []).flatMap((channel) => {
      const channelType = fromDatabaseChannelType(channel.channel_type);
      return channelType ? [[channelType, channel] as const] : [];
    }) || [])
  );

  const channels = INTEGRATION_DEFINITIONS.map((channel) => {
    const row = channelMap.get(channel.channelType);
    return {
      type: channel.channelType,
      label: channel.name,
      status: row && (row.status === "pending" || row.status === "connected")
        ? "connected"
        : "disconnected",
      connectedAt: row?.connected_at || null,
    } satisfies AccountChannelRecord;
  });

  return {
    name:
      userRow?.name ||
      (authUser ? String(authUser.user_metadata?.full_name || "").trim() : "") ||
      params.email ||
      "Usuario Dilbert",
    email: userRow?.email || (authUser?.email) || params.email || "",
    avatarUrl:
      userRow?.avatar_url || (authUser ? String(authUser.user_metadata?.avatar_url || "") : "") || null,
    phone: userRow?.phone || null,
    companyName: company?.name || "Sin empresa asignada",
    role: (userRow?.role || params.role || "analyst") as AppRole,
    roleLabel: getRoleLabel((userRow?.role || params.role || "analyst") as AppRole),
    createdAt: userRow?.created_at || (authUser?.created_at) || new Date().toISOString(),
    hasPassword,
    oauthOnly: !hasPassword,
    channels,
  } satisfies AccountPageData;
}

export async function updateAccountProfile(params: {
  userId: string;
  companyId?: string | null;
  fullName: string;
  phone: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const user = await getAccountUser(params.userId, params.companyId);

  if (!user) {
    throw new Error("ACCOUNT_USER_NOT_FOUND");
  }

  if (!user.company_id) {
    throw new Error("ACCOUNT_COMPANY_REQUIRED");
  }

  const fullName = params.fullName.trim();
  if (!fullName) {
    throw new Error("PROFILE_NAME_REQUIRED");
  }

  const normalizedPhone = params.phone?.trim() || null;

  const { error } = await supabase
    .from("users")
    .update({
      name: fullName,
      phone: normalizedPhone,
    })
    .eq("id", params.userId)
    .eq("company_id", user.company_id);

  if (error) {
    throw error;
  }

  await syncAuthUserMetadata({
    userId: params.userId,
    fullName,
    avatarUrl: user.avatar_url,
  });

  return {
    name: fullName,
    phone: normalizedPhone,
  };
}

export async function uploadAccountAvatar(params: {
  userId: string;
  companyId?: string | null;
  file: File;
}) {
  if (!params.file.type.startsWith("image/")) {
    throw new Error("AVATAR_INVALID_TYPE");
  }

  if (params.file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error("AVATAR_TOO_LARGE");
  }

  const supabase = createAdminSupabaseClient();
  const user = await getAccountUser(params.userId, params.companyId);

  if (!user) {
    throw new Error("ACCOUNT_USER_NOT_FOUND");
  }

  if (!user.company_id) {
    throw new Error("ACCOUNT_COMPANY_REQUIRED");
  }

  await ensureAvatarBucket();

  const filePath = `${params.userId}/${randomUUID()}-${sanitizeFileName(params.file.name || "avatar")}`;
  const arrayBuffer = await params.file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: params.file.type,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const previousPath = getAvatarPathFromUrl(user.avatar_url);
  if (previousPath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]).catch(() => undefined);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("users")
    .update({
      avatar_url: publicUrl,
    })
    .eq("id", params.userId)
    .eq("company_id", user.company_id);

  if (updateError) {
    throw updateError;
  }

  await syncAuthUserMetadata({
    userId: params.userId,
    fullName: user.name,
    avatarUrl: publicUrl,
  });

  return {
    avatarUrl: publicUrl,
  };
}

export async function updateAccountPassword(params: {
  userId: string;
  email: string;
  currentPassword?: string;
  newPassword: string;
}) {
  if (!validatePasswordStrength(params.newPassword)) {
    throw new Error("PASSWORD_WEAK");
  }

  const supabase = createAdminSupabaseClient();
  const authUser = await getAuthUserById(params.userId);
  const providers = readProviders(authUser);
  const hasPassword = providers.includes("email");

  if (hasPassword) {
    const currentPassword = params.currentPassword?.trim() || "";
    if (!currentPassword) {
      throw new Error("CURRENT_PASSWORD_REQUIRED");
    }

    const authClient = await createServerSupabaseClient();
    const { error: signInError } = await authClient.auth.signInWithPassword({
      email: params.email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error("CURRENT_PASSWORD_INVALID");
    }
  }

  const nextAppMetadata = {
    ...(authUser.app_metadata || {}),
  };

  const { error } = await supabase.auth.admin.updateUserById(params.userId, {
    password: params.newPassword,
    app_metadata: nextAppMetadata,
  });

  if (error) {
    throw error;
  }

  return {
    hadPassword: hasPassword,
  };
}

export async function revokeAllAccountSessions(userId: string) {
  await revokeAuthSessionsByUserId(userId);
}
