"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Lead, Interaction } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Cargando...
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
          <p className="text-muted-foreground text-sm">
            No hay interacciones registradas
          </p>
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction) => (
              <Card key={interaction.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(interaction.created_at).toLocaleString("es-AR")}
                    </span>
                  </div>
                  {interaction.summary && (
                    <p className="text-sm">{interaction.summary}</p>
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
