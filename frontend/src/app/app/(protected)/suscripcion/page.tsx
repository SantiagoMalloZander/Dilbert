import { redirect } from "next/navigation";
import { requireSession } from "@/lib/workspace-auth";
import { getBillingState, getActiveVendorCount } from "@/modules/billing/queries";
import { confirmMercadoPagoReturn } from "@/modules/billing/actions";
import { PRICE_PER_SEAT_USD_CENTS, clampSeats, mpPricePerSeatArs } from "@/lib/billing/config";
import { getDolarTarjeta } from "@/lib/billing/fx";
import { SubscriptionView } from "@/components/billing/subscription-view";

export default async function SuscripcionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  if (!session.user.companyId) redirect("/app/account");

  // Volviendo de Mercado Pago (?mp=ok y/o ?preapproval_id=…) → confirmamos el alta.
  const params = (await searchParams) ?? {};
  const preapprovalId = typeof params.preapproval_id === "string" ? params.preapproval_id : undefined;
  const returningFromMp = params.mp === "ok" || Boolean(preapprovalId);
  if (returningFromMp) {
    try {
      await confirmMercadoPagoReturn(preapprovalId);
    } catch {
      // best-effort; el webhook lo reconcilia igual
    }
  }

  const isOwner = session.user.role === "owner" || session.user.isSuperAdmin;
  const priceUsd = PRICE_PER_SEAT_USD_CENTS / 100;

  const [state, activeVendors, rate] = await Promise.all([
    getBillingState(session.user.companyId),
    getActiveVendorCount(session.user.companyId),
    getDolarTarjeta(),
  ]);

  const defaultSeats = clampSeats(Math.max(state.seats || 0, activeVendors, 1));

  return (
    <SubscriptionView
      isOwner={isOwner}
      state={state}
      defaultSeats={defaultSeats}
      activeVendors={activeVendors}
      priceUsd={priceUsd}
      priceArs={mpPricePerSeatArs()}
      dolarTarjeta={rate}
      stripeEnabled={Boolean(process.env.STRIPE_SECRET_KEY)}
      mpEnabled={Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN)}
    />
  );
}
