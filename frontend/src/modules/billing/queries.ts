import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ACTIVE_STATUSES } from "@/lib/billing/config";

export type SubscriptionRow = {
  company_id: string;
  provider: string | null;
  status: string;
  seats: number;
  unit_amount: number | null;
  currency: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  mp_preapproval_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type BillingState = {
  /** Whether the company can use the app (exempt or paying). */
  active: boolean;
  /** Grandfathered / comped — never asked to pay. */
  exempt: boolean;
  status: string;
  provider: string | null;
  seats: number;
  currency: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
};

/** Active vendor seats in use today — used to suggest a sensible seat count. */
export async function getActiveVendorCount(companyId: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "vendor")
    .eq("is_active", true);
  return count ?? 0;
}

export async function getSubscription(companyId: string): Promise<SubscriptionRow | null> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "company_id, provider, status, seats, unit_amount, currency, stripe_customer_id, stripe_subscription_id, mp_preapproval_id, current_period_end, cancel_at_period_end"
    )
    .eq("company_id", companyId)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

export async function getBillingState(companyId: string): Promise<BillingState> {
  const supabase = createAdminSupabaseClient();
  const [{ data: company }, sub] = await Promise.all([
    supabase.from("companies").select("billing_exempt").eq("id", companyId).maybeSingle(),
    getSubscription(companyId),
  ]);

  const exempt = Boolean(company?.billing_exempt);
  const status = sub?.status ?? "none";
  const paying = ACTIVE_STATUSES.includes(status);

  return {
    active: exempt || paying,
    exempt,
    status,
    provider: sub?.provider ?? null,
    seats: sub?.seats ?? 0,
    currency: sub?.currency ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    hasStripeCustomer: Boolean(sub?.stripe_customer_id),
  };
}
