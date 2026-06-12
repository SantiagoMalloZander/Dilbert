"use server";

import { requireAuth } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { appUrl, clampSeats, PRICE_PER_SEAT_USD_CENTS } from "@/lib/billing/config";
import { createSubscriptionCheckout, createBillingPortal } from "@/lib/billing/stripe";
import { createPreapprovalPlan, getPreapproval } from "@/lib/billing/mercadopago";
import { getDolarTarjeta, usdToArs } from "@/lib/billing/fx";
import { getSubscription } from "@/modules/billing/queries";

async function requireBillingOwner() {
  const { user, company_id } = await requireAuth({ requireCompany: true });
  if (!company_id) throw new Error("COMPANY_REQUIRED");
  if (user.role !== "owner" && !user.isSuperAdmin) throw new Error("FORBIDDEN");
  return { user, companyId: company_id };
}

async function upsertSubscription(companyId: string, patch: Record<string, unknown>) {
  const supabase = createAdminSupabaseClient();
  await supabase
    .from("subscriptions")
    .upsert(
      { company_id: companyId, updated_at: new Date().toISOString(), ...patch },
      { onConflict: "company_id" }
    );
}

/** Activate the free tier (1 lead/day, no agent, no customization). No payment. */
export async function activateFreePlan(): Promise<void> {
  const { companyId } = await requireBillingOwner();
  await upsertSubscription(companyId, {
    provider: null,
    status: "free",
    seats: 1,
    unit_amount: 0,
    currency: null,
  });
}

/** Stripe Checkout (USD, per-seat subscription). Returns the hosted-checkout URL. */
export async function startStripeCheckout(seatsInput: number): Promise<{ url: string }> {
  const { user, companyId } = await requireBillingOwner();
  const seats = clampSeats(seatsInput);
  const existing = await getSubscription(companyId);

  const session = await createSubscriptionCheckout({
    companyId,
    email: user.email,
    seats,
    unitAmountCents: PRICE_PER_SEAT_USD_CENTS,
    customerId: existing?.stripe_customer_id ?? null,
    successUrl: `${appUrl()}/app/suscripcion?ok=1`,
    cancelUrl: `${appUrl()}/app/suscripcion?canceled=1`,
  });

  await upsertSubscription(companyId, {
    provider: "stripe",
    seats,
    unit_amount: PRICE_PER_SEAT_USD_CENTS,
    currency: "usd",
    // real "active" is set by the webhook once payment succeeds
    status: existing?.status === "active" ? "active" : "incomplete",
  });

  return { url: session.url };
}

/**
 * Mercado Pago subscription (ARS) via a subscription PLAN. We don't bind any
 * payer_email, so ANY Mercado Pago account can pay (the owner, the accountant,
 * whoever) by logging into their own MP — no "tu email no coincide". Returns
 * the init_point to redirect to.
 */
export async function startMercadoPagoCheckout(seatsInput: number): Promise<{ url: string }> {
  const { companyId } = await requireBillingOwner();
  const seats = clampSeats(seatsInput);
  // El precio está en USD; Mercado Pago cobra en ARS al dólar tarjeta del día.
  const rate = await getDolarTarjeta();
  const amountArs = usdToArs(seats * (PRICE_PER_SEAT_USD_CENTS / 100), rate);

  const plan = await createPreapprovalPlan({
    companyId,
    seats,
    amountArs,
    backUrl: `${appUrl()}/app/suscripcion?mp=ok`,
  });

  if (!plan.init_point) {
    throw new Error("MP_NO_INIT_POINT");
  }

  await upsertSubscription(companyId, {
    provider: "mercadopago",
    seats,
    unit_amount: Math.round(amountArs / seats),
    currency: "ars",
    status: "pending",
  });

  return { url: plan.init_point };
}

/**
 * Confirms a Mercado Pago subscription when the payer returns to /app/suscripcion.
 * MP appends `preapproval_id` to the back_url; we fetch it, check it's authorized
 * and (matching this company) flip the subscription to active. Idempotent.
 */
export async function confirmMercadoPagoReturn(preapprovalId: string): Promise<boolean> {
  const { companyId } = await requireBillingOwner();
  if (!preapprovalId) return false;

  let pre;
  try {
    pre = await getPreapproval(preapprovalId);
  } catch {
    return false;
  }

  // Guard: if MP carried our company reference, it must match the caller's.
  if (pre.external_reference && pre.external_reference !== companyId) return false;
  if (pre.status !== "authorized") return false;

  await upsertSubscription(companyId, {
    provider: "mercadopago",
    currency: "ars",
    mp_preapproval_id: pre.id,
    status: "active",
  });

  const sub = await getSubscription(companyId);
  if (sub?.seats && sub.seats > 0) {
    const supabase = createAdminSupabaseClient();
    await supabase.from("companies").update({ vendor_limit: sub.seats }).eq("id", companyId);
  }
  return true;
}

/** Open the Stripe Billing Portal so the owner can update/cancel their plan. */
export async function openBillingPortal(): Promise<{ url: string }> {
  const { companyId } = await requireBillingOwner();
  const existing = await getSubscription(companyId);
  if (!existing?.stripe_customer_id) {
    throw new Error("NO_STRIPE_CUSTOMER");
  }
  const portal = await createBillingPortal({
    customerId: existing.stripe_customer_id,
    returnUrl: `${appUrl()}/app/suscripcion`,
  });
  return { url: portal.url };
}
