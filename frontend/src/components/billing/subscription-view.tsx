"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CreditCard, Gift, Loader2, Minus, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { emitGlobalToast } from "@/lib/global-toast";
import {
  startStripeCheckout,
  startMercadoPagoCheckout,
  openBillingPortal,
  activateFreePlan,
} from "@/modules/billing/actions";
import { MIN_SEATS, MAX_SEATS } from "@/lib/billing/config";
import type { BillingState } from "@/modules/billing/queries";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(iso));
}

const PAYING_STATUSES = ["active", "trialing"];

export function SubscriptionView({
  isOwner,
  state,
  defaultSeats,
  activeVendors,
  priceUsd,
  priceArs,
  stripeEnabled,
  mpEnabled,
}: {
  isOwner: boolean;
  state: BillingState;
  defaultSeats: number;
  activeVendors: number;
  priceUsd: number;
  priceArs: number;
  stripeEnabled: boolean;
  mpEnabled: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [seats, setSeats] = useState(defaultSeats);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("ok")) emitGlobalToast({ tone: "success", text: "¡Listo! Tu suscripción quedó activa." });
    if (params.get("mp") === "ok") emitGlobalToast({ tone: "success", text: "Recibimos tu suscripción de Mercado Pago." });
    if (params.get("canceled")) emitGlobalToast({ tone: "error", text: "Cancelaste el pago. Podés intentarlo de nuevo cuando quieras." });
  }, [params]);

  async function go(provider: "stripe" | "mercadopago" | "portal") {
    setBusy(provider);
    try {
      const res =
        provider === "stripe"
          ? await startStripeCheckout(seats)
          : provider === "mercadopago"
            ? await startMercadoPagoCheckout(seats)
            : await openBillingPortal();
      window.location.href = res.url;
    } catch {
      emitGlobalToast({ tone: "error", text: "No pude iniciar el pago. Probá de nuevo en unos segundos." });
      setBusy(null);
    }
  }

  async function goFree() {
    setBusy("free");
    try {
      await activateFreePlan();
      emitGlobalToast({ tone: "success", text: "¡Listo! Estás en el plan Gratis." });
      router.refresh();
    } catch {
      emitGlobalToast({ tone: "error", text: "No pude activar el plan gratis. Probá de nuevo." });
    } finally {
      setBusy(null);
    }
  }

  const isPaying = PAYING_STATUSES.includes(state.status);
  const isFree = state.status === "free";

  // ── Exempt (grandfathered / cortesía) ──────────────────────────────────────
  if (state.exempt && !isPaying && !isFree) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Tu cuenta está activa</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Tenés acceso completo a Dilbert sin cargo. No necesitás hacer nada.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Active subscription ─────────────────────────────────────────────────────
  if (isPaying) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Suscripción activa</h1>
          <p className="text-sm text-muted-foreground">
            {state.seats} {state.seats === 1 ? "vendedor" : "vendedores"} ·{" "}
            {state.provider === "mercadopago" ? "Mercado Pago" : "Tarjeta"}
          </p>
        </div>

        <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-background/60 p-4 text-sm">
          {state.currentPeriodEnd ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {state.cancelAtPeriodEnd ? "Acceso hasta" : "Próximo cobro"}
              </span>
              <span className="font-medium">{formatDate(state.currentPeriodEnd)}</span>
            </div>
          ) : null}
          {state.cancelAtPeriodEnd ? (
            <p className="text-xs text-amber-600">Programaste la cancelación: seguís con acceso hasta esa fecha.</p>
          ) : null}
        </div>

        {isOwner ? (
          <div className="mt-5">
            {state.provider === "mercadopago" ? (
              <p className="text-center text-xs text-muted-foreground">
                Gestioná o cancelá tu suscripción desde tu cuenta de Mercado Pago.
              </p>
            ) : (
              <Button className="w-full" variant="outline" onClick={() => go("portal")} disabled={busy !== null}>
                {busy === "portal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Administrar suscripción
              </Button>
            )}
          </div>
        ) : null}
      </Shell>
    );
  }

  // ── None (elegir plan) o Free (upsell a Pro) ────────────────────────────────
  const totalUsd = seats * priceUsd;
  const totalArs = seats * priceArs;

  return (
    <Shell>
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{isFree ? "Pasá a Pro" : "Elegí tu plan"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isFree
            ? "Estás en el plan Gratis (1 lead por día). Pasá a Pro para leads ilimitados y todo a medida."
            : "Empezá gratis o activá Pro con todo incluido."}
        </p>
      </div>

      {/* Free option — solo si todavía no está en Free */}
      {!isFree && isOwner ? (
        <>
          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/60 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
                <Gift className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Gratis</p>
                <p className="text-xs text-muted-foreground">1 lead por día · para probar</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={goFree} disabled={busy !== null}>
              {busy === "free" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Empezar gratis
            </Button>
          </div>
          <div className="my-5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            o pasá a Pro
          </div>
        </>
      ) : null}

      <div className="mt-2 text-center">
        <div className="flex items-end justify-center gap-1">
          <span className="text-5xl font-semibold tracking-tight">${priceUsd}</span>
          <span className="mb-1 text-sm text-muted-foreground">/ vendedor / mes</span>
        </div>
      </div>

      {/* Seat stepper */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSeats((s) => Math.max(MIN_SEATS, s - 1))}
          disabled={seats <= MIN_SEATS || !isOwner}
          aria-label="Menos vendedores"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="min-w-[7rem] text-center">
          <div className="text-3xl font-semibold">{seats}</div>
          <div className="text-xs text-muted-foreground">{seats === 1 ? "vendedor" : "vendedores"}</div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSeats((s) => Math.min(MAX_SEATS, s + 1))}
          disabled={seats >= MAX_SEATS || !isOwner}
          aria-label="Más vendedores"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {activeVendors > seats ? (
        <p className="mt-3 text-center text-xs text-amber-600">
          Tenés {activeVendors} vendedores activos. Te conviene cubrir al menos esa cantidad.
        </p>
      ) : null}

      <div className="mt-6 rounded-2xl border border-white/10 bg-background/60 p-4 text-center text-sm">
        <span className="text-muted-foreground">Total mensual</span>
        <div className="mt-1 text-xl font-semibold">
          USD ${totalUsd.toLocaleString("es-AR")}
        </div>
      </div>

      {isOwner ? (
        <div className="mt-6 space-y-3">
          {stripeEnabled ? (
            <Button className="w-full" onClick={() => go("stripe")} disabled={busy !== null}>
              {busy === "stripe" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pagar con tarjeta
            </Button>
          ) : null}

          {mpEnabled ? (
            <Button
              className="w-full bg-[#009ee3] text-white hover:bg-[#008fcc]"
              onClick={() => go("mercadopago")}
              disabled={busy !== null}
            >
              {busy === "mercadopago" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Pagar con Mercado Pago · ${totalArs.toLocaleString("es-AR")} ARS
            </Button>
          ) : null}

          {!stripeEnabled && !mpEnabled ? (
            <p className="text-center text-xs text-muted-foreground">
              Los pagos todavía no están configurados. Probá de nuevo en unos minutos.
            </p>
          ) : null}

          <p className="text-center text-[11px] text-muted-foreground">
            Pago seguro · Cancelás cuando quieras · Sin permanencia
          </p>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Tu inmobiliaria todavía no activó la suscripción. Avisale al dueño de la cuenta para empezar.
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-6">
      <Card className="bg-card/90">
        <CardContent className="p-6 sm:p-8">{children}</CardContent>
      </Card>
    </div>
  );
}
