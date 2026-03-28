import { AnalyticsPanel } from "@/components/analytics-panel";

export default function MetricasPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b bg-card/60">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Métricas del pipeline
        </p>
        <h1 className="font-heading text-4xl tracking-wide mt-1 leading-none">MÉTRICAS</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Funnel de conversión, distribución de sentimiento y revenue por producto.
        </p>
      </div>
      <div className="p-6">
        <AnalyticsPanel />
      </div>
    </div>
  );
}
