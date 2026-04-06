import { randomBytes } from "crypto";
import { Resend } from "resend";
import { normalizeEmail } from "@/lib/workspace-auth-flow";
import { createAdminSupabaseClient } from "@/lib/workspace-supabase";

type CompanyStatus = "active" | "inactive";
type AppRole = "owner" | "analyst" | "vendor";

type CompanyRow = {
  id: string;
  name: string;
  vendor_limit: number;
  created_at: string;
  status: CompanyStatus;
};

type UserRow = {
  id: string;
  company_id: string | null;
  email: string;
  name: string;
  role: AppRole | null;
  created_at: string;
};

export type AdminVendorRecord = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type AdminCompanyRecord = {
  id: string;
  name: string;
  vendorLimit: number;
  activeVendors: number;
  totalUsers: number;
  createdAt: string;
  status: CompanyStatus;
  owner: {
    id: string;
    email: string;
    name: string;
  } | null;
  vendors: AdminVendorRecord[];
};

function getResendClient() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function getLoginUrl() {
  return process.env.DILBERT_APP_LOGIN_URL || "https://dilvert.netlify.app/app/";
}

function generateTemporaryPassword() {
  return `Dilbert!${randomBytes(5).toString("hex")}9`;
}

async function findAuthUserByEmail(email: string) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const matchedUser = data.users.find(
      (candidate) => normalizeEmail(candidate.email || "") === normalizedEmail
    );

    if (matchedUser) {
      return matchedUser;
    }

    if (data.users.length < 200) {
      break;
    }
  }

  return null;
}

async function sendOwnerProvisioningEmail(params: {
  companyName: string;
  ownerEmail: string;
  ownerName: string;
  temporaryPassword: string;
}) {
  const resend = getResendClient();
  const loginUrl = getLoginUrl();

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.ownerEmail,
    subject: "Tu acceso a Dilbert está listo",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#F5F0E8;color:#1A1A1A;padding:32px">
        <div style="max-width:560px;margin:0 auto;background:white;border:3px solid #2A1A0A;border-radius:12px;padding:32px;box-shadow:4px 4px 0px #2A1A0A">
          <p style="margin:0 0 16px;font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:#D4420A;font-weight:600">DILBERT.</p>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#1A1A1A;font-weight:700">Tu acceso está listo</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1A1A1A">Hola ${params.ownerName},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1A1A1A">Ya podés administrar <strong>${params.companyName}</strong> en Dilbert. Entrá con tu email y contraseña:</p>

          <p style="margin:0 0 8px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#1A1A1A;font-weight:600">Email</p>
          <p style="margin:0 0 20px;font-size:15px;color:#1A1A1A;font-weight:500">${params.ownerEmail}</p>

          <p style="margin:0 0 8px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#1A1A1A;font-weight:600">Contraseña temporal</p>
          <div style="margin:0 0 20px;padding:16px;background:#F5F0E8;border:2px solid #2A1A0A;border-radius:6px;font-family:monospace">
            <p style="margin:0;font-size:18px;font-weight:700;color:#1A1A1A;letter-spacing:.05em">${params.temporaryPassword}</p>
          </div>

          <p style="margin:0 0 8px;font-size:12px;color:#1A1A1A/70;letter-spacing:.05em">🔗 ENLACE DE ACCESO</p>
          <p style="margin:0 0 24px"><a href="${loginUrl}" style="display:inline-block;background:#D4420A;color:#F5F0E8;padding:12px 24px;text-decoration:none;border-radius:24px;font-weight:600;font-size:14px">Abrir Dilbert</a></p>

          <div style="margin:24px 0 0;padding:16px;background:#F5F0E8;border-left:3px solid #D4420A;border-radius:4px">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1A1A1A">⚙️ Lo que sigue</p>
            <ol style="margin:0;padding-left:20px;font-size:13px;color:#1A1A1A;line-height:1.6">
              <li>Abre el link de arriba</li>
              <li>Accedé con tu email y contraseña temporal</li>
              <li>Cambia tu contraseña en "Mi Perfil" → "Cambiar contraseña"</li>
              <li>Ve a "Centro de Usuarios" para agregar a tu equipo</li>
            </ol>
          </div>

          <p style="margin:24px 0 0;font-size:12px;color:#1A1A1A/60;text-align:center;border-top:1px solid #2A1A0A;padding-top:16px">Si no pediste esta cuenta, contactá a tu administrador.</p>
        </div>
      </div>
    `,
  });
}

function groupUsersByCompany(users: UserRow[]) {
  const groupedUsers = new Map<string, UserRow[]>();

  users.forEach((user) => {
    if (!user.company_id) {
      return;
    }

    const companyUsers = groupedUsers.get(user.company_id) || [];
    companyUsers.push(user);
    groupedUsers.set(user.company_id, companyUsers);
  });

  return groupedUsers;
}

export async function listAdminCompanies() {
  const supabase = createAdminSupabaseClient();
  const [{ data: companies, error: companiesError }, { data: users, error: usersError }] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, name, vendor_limit, created_at, status")
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("id, company_id, email, name, role, created_at")
        .order("created_at", { ascending: true }),
    ]);

  if (companiesError) {
    throw companiesError;
  }

  if (usersError) {
    throw usersError;
  }

  const usersByCompany = groupUsersByCompany((users as UserRow[] | null) || []);

  return ((companies as CompanyRow[] | null) || []).map((company) => {
    const companyUsers = usersByCompany.get(company.id) || [];
    const owner =
      companyUsers.find((user) => user.role === "owner") || null;
    const vendors = companyUsers
      .filter((user) => user.role === "vendor")
      .map((vendor) => ({
        id: vendor.id,
        email: vendor.email,
        name: vendor.name,
        createdAt: vendor.created_at,
      }));

    return {
      id: company.id,
      name: company.name,
      vendorLimit: company.vendor_limit,
      activeVendors: vendors.length,
      totalUsers: companyUsers.length,
      createdAt: company.created_at,
      status: company.status,
      owner: owner
        ? {
            id: owner.id,
            email: owner.email,
            name: owner.name,
          }
        : null,
      vendors,
    } satisfies AdminCompanyRecord;
  });
}

export async function createCompanyWithOwner(input: {
  companyName: string;
  ownerEmail: string;
  ownerName: string;
  vendorLimit: number;
}) {
  const supabase = createAdminSupabaseClient();
  const companyName = input.companyName.trim();
  const ownerName = input.ownerName.trim();
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const vendorLimit = Math.floor(input.vendorLimit);

  if (!companyName) {
    throw new Error("COMPANY_NAME_REQUIRED");
  }

  if (!ownerName) {
    throw new Error("OWNER_NAME_REQUIRED");
  }

  if (!ownerEmail) {
    throw new Error("OWNER_EMAIL_REQUIRED");
  }

  if (!Number.isFinite(vendorLimit) || vendorLimit < 1) {
    throw new Error("INVALID_VENDOR_LIMIT");
  }

  await getResendClient();

  const [existingAuthUser, existingAppUser] = await Promise.all([
    findAuthUserByEmail(ownerEmail),
    supabase.from("users").select("id").eq("email", ownerEmail).maybeSingle(),
  ]);

  if (existingAppUser.error) {
    throw existingAppUser.error;
  }

  if (existingAuthUser || existingAppUser.data) {
    throw new Error("OWNER_EMAIL_ALREADY_EXISTS");
  }

  const temporaryPassword = generateTemporaryPassword();
  let companyId: string | null = null;
  let authUserId: string | null = null;

  try {
    const { data: createdCompany, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        vendor_limit: vendorLimit,
        status: "active",
      })
      .select("id, name")
      .single();

    if (companyError) {
      throw companyError;
    }

    companyId = createdCompany.id as string;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: ownerName,
      },
    });

    if (authError || !authData.user) {
      throw authError || new Error("OWNER_AUTH_CREATION_FAILED");
    }

    authUserId = authData.user.id;

    const { error: userError } = await supabase.from("users").insert({
      id: authData.user.id,
      company_id: companyId,
      email: ownerEmail,
      name: ownerName,
      role: "owner",
    });

    if (userError) {
      throw userError;
    }

    const { error: authorizedEmailError } = await supabase.from("authorized_emails").insert({
      company_id: companyId,
      email: ownerEmail,
      added_by: authData.user.id,
      role: "owner",
    });

    if (authorizedEmailError) {
      throw authorizedEmailError;
    }

    await sendOwnerProvisioningEmail({
      companyName,
      ownerEmail,
      ownerName,
      temporaryPassword,
    });

    return {
      companyId,
      ownerId: authData.user.id,
      temporaryPassword,
    };
  } catch (error) {
    if (authUserId) {
      await supabase.auth.admin.deleteUser(authUserId).catch(() => undefined);
    }

    if (companyId) {
      try {
        await supabase.from("companies").delete().eq("id", companyId);
      } catch {
        // Ignore rollback failures and surface the original provisioning error.
      }
    }

    throw error;
  }
}

export async function updateCompanyVendorLimit(companyId: string, vendorLimit: number) {
  const supabase = createAdminSupabaseClient();
  const normalizedLimit = Math.floor(vendorLimit);

  if (!Number.isFinite(normalizedLimit) || normalizedLimit < 1) {
    throw new Error("INVALID_VENDOR_LIMIT");
  }

  const { count: activeVendorCount, error: vendorCountError } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "vendor");

  if (vendorCountError) {
    throw vendorCountError;
  }

  if ((activeVendorCount || 0) > normalizedLimit) {
    throw new Error("VENDOR_LIMIT_BELOW_ACTIVE_COUNT");
  }

  const { error } = await supabase
    .from("companies")
    .update({
      vendor_limit: normalizedLimit,
    })
    .eq("id", companyId);

  if (error) {
    throw error;
  }
}

export async function deactivateCompany(companyId: string) {
  const supabase = createAdminSupabaseClient();

  const { error: vendorError } = await supabase
    .from("users")
    .update({
      role: "analyst",
    })
    .eq("company_id", companyId)
    .eq("role", "vendor");

  if (vendorError) {
    throw vendorError;
  }

  const { error: companyError } = await supabase
    .from("companies")
    .update({
      status: "inactive",
    })
    .eq("id", companyId);

  if (companyError) {
    throw companyError;
  }
}

export async function demoteVendor(params: {
  companyId: string;
  userId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, company_id, role")
    .eq("id", params.userId)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("VENDOR_NOT_FOUND");
  }

  if (user.company_id !== params.companyId) {
    throw new Error("VENDOR_COMPANY_MISMATCH");
  }

  if (user.role !== "vendor") {
    return;
  }

  const { error } = await supabase
    .from("users")
    .update({
      role: "analyst",
    })
    .eq("id", params.userId);

  if (error) {
    throw error;
  }
}

export async function getCompanyById(companyId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, status")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as
    | {
        id: string;
        name: string;
        status: CompanyStatus;
      }
    | null;
}
