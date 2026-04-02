"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { clearSessionTrackingCookies } from "@/lib/activity";
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
    <Button variant="outline" size="sm" onClick={handleLogout}>
      <LogOut className="mr-2 h-4 w-4" />
      Cerrar sesión
    </Button>
  );
}
