"use client";

import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pages the owner must still reach while unsubscribed.
const ALLOWED = ["/app/suscripcion", "/app/account", "/app/admin"];

/**
 * Full-screen paywall shown over the app when the company has no active
 * subscription (and isn't exempt). It only covers the user's own company data,
 * so there's no cross-tenant exposure — it just nudges the owner to subscribe.
 */
export function BillingPaywall({ active, isOwner }: { active: boolean; isOwner: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  if (active) return null;
  if (ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-6 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-9 text-center shadow-panel animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto mb-5 w-fit rounded-2xl bg-primary/10 p-3.5 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight">Elegí tu plan</h2>
        <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {isOwner
            ? "Para empezar a usar Dilbert elegí un plan. Tenés una opción gratis para probar y una Pro con todo incluido."
            : "Tu inmobiliaria todavía no eligió un plan. Avisale al dueño de la cuenta para empezar."}
        </p>
        {isOwner ? (
          <Button
            className="mt-7 h-11 w-full rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.985]"
            onClick={() => router.push("/app/suscripcion")}
          >
            Elegí tu plan
          </Button>
        ) : null}
      </div>
    </div>
  );
}
