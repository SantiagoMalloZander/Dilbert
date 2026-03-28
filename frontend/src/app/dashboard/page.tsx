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
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b bg-card/60">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Vista operativa
        </p>
        <h1 className="font-heading text-4xl tracking-wide mt-1 leading-none">
          PIPELINE
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Leads en tiempo real. Se actualiza automáticamente cuando el bot procesa conversaciones.
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        <MetricsCards leads={leads} />
        <LeadsTable leads={leads} loading={loading} />
      </div>
    </div>
  );
}
