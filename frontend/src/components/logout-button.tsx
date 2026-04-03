"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { clearSessionTrackingCookies } from "@/lib/workspace-activity";
import { Button } from "@/components/ui/button";

const SIGN_OUT_CALLBACK_URL = "/app/";
const APP_ADMIN_IMPERSONATION_API = "/app/api/admin/impersonation";

export function LogoutButton() {
  async function handleLogout() {
    clearSessionTrackingCookies();
    await fetch(APP_ADMIN_IMPERSONATION_API, { method: "DELETE" }).catch(() => undefined);
    await signOut({ callbackUrl: SIGN_OUT_CALLBACK_URL });
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 w-full px-3 py-1.5 rounded-full text-xs font-medium text-[#F5F0E8]/40 hover:text-[#D4420A] hover:bg-[#D4420A]/10 transition-colors font-sans"
    >
      <LogOut className="h-3.5 w-3.5 shrink-0" />
      Cerrar sesión
    </button>
  );
}
