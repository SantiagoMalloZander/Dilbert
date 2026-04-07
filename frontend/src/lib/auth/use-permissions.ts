"use client";

import { useEffect, useState } from "react";
import type { AppRole } from "@/lib/auth/permissions";
import { buildPermissionSnapshot } from "@/lib/auth/permissions";

type SessionPermissionPayload = {
  user: {
    id: string;
    email: string;
    role: AppRole;
    companyId: string;
  } | null;
};

type UsePermissionsState = ReturnType<typeof buildPermissionSnapshot> & {
  role: AppRole | null;
  email: string | null;
  companyId: string | null;
  userId: string | null;
  loading: boolean;
};

const INITIAL_STATE: UsePermissionsState = {
  ...buildPermissionSnapshot({ role: null, email: null }),
  role: null,
  email: null,
  companyId: null,
  userId: null,
  loading: true,
};

export function usePermissions() {
  const [state, setState] = useState<UsePermissionsState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      try {
        const response = await fetch("/app/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setState({
              ...INITIAL_STATE,
              loading: false,
            });
          }
          return;
        }

        const data = (await response.json()) as SessionPermissionPayload;
        if (cancelled) {
          return;
        }

        setState({
          ...buildPermissionSnapshot({
            role: data.user?.role || null,
            email: data.user?.email || null,
          }),
          role: data.user?.role || null,
          email: data.user?.email || null,
          companyId: data.user?.companyId || null,
          userId: data.user?.id || null,
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState({
            ...INITIAL_STATE,
            loading: false,
          });
        }
      }
    }

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
