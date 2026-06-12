/**
 * Stripe client over the REST API (no SDK dependency). We only need three
 * things: create a subscription Checkout Session (Stripe Link rides along in
 * the hosted checkout), open the Billing Portal, and verify webhook signatures.
 */

import crypto from "crypto";

const STRIPE_API = "https://api.stripe.com/v1";

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_NOT_CONFIGURED");
  return key;
}

/** Flatten nested objects/arrays into Stripe's bracket form-encoding. */
function toForm(obj: Record<string, unknown>, prefix = "", params = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const field = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      toForm(value as Record<string, unknown>, field, params);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object") {
          toForm(item as Record<string, unknown>, `${field}[${i}]`, params);
        } else {
          params.append(`${field}[${i}]`, String(item));
        }
      });
    } else {
      params.append(field, String(value));
    }
  }
  return params;
}

async function stripePost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toForm(body).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`STRIPE_ERROR: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data as T;
}

export async function createSubscriptionCheckout(params: {
  companyId: string;
  email: string;
  seats: number;
  unitAmountCents: number;
  successUrl: string;
  cancelUrl: string;
  customerId?: string | null;
}): Promise<{ id: string; url: string }> {
  const body: Record<string, unknown> = {
    mode: "subscription",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.companyId,
    allow_promotion_codes: true,
    line_items: [
      {
        quantity: params.seats,
        price_data: {
          currency: "usd",
          unit_amount: params.unitAmountCents,
          recurring: { interval: "month" },
          product_data: { name: "Dilbert — CRM (por vendedor)" },
        },
      },
    ],
    subscription_data: { metadata: { company_id: params.companyId } },
    metadata: { company_id: params.companyId },
  };
  if (params.customerId) {
    body.customer = params.customerId;
  } else {
    body.customer_email = params.email;
  }
  const session = await stripePost<{ id: string; url: string }>("/checkout/sessions", body);
  return { id: session.id, url: session.url };
}

export async function createBillingPortal(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const session = await stripePost<{ url: string }>("/billing_portal/sessions", {
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return { url: session.url };
}

/** Verify the Stripe-Signature header against the raw body (constant-time). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
