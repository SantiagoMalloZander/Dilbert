"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Lead } from "@/lib/types";
import { LeadsTable } from "@/components/leads-table";
import { MetricsCards } from "@/components/metrics-cards";

const DEMO_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchLeads() {
      const { data, error } = await supabase
        .from("leads")
        .select("*, sellers(name)")
        .eq("company_id", DEMO_COMPANY_ID)
        .order("last_interaction", { ascending: false });

      if (!error && data) setLeads(data);
      setLoading(false);
    }

    fetchLeads();

    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `company_id=eq.${DEMO_COMPANY_ID}`,
        },
        async () => {
          const { data } = await supabase
            .from("leads")
            .select("*, sellers(name)")
            .eq("company_id", DEMO_COMPANY_ID)
            .order("last_interaction", { ascending: false });
          if (data) setLeads(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Vista operativa
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">Pipeline</h2>
        <p className="text-sm text-muted-foreground">
          Leads activos en tiempo real. Se actualiza automáticamente cuando el bot procesa conversaciones.
        </p>
      </div>
      <MetricsCards leads={leads} />
      <LeadsTable leads={leads} loading={loading} />
    </div>
  );
}
