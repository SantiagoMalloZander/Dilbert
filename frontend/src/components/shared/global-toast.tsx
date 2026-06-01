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
      closeButton
      theme="light"
      toastOptions={{
        classNames: {
          toast:
            "border-2 border-[#2A1A0A]/20 shadow-[4px_4px_0px_rgba(42,26,10,0.15)] rounded-xl",
          title: "font-semibold",
          description: "text-[#2A1A0A]/80",
          actionButton: "bg-[#D4420A] text-white",
          cancelButton: "bg-[#F5F0E8] text-[#1A1A1A]",
          success: "!bg-emerald-50 !text-emerald-900 !border-emerald-300",
          error: "!bg-red-50 !text-red-900 !border-red-300",
        },
      }}
    />
  );
}
