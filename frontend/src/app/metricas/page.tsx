import { AnalyticsPanel } from "@/components/analytics-panel";

export default function MetricasPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Métricas del pipeline
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">Métricas</h2>
        <p className="text-sm text-muted-foreground">
          Funnel de conversión, distribución de sentimiento y revenue por producto.
        </p>
      </div>
      <AnalyticsPanel />
    </div>
  );
}
