import { redirect } from "next/navigation";
import { requireSession } from "@/lib/workspace-auth";
import { getBillingState, getActiveVendorCount } from "@/modules/billing/queries";
import { PRICE_PER_SEAT_USD_CENTS, mpPricePerSeatArs, clampSeats } from "@/lib/billing/config";
import { SubscriptionView } from "@/components/billing/subscription-view";

export default async function SuscripcionPage() {
  const session = await requireSession();
  if (!session.user.companyId) redirect("/app/account");

  const isOwner = session.user.role === "owner" || session.user.isSuperAdmin;

  const [state, activeVendors] = await Promise.all([
    getBillingState(session.user.companyId),
    getActiveVendorCount(session.user.companyId),
  ]);

  const defaultSeats = clampSeats(Math.max(state.seats || 0, activeVendors, 1));

  return (
    <SubscriptionView
      isOwner={isOwner}
      state={state}
      defaultSeats={defaultSeats}
      activeVendors={activeVendors}
      priceUsd={PRICE_PER_SEAT_USD_CENTS / 100}
      priceArs={mpPricePerSeatArs()}
      stripeEnabled={Boolean(process.env.STRIPE_SECRET_KEY)}
      mpEnabled={Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN)}
    />
  );
}
