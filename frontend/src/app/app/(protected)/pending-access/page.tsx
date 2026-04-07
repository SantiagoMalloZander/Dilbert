"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Mail } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { syncExistingUserAccessAction } from "@/modules/auth/actions";

const POLL_INTERVAL_MS = 6_000;

export default function PendingAccessPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let emailRef = "";

    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        emailRef = data.user.email;
        setEmail(data.user.email);
      }
    });

    const interval = setInterval(async () => {
      if (!emailRef) {
        return;
      }

      try {
        const result = await syncExistingUserAccessAction({ email: emailRef });
        if (result.redirectTo && result.redirectTo !== "/app/pending-access") {
          clearInterval(interval);
          router.push(result.redirectTo);
        }
      } catch {
        // Still pending — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <section className="mx-auto max-w-2xl">
      <div className="rounded-[32px] border border-white/10 bg-card/80 p-8 shadow-panel backdrop-blur">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-amber-200">
          <Clock3 className="h-3.5 w-3.5" />
          Acceso pendiente
        </div>

        <h2 className="text-3xl font-semibold tracking-tight">
          Tu cuenta ya existe, pero todavía no tiene una empresa asignada.
        </h2>

        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Te logueaste correctamente. El siguiente paso es que tu empresa te agregue en el Centro de
          Usuarios para asignarte una empresa y un rol.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-background/60 p-5">
            <p className="text-sm font-medium text-foreground">Qué tenés que hacer ahora</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Compartile este email a tu empresa y pediles que te agreguen desde el panel de Dilbert.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-background/60 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="h-4 w-4" />
              Email para compartir
            </div>
            {email ? (
              <p className="mt-2 break-all font-mono text-sm leading-6 text-muted-foreground">
                {email}
              </p>
            ) : (
              <div className="mt-2 h-4 w-48 animate-pulse rounded bg-white/10" />
            )}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-dashed border-white/15 bg-white/5 p-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Esta página verifica automáticamente cada 6 segundos. Cuando te habiliten, te vamos a
            llevar al CRM sin que tengas que hacer nada.
          </p>
        </div>
      </div>
    </section>
  );
}
