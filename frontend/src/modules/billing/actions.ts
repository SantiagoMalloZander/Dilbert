"use server";

import { requireAuth } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { appUrl, clampSeats, mpPricePerSeatArs, PRICE_PER_SEAT_USD_CENTS } from "@/lib/billing/config";
import { createSubscriptionCheckout, createBillingPortal } from "@/lib/billing/stripe";
import {
  createPreapprovalPlan,
  getPreapproval,
  findAuthorizedPreapproval,
  type MpPreapproval,
} from "@/lib/billing/mercadopago";
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
  // Mercado Pago cobra en ARS un precio fijo por vendedor (mpPricePerSeatArs).
  const amountArs = seats * mpPricePerSeatArs();

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
 * Robust to timing: MP can still report "pending" the instant we're redirected,
 * so we retry a few times AND search the company's authorized subscription by
 * external_reference (works even if MP doesn't append preapproval_id). The
 * webhook reconciles it too; this is the fast path. Idempotent.
 */
export async function confirmMercadoPagoReturn(preapprovalId?: string): Promise<boolean> {
  const { companyId } = await requireBillingOwner();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      let authorized: MpPreapproval | null = null;

      if (preapprovalId) {
        const pre = await getPreapproval(preapprovalId);
        const sameCompany = !pre.external_reference || pre.external_reference === companyId;
        if (sameCompany && pre.status === "authorized") authorized = pre;
      }
      if (!authorized) {
        authorized = await findAuthorizedPreapproval(companyId);
      }

      if (authorized && authorized.status === "authorized") {
        await upsertSubscription(companyId, {
          provider: "mercadopago",
          currency: "ars",
          mp_preapproval_id: authorized.id,
          status: "active",
        });
        const sub = await getSubscription(companyId);
        if (sub?.seats && sub.seats > 0) {
          const supabase = createAdminSupabaseClient();
          await supabase.from("companies").update({ vendor_limit: sub.seats }).eq("id", companyId);
        }
        return true;
      }
    } catch {
      // transient — retry
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return false;
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
