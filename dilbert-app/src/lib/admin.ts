import { randomBytes } from "crypto";
import { Resend } from "resend";
import { normalizeEmail } from "@/lib/auth-flow";
import { createAdminSupabaseClient } from "@/lib/supabase";

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
  return process.env.DILBERT_APP_LOGIN_URL || "https://dilbert.netlify.app/app/";
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
    subject: "Tu cuenta de Dilbert fue creada",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#08111f;color:#f7f9fb;padding:32px">
        <div style="max-width:560px;margin:0 auto;background:#101a2e;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px">
          <p style="margin:0 0 12px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#69e6c5">Dilbert</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.1">Tu cuenta de Dilbert fue creada</h1>
          <p style="margin:0 0 16px;color:#b5c0d5">Hola ${params.ownerName}, ya tenés acceso para administrar ${params.companyName}.</p>
          <p style="margin:0 0 16px;color:#b5c0d5">Entrá a <a href="${loginUrl}" style="color:#69e6c5;text-decoration:none">${loginUrl}</a> y accedé con tu mail.</p>
          <div style="margin:24px 0;padding:18px;border-radius:16px;background:#08111f;border:1px solid rgba(255,255,255,0.08)">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8ca0c3">Contraseña temporal</p>
            <p style="margin:0;font-size:24px;font-weight:700;letter-spacing:.08em">${params.temporaryPassword}</p>
          </div>
          <p style="margin:0;color:#8ca0c3;font-size:13px">Si preferís, también podés continuar con Google o Microsoft si ese proveedor está asociado al mismo email.</p>
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
