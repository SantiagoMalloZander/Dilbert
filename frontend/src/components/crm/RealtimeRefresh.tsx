"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const CRM_TABLES = ["leads", "contacts", "activities"] as const;
const DEBOUNCE_MS = 700;

/**
 * Live CRM updates: subscribes to Postgres changes for this company's leads,
 * contacts and activities and refreshes the current route when anything moves
 * (e.g. the WhatsApp agent creates or advances a lead). Server components
 * re-render with fresh data; client state (open dialogs, drag) is preserved.
 *
 * Mounted once in the protected layout — cost is a single websocket.
 */
export function RealtimeRefresh({ companyId }: { companyId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    let channel = supabase.channel(`crm-live-${companyId}`);
    for (const table of CRM_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `company_id=eq.${companyId}` },
        scheduleRefresh
      );
    }
    channel.subscribe();

    // Catch up after the tab was in the background (missed websocket events).
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [companyId, router]);

  return null;
}
