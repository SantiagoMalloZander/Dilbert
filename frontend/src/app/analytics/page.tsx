import Link from "next/link";

import { BuyerAnalysisGrid } from "@/components/buyer-analysis-grid";
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

        <section className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold">Analisis por comprador</h3>
              <p className="text-sm text-muted-foreground">
                Cada comprador tiene un analisis propio sobre recompra, cadencia y comportamiento esperado.
              </p>
            </div>
            <BuyerAnalysisGrid clients={report.clients} />
          </div>

          <div className="space-y-4">
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Resumen del portfolio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Compradores analizados</span>
                  <span className="font-medium">{report.summary.total_clients}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prediccion 30 dias</span>
                  <span className="font-medium">
                    ${report.summary.predicted_30d_revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prediccion 90 dias</span>
                  <span className="font-medium">
                    ${report.summary.predicted_90d_revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Interacciones leidas</span>
                  <span className="font-medium">{report.summary.total_interactions}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle>Datos interesantes por persona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  El foco principal es la probabilidad cualitativa de recompra y el tiempo esperado hasta la proxima compra.
                </p>
                <p>
                  Tambien se muestran compras previas, producto dominante, ticket estimado y drivers comerciales.
                </p>
                <p>
                  Cada comprador abre una vista personal con historial, interacciones y detalle completo del analisis.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
