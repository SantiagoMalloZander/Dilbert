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
      router.push("/app/admin");
      router.refresh();
      setIsExiting(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border-[3px] border-border bg-foreground p-4 text-primary-foreground shadow-[4px_4px_0px_#2A1A0A] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full border border-[#D4420A]/40 bg-[#D4420A]/15 p-2 shrink-0">
          <ShieldAlert className="h-4 w-4 text-[#D4420A]" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-primary-foreground">Estás viendo como <span className="text-[#D4420A]">{companyName}</span></p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-primary-foreground">
            Operando con permisos de owner sobre esa empresa.
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-muted/10 hover:text-primary-foreground shrink-0"
        onClick={handleExit}
        disabled={isExiting}
      >
        {isExiting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
        Salir
      </Button>
    </div>
  );
}
