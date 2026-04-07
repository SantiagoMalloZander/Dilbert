import { randomUUID } from "crypto";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  canAccessAdmin,
  canConnectChannels,
  canEditContact,
  canEditLeads,
  canManageUsers,
  canViewAllLeads,
  resolveProtectedRouteRedirect,
} from "@/lib/auth/permissions";

test("permission helpers follow the role matrix", async () => {
  expect(canManageUsers("owner")).toBe(true);
  expect(canManageUsers("vendor")).toBe(false);

  expect(canEditLeads("owner")).toBe(true);
  expect(canEditLeads("vendor")).toBe(true);
  expect(canEditLeads("analyst")).toBe(false);

  expect(canViewAllLeads("owner")).toBe(true);
  expect(canViewAllLeads("analyst")).toBe(true);
  expect(canViewAllLeads("vendor")).toBe(false);

  expect(canConnectChannels("vendor")).toBe(true);
  expect(canConnectChannels("owner")).toBe(false);

  expect(canAccessAdmin("dilbert@gmail.com")).toBe(true);
  expect(canAccessAdmin("owner@demo.com")).toBe(false);

  expect(canEditContact("owner", "user-a", "user-b")).toBe(true);
  expect(canEditContact("vendor", "user-a", "user-a")).toBe(true);
  expect(canEditContact("vendor", "user-a", "user-b")).toBe(false);
  expect(canEditContact("analyst", "user-a", "user-a")).toBe(false);
});

test("route guards redirect forbidden roles to /app/crm", async () => {
  expect(
    resolveProtectedRouteRedirect({
      pathname: "/app/users",
      email: "vendor@demo.com",
      role: "vendor",
      isAuthenticated: true,
    })
  ).toBe("/app/crm");

  expect(
    resolveProtectedRouteRedirect({
      pathname: "/app/integrations",
      email: "analyst@demo.com",
      role: "analyst",
      isAuthenticated: true,
    })
  ).toBe("/app/crm");

  expect(
    resolveProtectedRouteRedirect({
      pathname: "/admin",
      email: "owner@demo.com",
      role: "owner",
      isAuthenticated: true,
    })
  ).toBe("/app/crm");
});

test("unauthenticated protected routes redirect to /app with redirect param", async () => {
  expect(
    resolveProtectedRouteRedirect({
      pathname: "/app/users",
      isAuthenticated: false,
      originalUrl: "/app/users?tab=members",
    })
  ).toBe("/app?redirect=%2Fapp%2Fusers%3Ftab%3Dmembers");
});

test("RLS blocks reading rows from another company", async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  test.skip(
    !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey,
    "Supabase env vars are required for the RLS integration test."
  );

  const adminClient = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const tenantClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const signInResult = await tenantClient.auth.signInWithPassword({
    email: process.env.RLS_TEST_EMAIL || "owner@demo.com",
    password: process.env.RLS_TEST_PASSWORD || "Demo1234!",
  });

  test.skip(
    Boolean(signInResult.error || !signInResult.data.user),
    "No hay un usuario seed disponible para validar RLS en este entorno."
  );

  const companyId = randomUUID();
  const companySlug = `rls-${companyId.slice(0, 8)}`;
  const foreignUserId = randomUUID();
  const foreignEmail = `rls-${companyId.slice(0, 8)}@example.com`;

  try {
    const { error: companyError } = await adminClient.from("companies").insert({
      id: companyId,
      name: "Empresa RLS",
      slug: companySlug,
      vendor_limit: 1,
      status: "active",
      plan: "starter",
    });

    expect(companyError).toBeNull();

    const authUserResult = await adminClient.auth.admin.createUser({
      id: foreignUserId,
      email: foreignEmail,
      password: "Tmp1234!",
      email_confirm: true,
      user_metadata: {
        full_name: "Foreign User",
      },
    });

    expect(authUserResult.error).toBeNull();

    const { error: userError } = await adminClient.from("users").insert({
      id: foreignUserId,
      company_id: companyId,
      email: foreignEmail,
      name: "Foreign User",
      role: "analyst",
    });

    expect(userError).toBeNull();

    const { data, error } = await tenantClient
      .from("users")
      .select("id, company_id, email")
      .eq("company_id", companyId);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  } finally {
    await adminClient.from("users").delete().eq("id", foreignUserId);
    await adminClient.auth.admin.deleteUser(foreignUserId).catch(() => undefined);
    await adminClient.from("companies").delete().eq("id", companyId);
    await tenantClient.auth.signOut().catch(() => undefined);
  }
});
