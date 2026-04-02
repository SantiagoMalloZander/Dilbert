"use client";

import { useRouter } from "next/navigation";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const APP_ADMIN_IMPERSONATION_API = "/app/api/admin/impersonation";

export function ImpersonationBanner({
  companyName,
}: {
  companyName: string;
}) {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  async function handleExit() {
    setIsExiting(true);

    try {
      await fetch(APP_ADMIN_IMPERSONATION_API, {
        method: "DELETE",
      });
    } finally {
      router.push("/admin");
      router.refresh();
      setIsExiting(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[24px] border border-[#f0c55b]/25 bg-[#31260d]/90 p-4 text-[#ffe7a2] shadow-panel sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full border border-[#f0c55b]/30 bg-[#f0c55b]/12 p-2">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Estás viendo como {companyName}. Salir</p>
          <p className="text-xs text-[#f5df9c]/75">
            Estás operando con permisos de owner sobre esa empresa.
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        className="border-[#f0c55b]/30 bg-transparent text-[#ffe7a2] hover:bg-[#f0c55b]/10 hover:text-[#fff2c7]"
        onClick={handleExit}
        disabled={isExiting}
      >
        {isExiting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
        Salir
      </Button>
    </div>
  );
}
