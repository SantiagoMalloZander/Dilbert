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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-8 text-center shadow-panel">
        <div className="mx-auto mb-4 w-fit rounded-2xl bg-primary/10 p-3 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">Elegí tu plan</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {isOwner
            ? "Para empezar a usar Dilbert elegí un plan. Tenés una opción gratis para probar y una Pro con todo incluido."
            : "Tu inmobiliaria todavía no eligió un plan. Avisale al dueño de la cuenta para empezar."}
        </p>
        {isOwner ? (
          <Button className="mt-6 w-full" onClick={() => router.push("/app/suscripcion")}>
            Elegí tu plan
          </Button>
        ) : null}
      </div>
    </div>
  );
}
