import { PackageOpen } from "lucide-react";
import Link from "next/link";

import { PurchaseSignalBadge } from "@/components/purchase-signal-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsClient } from "@/lib/types";

function formatMoney(amount: number, currency: string | null) {
  return `${currency ?? "ARS"} ${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function getRepeatLabel(client: AnalyticsClient) {
  if (client.closed_won_count >= 2) {
    return "Cliente recurrente";
  }

  if (client.closed_won_count === 1) {
    return "Ya compro antes";
  }

  return "Sin compras cerradas";
}

export function BuyerAnalysisGrid({
  clients,
  limit,
}: {
  clients: AnalyticsClient[];
  limit?: number;
}) {
  const visibleClients =
    typeof limit === "number" ? clients.slice(0, limit) : clients;

  if (visibleClients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
        <PackageOpen className="h-7 w-7 text-muted-foreground/40" />
        Todavia no hay suficientes compradores para construir un analisis individual.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {visibleClients.map((client) => (
        <Card key={client.client_key} className="border-border/70 bg-card/85">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-lg">{client.client_name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {client.client_company || "Sin empresa"}
                </p>
              </div>
              <PurchaseSignalBadge signal={client.purchase_signal} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{client.segment_label}</Badge>
              <Badge variant="secondary">{getRepeatLabel(client)}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Recompra
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {client.purchase_signal.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {client.purchase_signal.description}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Proxima compra
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {client.predicted_next_purchase_days} dias
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Recencia actual: {client.recency_days} dias
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Prediccion 30d
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatMoney(client.predicted_30d_amount, client.dominant_currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Producto: {client.dominant_product || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Compras previas
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {client.closed_won_count}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatMoney(client.closed_won_amount, client.dominant_currency)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Lecturas interesantes
              </p>
              {client.top_drivers.slice(0, 3).map((driver) => (
                <div
                  key={driver}
                  className="rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-muted-foreground"
                >
                  {driver}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Vendedor: {client.seller_names.join(", ") || "Sin asignar"}
              </span>
              <Link
                href={`/analytics/${client.primary_lead_id}`}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 font-medium hover:bg-muted"
              >
                Ver analisis
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
