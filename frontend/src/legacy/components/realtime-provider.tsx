// @ts-nocheck
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const DEMO_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

export function RealtimeProvider() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel("global-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `company_id=eq.${DEMO_COMPANY_ID}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "interactions",
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
