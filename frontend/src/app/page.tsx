"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Lead } from "@/lib/types";
import { LeadsTable } from "@/components/leads-table";
import { MetricsCards } from "@/components/metrics-cards";
import { AnalyticsPanel } from "@/components/analytics-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      <section className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/80 p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Vista operativa
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Leads en tiempo real
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Seguimiento del pipeline actual. Si queres revisar consumo futuro por cliente,
            entra al modulo de analytics.
          </p>
        </div>

        <Link
          href="/analytics"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          Abrir analytics
        </Link>
      </section>
      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="leads" className="space-y-6 mt-4">
          <MetricsCards leads={leads} />
          <LeadsTable leads={leads} loading={loading} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
