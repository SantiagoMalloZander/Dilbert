// @ts-nocheck
export default function AnalyticsLoading() {
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

      <div className="p-6 animate-pulse">
        {/* Summary cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
              <div className="h-3 w-2/3 rounded bg-muted" />
              <div className="h-2 w-1/2 rounded bg-muted" />
              <div className="h-7 w-1/3 rounded bg-muted" />
              <div className="h-2 w-3/4 rounded bg-muted" />
            </div>
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          {/* Buyer cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-10 rounded bg-muted" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Side cards */}
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="h-4 w-1/3 rounded bg-muted" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 w-2/5 rounded bg-muted" />
                  <div className="h-3 w-1/5 rounded bg-muted" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-4/5 rounded bg-muted" />
              <div className="h-3 w-3/5 rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
