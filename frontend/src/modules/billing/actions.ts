"use server";

import { requireAuth } from "@/lib/workspace-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { appUrl, clampSeats, PRICE_PER_SEAT_USD_CENTS } from "@/lib/billing/config";
import { createSubscriptionCheckout, createBillingPortal } from "@/lib/billing/stripe";
import { createPreapproval } from "@/lib/billing/mercadopago";
// NOTE: precio MP temporalmente fijado en $1 (ver startMercadoPagoCheckout).
// import { getDolarTarjeta, usdToArs } from "@/lib/billing/fx";
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

/** Mercado Pago subscription (ARS). Returns the init_point to redirect the payer. */
export async function startMercadoPagoCheckout(seatsInput: number): Promise<{ url: string }> {
  const { user, companyId } = await requireBillingOwner();
  const seats = clampSeats(seatsInput);
  // TODO(temporal): precio de prueba al mínimo de Mercado Pago ($15 ARS; no
  // permite cobrar menos) para validar el flujo de pago.
  // Volver a `usdToArs(seats * (PRICE_PER_SEAT_USD_CENTS / 100), await getDolarTarjeta())` para producción.
  const amountArs = 15;

  const preapproval = await createPreapproval({
    companyId,
    email: user.email,
    seats,
    amountArs,
    backUrl: `${appUrl()}/app/suscripcion?mp=ok`,
    notificationUrl: `${appUrl()}/app/api/webhooks/mercadopago`,
  });

  if (!preapproval.init_point) {
    throw new Error("MP_NO_INIT_POINT");
  }

  await upsertSubscription(companyId, {
    provider: "mercadopago",
    seats,
    unit_amount: Math.round(amountArs / seats),
    currency: "ars",
    mp_preapproval_id: preapproval.id,
    status: "pending",
  });

  return { url: preapproval.init_point };
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
