import { BuyerAnalysisGrid } from "@/components/buyer-analysis-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAnalyticsReport } from "@/lib/analytics";
import { getAnalyticsContext } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const context = await getAnalyticsContext();
  const report = buildAnalyticsReport(context);

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b bg-card/60">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Dilbert Analytics
        </p>
        <h1 className="font-heading text-4xl tracking-wide mt-1 leading-none">
          INTELIGENCIA IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Patrones de consumo por cliente — recompra, cadencia y predicciones de revenue.
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          <div className="space-y-4">
            <div>
              <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Compradores
              </p>
              <h2 className="font-heading text-2xl tracking-wide mt-0.5">
                ANÁLISIS POR COMPRADOR
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Recompra, cadencia y comportamiento esperado por cliente.
              </p>
            </div>
            <BuyerAnalysisGrid clients={report.clients} />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Resumen
                </p>
                <CardTitle className="font-heading text-xl tracking-wide leading-none mt-0.5">
                  PORTFOLIO
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Compradores analizados", value: report.summary.total_clients },
                  { label: "Predicción 30 días", value: `$${report.summary.predicted_30d_revenue.toLocaleString()}` },
                  { label: "Predicción 90 días", value: `$${report.summary.predicted_90d_revenue.toLocaleString()}` },
                  { label: "Interacciones leídas", value: report.summary.total_interactions },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-muted-foreground text-xs font-mono uppercase tracking-wide">{label}</span>
                    <span className="font-heading text-lg tracking-wide leading-none">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Sobre el modelo
                </p>
                <CardTitle className="font-heading text-xl tracking-wide leading-none mt-0.5">
                  CÓMO FUNCIONA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Probabilidad de recompra basada en frecuencia, sentimiento y recencia de interacciones.</p>
                <p>Ticket estimado, producto dominante y drivers comerciales por comprador.</p>
                <p>Cada comprador tiene vista individual con historial completo.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
