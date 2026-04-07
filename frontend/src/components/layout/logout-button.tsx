"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { clearSessionTrackingCookies } from "@/lib/workspace-activity";

const SIGN_OUT_CALLBACK_URL = "/app/";
const APP_ADMIN_IMPERSONATION_API = "/app/api/admin/impersonation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    clearSessionTrackingCookies();
    await fetch(APP_ADMIN_IMPERSONATION_API, { method: "DELETE" }).catch(() => undefined);
    await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
    router.push(SIGN_OUT_CALLBACK_URL);
    router.refresh();
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
