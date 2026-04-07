// @ts-nocheck
"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

type ResetStep = { step: string; ok: boolean; detail?: string };
type ResetResult = { ok: boolean; steps: ResetStep[] };

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleReset() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, steps: [{ step: "Conexión", ok: false, detail: "Error de red" }] });
    } finally {
      setLoading(false);
      setConfirmed(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 md:py-5 border-b bg-card/60">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Acceso interno
        </p>
        <h1 className="font-heading text-3xl md:text-4xl tracking-wide mt-1 leading-none">ADMIN</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1.5">
          Panel de control para la sesión de demo — solo visible para el equipo.
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-6 max-w-2xl">

        {/* Jurado account info */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-1">
              Cuenta del jurado
            </p>
            <h2 className="font-heading text-xl tracking-wide leading-none">CREDENCIALES</h2>
          </div>
          <div className="space-y-2 text-sm">
            {[
              { label: "Usuario", value: "Jurado@hackitba.edu" },
              { label: "Contraseña", value: "compi" },
              { label: "HubSpot", value: "Pre-conectado (pat-na1-0b73c...)" },
              { label: "Empresa", value: "hackITBA 2026" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground w-24 shrink-0">
                  {label}
                </span>
                <span className="font-mono text-xs">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reset section */}
        <div className="rounded-lg border border-[#D4420A]/20 bg-[#D4420A]/4 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-[#D4420A] mt-0.5 shrink-0" />
            <div>
              <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-[#D4420A] mb-1">
                Zona de reset
              </p>
              <h2 className="font-heading text-xl tracking-wide leading-none">RESETEAR SESIÓN</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Borra todos los leads e interacciones, y desconecta el bot de Telegram
                para que el jurado deba re-escanear el QR al iniciar.
              </p>
            </div>
          </div>

          {!confirmed ? (
            <button
              onClick={() => setConfirmed(true)}
              className="rounded-md px-4 py-2 text-sm font-medium bg-[#D4420A] hover:bg-[#B83509] text-[#F5F0E8] transition-colors"
            >
              Resetear sesión del Jurado
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-[#D4420A]">¿Estás seguro?</p>
              <button
                onClick={handleReset}
                disabled={loading}
                className="rounded-md px-4 py-2 text-sm font-medium bg-[#D4420A] hover:bg-[#B83509] text-[#F5F0E8] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                {loading ? "Reseteando..." : "Sí, resetear"}
              </button>
              <button
                onClick={() => setConfirmed(false)}
                className="rounded-md px-4 py-2 text-sm border border-border hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              {result.ok ? (
                <CheckCircle2 size={16} className="text-[#1A7A6E]" />
              ) : (
                <XCircle size={16} className="text-[#D4420A]" />
              )}
              <p className="text-sm font-medium">
                {result.ok ? "Reset completado correctamente" : "Reset completado con errores"}
              </p>
            </div>
            <div className="space-y-1.5">
              {result.steps.map((s) => (
                <div key={s.step} className="flex items-start gap-2.5 text-sm">
                  {s.ok ? (
                    <CheckCircle2 size={13} className="text-[#1A7A6E] mt-0.5 shrink-0" />
                  ) : (
                    <XCircle size={13} className="text-[#D4420A] mt-0.5 shrink-0" />
                  )}
                  <span className="text-muted-foreground">
                    {s.step}
                    {s.detail && (
                      <span className="ml-2 text-[10px] font-mono text-red-500">{s.detail}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setResult(null)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw size={11} />
              Limpiar resultado
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
