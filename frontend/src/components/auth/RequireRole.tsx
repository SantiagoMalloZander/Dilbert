"use client";

import type { AppRole } from "@/lib/auth/permissions";
import { usePermissions } from "@/lib/auth/use-permissions";

export function RequireRole({
  role,
  children,
}: {
  role: AppRole;
  children: React.ReactNode;
}) {
  const permissions = usePermissions();

  if (permissions.loading) {
    return null;
  }

  return permissions.role === role ? <>{children}</> : null;
}
