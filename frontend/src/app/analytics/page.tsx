import Link from "next/link";

import { AnalyticsSummaryCards } from "@/components/analytics-summary-cards";
import { ClientIntelligenceTable } from "@/components/client-intelligence-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAnalyticsReport } from "@/lib/analytics";
import { getAnalyticsContext } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const context = await getAnalyticsContext();
  const report = buildAnalyticsReport(context);

  return (
    <div className="min-h-full bg-gradient-to-b from-background via-background to-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <section className="rounded-3xl border border-border/70 bg-card/80 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Dilbot Analytics
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                Patron de consumo por cliente
              </h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Lectura server-side de la CRM para estimar consumo futuro,
                detectar clientes con traccion y abrir un detalle individual por persona.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Volver al CRM
            </Link>
          </div>
        </section>

        <AnalyticsSummaryCards summary={report.summary} />

        <section className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold">Clientes priorizados</h3>
              <p className="text-sm text-muted-foreground">
                El indicador de compra ahora se muestra en lenguaje cualitativo.
              </p>
            </div>
            <ClientIntelligenceTable clients={report.clients} />
          </div>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Productos mas recurrentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.summary.top_products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todavia no hay datos suficientes para inferir afinidad por producto.
                  </p>
                ) : (
                  report.summary.top_products.map((item) => (
                    <div key={item.product} className="flex items-center justify-between text-sm">
                      <span>{item.product}</span>
                      <span className="font-medium text-muted-foreground">
                        {item.clients} clientes
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Como leer este tablero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  El calculo combina recencia, frecuencia de interaccion,
                  sentimiento, etapa comercial y montos estimados.
                </p>
                <p>
                  La senal cualitativa reemplaza el porcentaje crudo para que el manager
                  entienda prioridad sin leer un score tecnico.
                </p>
                <p>
                  Cada cliente abre una vista personal con historial comercial e interacciones previas.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
