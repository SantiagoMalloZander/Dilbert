// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Clock, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitGlobalToast } from "@/lib/global-toast";

type SessionUser = {
  email?: string;
  companyId?: string;
};

export default function PendingAccessPage({
  session,
}: {
  session?: { user?: SessionUser } | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState<string>(() => session?.user?.email || "");
  const [isExiting, setIsExiting] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!session?.user?.email && typeof window !== "undefined") {
      const storedEmail = localStorage.getItem("user-email");
      if (storedEmail) {
        // Legacy compatibility page kept only as archive under src/legacy.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEmail((currentEmail) => currentEmail || storedEmail);
      }
    }
  }, [session]);

  // Auto-refresh every 5 seconds to check if user got access
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const checkAccess = async () => {
      try {
        const response = await fetch("/app/api/auth/session");
        if (!response.ok) return;

        const data = await response.json();
        if (data?.user?.companyId) {
          // User now has access, redirect to CRM
          router.replace("/app/crm");
          return;
        }
      } catch {
        // Network error, silently continue polling
      }

      setPollCount((c) => c + 1);
    };

    // Initial check
    checkAccess();

    // Poll every 5 seconds
    pollInterval = setInterval(checkAccess, 5000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [router]);

  async function handleLogout() {
    setIsExiting(true);
    try {
      await signOut({ redirect: false });
      router.push("/app/");
    } catch {
      emitGlobalToast({
        tone: "error",
        text: "No pudimos cerrar la sesión.",
      });
      setIsExiting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-xl border-[3px] border-[#2A1A0A] bg-white shadow-[4px_4px_0px_#2A1A0A] p-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border-2 border-[#D4420A] bg-[#D4420A]/10 px-4 py-2">
          <Clock className="h-4 w-4 text-[#D4420A]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#D4420A]">
            Acceso pendiente
          </span>
        </div>

        <h2 className="font-heading text-4xl font-bold tracking-tight text-[#1A1A1A]">
          Tu cuenta está lista
        </h2>

        <p className="mt-4 text-base leading-relaxed text-[#1A1A1A]/70">
          Te registraste correctamente con <strong className="font-semibold text-[#1A1A1A]">{email}</strong>. Tu empresa debe agregarte en el <strong>Centro de Usuarios</strong> para asignarte una empresa y un rol.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-xl border-[3px] border-[#2A1A0A] bg-[#F5F0E8] p-6">
            <p className="font-heading text-sm font-bold uppercase tracking-widest text-[#1A1A1A]">
              Qué tenés que hacer
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#1A1A1A]/70">
              Compartí tu email y pedile a tu empresa que te agregue en el <strong>Centro de Usuarios</strong> de Dilbert.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border-[3px] border-[#2A1A0A] bg-[#F5F0E8] p-6">
            <Mail className="h-5 w-5 flex-shrink-0 text-[#D4420A]" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                Tu email
              </p>
              <p className="break-all font-mono text-sm text-[#1A1A1A]">{email}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border-2 border-dashed border-[#D4420A]/30 bg-[#D4420A]/5 p-6">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]">
            ⏳ Espera automática
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#1A1A1A]/70">
            Estamos verificando cada 5 segundos. Cuando tu empresa te agregue, te llevaremos al CRM automáticamente. {pollCount > 0 && <span className="font-mono text-xs text-[#1A1A1A]/50">(revisiones: {pollCount})</span>}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <Button
            variant="outline"
            className="border-[#2A1A0A] text-[#1A1A1A] hover:bg-[#F5F0E8]"
            onClick={handleLogout}
            disabled={isExiting}
          >
            {isExiting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2A1A0A] border-t-transparent mr-2" />
                Cerrando sesión...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </>
            )}
          </Button>
          <p className="text-xs text-[#1A1A1A]/50 font-mono">
            ¿Problema? Contacta a tu administrador.
          </p>
        </div>
      </div>
    </section>
  );
}
