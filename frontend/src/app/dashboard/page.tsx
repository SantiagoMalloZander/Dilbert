"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Lead } from "@/lib/types";
import { LeadsTable } from "@/components/leads-table";
import { MetricsCards } from "@/components/metrics-cards";
import { AddLeadDialog } from "@/components/add-lead-dialog";

const DEMO_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

type RealtimeStatus = "connecting" | "connected" | "disconnected";

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSourceTypes, setLeadSourceTypes] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");

  const fetchLeads = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("leads")
        .select("*, sellers(name)")
        .eq("company_id", DEMO_COMPANY_ID)
        .order("last_interaction", { ascending: false });

      if (fetchError) throw new Error(fetchError.message);
      const leadsData = data ?? [];
      setLeads(leadsData);

      if (leadsData.length > 0) {
        const leadIds = leadsData.map((l) => l.id);
        const { data: interactions } = await supabase
          .from("interactions")
          .select("lead_id, source_type, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        if (interactions) {
          const map = new Map<string, string>();
          for (const interaction of interactions) {
            if (!map.has(interaction.lead_id) && interaction.source_type) {
              map.set(interaction.lead_id, interaction.source_type);
            }
          }
          setLeadSourceTypes(map);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("connected");
        else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setRealtimeStatus("disconnected");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b bg-card/60 flex items-end justify-between gap-4">
        <div>
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
        <AddLeadDialog />
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        <MetricsCards leads={leads} />

        {/* Leads panel header with realtime indicator */}
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Leads activos
          </p>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                realtimeStatus === "connected"
                  ? "bg-[#1A7A6E]"
                  : realtimeStatus === "connecting"
                  ? "bg-[#F5D53F] animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              {realtimeStatus === "connected"
                ? "En vivo"
                : realtimeStatus === "connecting"
                ? "Conectando"
                : "Desconectado"}
            </span>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-dashed px-6 py-12 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={fetchLeads}
              className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Reintentar
            </button>
          </div>
        ) : (
          <LeadsTable leads={leads} loading={loading} leadSourceTypes={leadSourceTypes} />
        )}
      </div>
    </div>
  );
}
