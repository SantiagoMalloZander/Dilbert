// @ts-nocheck
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/types";

function formatCompactAmount(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function AnalyticsSummaryCards({
  summary,
}: {
  summary: AnalyticsSummary;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Clientes analizados</CardTitle>
          <CardDescription>
            Base actual consolidada desde la CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{summary.total_clients}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {summary.total_interactions} interacciones leidas
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Prediccion a 30 dias</CardTitle>
          <CardDescription>Ingreso esperado con el pipeline actual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">
            ${formatCompactAmount(summary.predicted_30d_revenue)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Basado en recencia, frecuencia y estado comercial
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Prediccion a 90 dias</CardTitle>
          <CardDescription>Expande el mismo patron en el trimestre</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">
            ${formatCompactAmount(summary.predicted_90d_revenue)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Sin escribir datos ni alterar la CRM
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Mix de segmentos</CardTitle>
          <CardDescription>Lectura cualitativa del portfolio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(summary.segment_breakdown)
            .slice(0, 3)
            .map(([segment, count]) => (
              <div key={segment} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{segment}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
