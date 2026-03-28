import Link from "next/link";
import { notFound } from "next/navigation";

import { PurchaseSignalBadge } from "@/components/purchase-signal-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildAnalyticsReport,
  getClientAnalyticsByLeadId,
  getStatusLabel,
} from "@/lib/analytics";
import { getAnalyticsContext } from "@/lib/queries";

export const dynamic = "force-dynamic";

function formatMoney(amount: number | null, currency: string | null) {
  if (!amount) {
    return "Sin monto";
  }

  return `${currency ?? "ARS"} ${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AnalyticsClientDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const context = await getAnalyticsContext();
  const report = buildAnalyticsReport(context);
  const client = getClientAnalyticsByLeadId(report, leadId);

  if (!client) {
    notFound();
  }

  const previousPurchases = client.lead_history.filter(
    (lead) => lead.status === "closed_won"
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-background via-background to-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/80 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Link
                href="/analytics"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                ← Volver al analisis
              </Link>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    {client.client_name}
                  </h2>
                  <PurchaseSignalBadge signal={client.purchase_signal} />
                  <Badge variant="outline">{client.segment_label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {client.client_company || "Sin empresa"} ·{" "}
                  {client.seller_names.join(", ") || "Sin vendedor asignado"}
                </p>
              </div>
            </div>

            <Card className="min-w-72 border-border/70 bg-background/80">
              <CardHeader>
                <CardTitle>Indicador de compra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="text-base font-medium text-foreground">
                  {client.purchase_signal.label}
                </p>
                <p>{client.purchase_signal.description}</p>
                <p>Proxima ventana esperada: {client.predicted_next_purchase_days} dias</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Prediccion 30 dias</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {formatMoney(client.predicted_30d_amount, client.dominant_currency)}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Prediccion 90 dias</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {formatMoney(client.predicted_90d_amount, client.dominant_currency)}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Compras previas cerradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{client.closed_won_count}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Total historico estimado: {formatMoney(client.closed_won_amount, client.dominant_currency)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Cadencia reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">
                {client.average_cadence_days} dias
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Recencia actual: {client.recency_days} dias
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-6">
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Historial comercial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.lead_history.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-2xl border border-border/70 bg-background/60 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{getStatusLabel(lead.status)}</Badge>
                          {lead.sentiment ? (
                            <Badge variant="secondary">{lead.sentiment}</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Producto: {lead.product_interest || "-"} · Vendedor: {lead.seller_name || "-"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Ultima actividad: {formatDate(lead.last_interaction)}
                        </p>
                      </div>

                      <div className="text-sm">
                        <p className="font-medium">
                          {formatMoney(lead.estimated_amount, lead.currency)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">
                      {lead.next_steps || "Sin proximos pasos cargados"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Interacciones previas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.interaction_history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay interacciones registradas para este cliente.
                  </p>
                ) : (
                  client.interaction_history.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="rounded-2xl border border-border/70 bg-background/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          {interaction.summary || "Interaccion sin resumen"}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(interaction.created_at)}
                        </span>
                      </div>

                      {interaction.extracted_data ? (
                        <details className="mt-3 text-xs text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">
                            Ver datos extraidos
                          </summary>
                          <pre className="mt-2 overflow-auto rounded-xl bg-muted p-3 text-xs">
                            {JSON.stringify(interaction.extracted_data, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Lecturas principales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {client.top_drivers.map((driver) => (
                  <div
                    key={driver}
                    className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3"
                  >
                    {driver}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Compras previas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {previousPurchases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay cierres ganados previos para este cliente dentro de la CRM actual.
                  </p>
                ) : (
                  previousPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3"
                    >
                      <p className="text-sm font-medium">
                        {formatMoney(purchase.estimated_amount, purchase.currency)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {purchase.product_interest || "Producto no identificado"} · {formatDate(purchase.last_interaction)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
