"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, WifiOff } from "lucide-react";
import { onGlobalToast, type GlobalToastPayload } from "@/lib/global-toast";

type ToastState = {
  tone: "error" | "success";
  text: string;
} | null;

export function GlobalToast() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    const unsubscribe = onGlobalToast((payload: GlobalToastPayload) => {
      setToast({
        tone: payload.tone || "error",
        text: payload.text,
      });
    });

    const handleOffline = () => {
      setToast({
        tone: "error",
        text: "No hay conexión a internet. Algunas acciones pueden fallar hasta que vuelva la red.",
      });
    };

    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!toast) {
    return null;
  }

  return (
    <div
      className={`fixed right-4 top-4 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-panel backdrop-blur ${
        toast.tone === "success"
          ? "border-emerald-500/20 bg-emerald-500/12 text-emerald-100"
          : "border-destructive/30 bg-[#2a1015]/95 text-[#ffd8dc]"
      }`}
    >
      {toast.tone === "success" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : navigator.onLine ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p>{toast.text}</p>
    </div>
  );
}
