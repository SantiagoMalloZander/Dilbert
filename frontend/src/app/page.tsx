"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
