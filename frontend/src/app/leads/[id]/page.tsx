"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Inbox, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { Lead, Interaction } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/source-badge";

const statusLabels: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  negotiating: "Negociando",
  closed_won: "Ganado",
  closed_lost: "Perdido",
};

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetch() {
      const [leadRes, intRes] = await Promise.all([
        supabase
          .from("leads")
          .select("*, sellers(name)")
          .eq("id", id)
          .single(),
        supabase
          .from("interactions")
          .select("*")
          .eq("lead_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (leadRes.data) setLead(leadRes.data);
      if (intRes.data) setInteractions(intRes.data);
      setLoading(false);
    }

    fetch();

    // Realtime for interactions
    const channel = supabase
      .channel(`interactions-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "interactions",
          filter: `lead_id=eq.${id}`,
        },
        (payload) => {
          setInteractions((prev) => [payload.new as Interaction, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Cargando lead...</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6">
        <p>Lead no encontrado</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Volver al dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Dashboard
        </Link>
        <h2 className="text-2xl font-bold">
          {lead.client_name || "Sin nombre"}
        </h2>
        <Badge>{statusLabels[lead.status] || lead.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Informacion del Lead
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Empresa:</span>{" "}
              {lead.client_company || "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Producto:</span>{" "}
              {lead.product_interest || "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Vendedor:</span>{" "}
              {lead.sellers?.name || "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Sentimiento:</span>{" "}
              {lead.sentiment || "-"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Valor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {lead.estimated_amount
                ? `${lead.currency || "$"} ${lead.estimated_amount.toLocaleString()}`
                : "Sin estimar"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Proximos Pasos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{lead.next_steps || "Sin definir"}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">
          Interacciones ({interactions.length})
        </h3>
        {interactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-12 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <Inbox className="h-7 w-7 text-muted-foreground/40" />
            No hay interacciones registradas
          </div>
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction) => (
              <Card key={interaction.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(interaction.created_at)}
                      </span>
                      <SourceBadge sourceType={interaction.source_type} />
                    </div>
                  </div>
                  {interaction.summary && (
                    <p className="text-sm">{interaction.summary}</p>
                  )}
                  {interaction.source_type === "fathom_meet" && interaction.extracted_data && (
                    <details className="text-xs mt-1">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver detalles de la reunión
                      </summary>
                      <div className="mt-2 p-3 bg-muted rounded-md space-y-1">
                        {(interaction.extracted_data.recording_url as string | undefined) && (
                          <div>
                            <span className="text-muted-foreground">Grabación: </span>
                            <a
                              href={interaction.extracted_data.recording_url as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Ver en Fathom
                            </a>
                          </div>
                        )}
                        {(interaction.extracted_data.duration as number | undefined) && (
                          <div>
                            <span className="text-muted-foreground">Duración: </span>
                            {Math.round((interaction.extracted_data.duration as number) / 60)} min
                          </div>
                        )}
                        {Array.isArray(interaction.extracted_data.participants) &&
                          interaction.extracted_data.participants.length > 0 && (
                            <div>
                              <span className="text-muted-foreground">Participantes: </span>
                              {(interaction.extracted_data.participants as string[]).join(", ")}
                            </div>
                          )}
                      </div>
                    </details>
                  )}
                  {interaction.extracted_data && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver datos extraidos
                      </summary>
                      <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto">
                        {JSON.stringify(interaction.extracted_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
