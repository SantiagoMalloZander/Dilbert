"use client";

import { useEffect } from "react";
import { toast, Toaster } from "sonner";
import { onGlobalToast, type GlobalToastPayload } from "@/lib/global-toast";

export function GlobalToast() {
  useEffect(() => {
    const unsubscribe = onGlobalToast((payload: GlobalToastPayload) => {
      const showToast = payload.tone === "success" ? toast.success : toast.error;
      showToast(payload.text);
    });

    const handleOffline = () => {
      toast.error(
        "No hay conexión a internet. Algunas acciones pueden fallar hasta que vuelva la red."
      );
    };

    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <Toaster
      position="top-right"
      richColors
      theme="dark"
      toastOptions={{
        className: "border border-white/10 bg-[#07101b] text-[#f8fafc]",
      }}
    />
  );
}
