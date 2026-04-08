import { cache } from "react";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr";

type CompanyStatus = "active" | "inactive" | "suspended";
type CompanySettings = {
  owner_invite?: {
    email?: string | null;
    name?: string | null;
  } | null;
};

type CompanyRow = {
  id: string;
  name: string;
  vendor_limit: number;
  created_at: string;
  status: CompanyStatus;
  settings: CompanySettings | null;
};

type UserRow = {
  id: string;
  company_id: string;
  email: string;
  name: string;
  role: "owner" | "analyst" | "vendor";
  created_at: string;
  is_active: boolean;
};

export type AdminVendorRecord = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  status: "active" | "inactive";
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
    id: string | null;
    email: string;
    name: string;
    state: "active" | "pending";
  } | null;
  vendors: AdminVendorRecord[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function groupUsersByCompany(users: UserRow[]) {
  return users.reduce<Map<string, UserRow[]>>((accumulator, user) => {
    const current = accumulator.get(user.company_id) || [];
    current.push(user);
    accumulator.set(user.company_id, current);
    return accumulator;
  }, new Map());
}

function getFallbackOwner(company: CompanyRow) {
  const ownerInvite = company.settings?.owner_invite;
  const email = ownerInvite?.email ? normalizeEmail(ownerInvite.email) : "";

  if (!email) {
    return null;
  }

  return {
    id: null,
    email,
    name: ownerInvite?.name?.trim() || email,
    state: "pending" as const,
  };
}

export async function listAdminCompanies() {
  const supabase = createAdminSupabaseClient();
  const [{ data: companies, error: companiesError }, { data: users, error: usersError }] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, name, vendor_limit, created_at, status, settings")
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("id, company_id, email, name, role, created_at, is_active")
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
    const ownerUser = companyUsers.find((user) => user.role === "owner") || null;
    const fallbackOwner = getFallbackOwner(company);
    const vendors = companyUsers
      .filter((user) => user.role === "vendor")
      .map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
        status: user.is_active ? ("active" as const) : ("inactive" as const),
      }));

    return {
      id: company.id,
      name: company.name,
      vendorLimit: company.vendor_limit,
      activeVendors: vendors.filter((vendor) => vendor.status === "active").length,
      totalUsers: companyUsers.length,
      createdAt: company.created_at,
      status: company.status,
      owner: ownerUser
        ? {
            id: ownerUser.id,
            email: ownerUser.email,
            name: ownerUser.name,
            state: "active" as const,
          }
        : fallbackOwner,
      vendors,
    } satisfies AdminCompanyRecord;
  });
}

export const getCompanyById = cache(async function getCompanyById(companyId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, status")
      .eq("id", companyId)
      .maybeSingle();

    if (error) {
      console.error("[getCompanyById] Supabase query error:", {
        companyId,
        error: error.message,
        code: error.code,
      });
      throw error;
    }

    console.log("[getCompanyById] Successfully fetched company:", {
      companyId,
      found: !!data,
    });

    return data as
      | {
          id: string;
          name: string;
          status: CompanyStatus;
        }
      | null;
  } catch (error) {
    console.error("[getCompanyById] Unexpected error:", {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});
