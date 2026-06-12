/**
 * POST /app/api/webhooks/stripe
 *
 * Source of truth for subscription state. Verifies the Stripe signature, then
 * mirrors the subscription into our `subscriptions` table and keeps the
 * company's vendor_limit in sync with the paid seats.
 */

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { verifyStripeSignature } from "@/lib/billing/stripe";
import { ACTIVE_STATUSES } from "@/lib/billing/config";

function isoFromUnix(sec: unknown): string | null {
  const n = typeof sec === "number" ? sec : Number(sec);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

async function applyState(
  companyId: string,
  patch: {
    status?: string;
    seats?: number;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean;
  }
) {
  const supabase = createAdminSupabaseClient();
  await supabase
    .from("subscriptions")
    .upsert(
      { company_id: companyId, provider: "stripe", currency: "usd", updated_at: new Date().toISOString(), ...patch },
      { onConflict: "company_id" }
    );

  // Keep the seat limit aligned with what's actually paid for.
  if (patch.status && ACTIVE_STATUSES.includes(patch.status) && patch.seats && patch.seats > 0) {
    await supabase.from("companies").update({ vendor_limit: patch.seats }).eq("id", companyId);
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!secret || !verifyStripeSignature(raw, sig, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const obj = event.data.object as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (event.type === "checkout.session.completed") {
      const companyId = (obj.metadata?.company_id || obj.client_reference_id) as string | undefined;
      if (companyId) {
        await applyState(companyId, {
          status: "active",
          stripe_customer_id: (obj.customer as string) ?? null,
          stripe_subscription_id: (obj.subscription as string) ?? null,
        });
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.deleted"
    ) {
      const companyId = obj.metadata?.company_id as string | undefined;
      const quantity = obj.items?.data?.[0]?.quantity as number | undefined;
      const status = event.type === "customer.subscription.deleted" ? "canceled" : (obj.status as string);
      if (companyId) {
        await applyState(companyId, {
          status,
          seats: quantity,
          stripe_customer_id: (obj.customer as string) ?? null,
          stripe_subscription_id: (obj.id as string) ?? null,
          current_period_end: isoFromUnix(obj.current_period_end),
          cancel_at_period_end: Boolean(obj.cancel_at_period_end),
        });
      }
    }
  } catch (err) {
    console.error("[webhooks/stripe] error", err);
    // Still 200 so Stripe doesn't hammer retries; we log for inspection.
  }

  return NextResponse.json({ received: true });
}
