"use server";

import { Resend } from "resend";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/workspace-auth";
import { revokeAuthSessionsByUserId } from "@/lib/workspace-session-security";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/modules/auth/queries";

function slugifyCompanyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function getLoginUrl() {
  return process.env.DILBERT_APP_LOGIN_URL || "https://dilvert.netlify.app";
}

function buildOwnerInviteEmail(params: {
  companyName: string;
  ownerName: string;
}) {
  const appUrl = new URL("/app", getLoginUrl()).toString();

  return `
    <div style="font-family: Inter, Arial, sans-serif; background: #0b0f14; color: #f5f7fa; padding: 32px;">
      <div style="max-width: 560px; margin: 0 auto; border: 1px solid rgba(255,255,255,.08); border-radius: 20px; background: #111827; padding: 32px;">
        <div style="font-size: 12px; letter-spacing: .24em; text-transform: uppercase; color: #f97316; margin-bottom: 12px;">Dilbert</div>
        <h1 style="font-size: 28px; margin: 0 0 12px;">Tu cuenta de Dilbert fue creada</h1>
        <p style="margin: 0 0 16px; color: #cbd5e1;">Hola ${params.ownerName}, ya podés activar <strong>${params.companyName}</strong> en Dilbert.</p>
        <p style="margin: 0 0 24px; color: #cbd5e1;">Entrá con tu email y completá tu registro desde este link:</p>
        <p style="margin: 0;">
          <a href="${appUrl}" style="display: inline-block; border-radius: 999px; background: #f97316; color: #0b0f14; font-weight: 700; padding: 12px 20px; text-decoration: none;">
            Abrir Dilbert
          </a>
        </p>
      </div>
    </div>
  `;
}

async function requireAdminAction() {
  const { user, company_id } = await requireAuth({
    requireCompany: false,
    allowSuperAdminWithoutCompany: true,
  });

  if (!canAccessAdmin(user.email)) {
    throw new Error("FORBIDDEN");
  }

  return { user, company_id };
}

async function findCompanyBySlugBase(slugBase: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("slug")
    .ilike("slug", `${slugBase}%`);

  if (error) {
    throw error;
  }

  return new Set(((data as Array<{ slug: string }> | null) || []).map((item) => item.slug));
}

async function buildUniqueSlug(companyName: string) {
  const base = slugifyCompanyName(companyName) || "empresa";
  const existing = await findCompanyBySlugBase(base);

  if (!existing.has(base)) {
    return base;
  }

  let attempt = 2;
  while (existing.has(`${base}-${attempt}`)) {
    attempt += 1;
  }

  return `${base}-${attempt}`;
}

async function assertEmailAvailableForNewCompany(email: string) {
  const supabase = createAdminSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  const [{ data: appUser, error: appUserError }, { data: authorization, error: authorizationError }] =
    await Promise.all([
      supabase.from("users").select("id, company_id").eq("email", normalizedEmail).maybeSingle(),
      supabase
        .from("authorized_emails")
        .select("id, company_id")
        .eq("email", normalizedEmail)
        .maybeSingle(),
    ]);

  if (appUserError) {
    throw appUserError;
  }

  if (authorizationError) {
    throw authorizationError;
  }

  if (appUser?.company_id || authorization?.company_id) {
    throw new Error("OWNER_EMAIL_ALREADY_EXISTS");
  }
}

async function sendOwnerInviteEmail(params: {
  companyName: string;
  ownerEmail: string;
  ownerName: string;
}) {
  const resend = getResendClient();

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.ownerEmail,
    subject: "Tu cuenta de Dilbert fue creada",
    html: buildOwnerInviteEmail(params),
  });
}

export async function createCompanyWithOwner(input: {
  companyName: string;
  ownerEmail: string;
  ownerName: string;
  vendorLimit: number;
}) {
  await requireAdminAction();

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

  getResendClient();
  await assertEmailAvailableForNewCompany(ownerEmail);

  const slug = await buildUniqueSlug(companyName);
  let companyId: string | null = null;

  try {
    const { data: createdCompany, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        slug,
        vendor_limit: vendorLimit,
        status: "active",
        settings: {
          owner_invite: {
            email: ownerEmail,
            name: ownerName,
          },
        },
      })
      .select("id")
      .single();

    if (companyError) {
      throw companyError;
    }

    companyId = createdCompany.id as string;

    const { error: authorizedEmailError } = await supabase.from("authorized_emails").insert({
      company_id: companyId,
      email: ownerEmail,
      role: "owner",
      added_by: null,
    });

    if (authorizedEmailError) {
      throw authorizedEmailError;
    }

    await sendOwnerInviteEmail({
      companyName,
      ownerEmail,
      ownerName,
    });

    return {
      companyId,
      ownerEmail,
    };
  } catch (error) {
    if (companyId) {
      try {
        await supabase.from("authorized_emails").delete().eq("company_id", companyId);
        await supabase.from("companies").delete().eq("id", companyId);
      } catch {
        // Best-effort rollback for partially created companies.
      }
    }

    throw error;
  }
}

export async function updateCompanyVendorLimit(companyId: string, vendorLimit: number) {
  await requireAdminAction();
  const supabase = createAdminSupabaseClient();
  const normalizedLimit = Math.floor(vendorLimit);

  if (!Number.isFinite(normalizedLimit) || normalizedLimit < 1) {
    throw new Error("INVALID_VENDOR_LIMIT");
  }

  const { count, error: vendorCountError } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "vendor")
    .eq("is_active", true);

  if (vendorCountError) {
    throw vendorCountError;
  }

  if ((count || 0) > normalizedLimit) {
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
  await requireAdminAction();
  const supabase = createAdminSupabaseClient();
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId);

  if (usersError) {
    throw usersError;
  }

  const [{ error: usersUpdateError }, { error: authorizationsUpdateError }, { error: companyError }] =
    await Promise.all([
      supabase
        .from("users")
        .update({
          is_active: false,
          role: "analyst",
        })
        .eq("company_id", companyId)
        .eq("role", "vendor"),
      supabase
        .from("authorized_emails")
        .update({
          role: "analyst",
        })
        .eq("company_id", companyId)
        .eq("role", "vendor"),
      supabase
        .from("companies")
        .update({
          status: "inactive",
        })
        .eq("id", companyId),
    ]);

  if (usersUpdateError) {
    throw usersUpdateError;
  }

  if (authorizationsUpdateError) {
    throw authorizationsUpdateError;
  }

  if (companyError) {
    throw companyError;
  }

  const userIds = ((users as Array<{ id: string }> | null) || []).map((user) => user.id);
  await Promise.all(userIds.map((userId) => revokeAuthSessionsByUserId(userId)));
}

export async function demoteVendor(params: {
  companyId: string;
  userId: string;
}) {
  await requireAdminAction();
  const supabase = createAdminSupabaseClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, company_id, role, email")
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

  const [{ error: userUpdateError }, { error: authorizationError }] = await Promise.all([
    supabase
      .from("users")
      .update({
        role: "analyst",
      })
      .eq("id", params.userId),
    supabase
      .from("authorized_emails")
      .update({
        role: "analyst",
      })
      .eq("company_id", params.companyId)
      .eq("email", normalizeEmail(user.email)),
  ]);

  if (userUpdateError) {
    throw userUpdateError;
  }

  if (authorizationError) {
    throw authorizationError;
  }

  await revokeAuthSessionsByUserId(params.userId);
}
