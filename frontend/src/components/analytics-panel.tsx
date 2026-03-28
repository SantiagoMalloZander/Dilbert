"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BuyerAnalysisGrid } from "@/components/buyer-analysis-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsReport } from "@/lib/types";

type AnalyticsApiResponse =
  | AnalyticsReport
  | {
      error: string;
    };

function hasError(response: AnalyticsApiResponse): response is { error: string } {
  return "error" in response;
}

export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then(async (response) => {
        const payload = (await response.json()) as AnalyticsApiResponse;

        if (!response.ok || hasError(payload)) {
          throw new Error(
            hasError(payload) ? payload.error : "Error cargando analytics"
          );
        }

        setData(payload);
        setError(null);
      })
      .catch((requestError: unknown) => {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Error cargando analytics";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Cargando analytics por comprador...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        {error || "No se pudo cargar el analisis"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold">Analisis por comprador</h3>
              <p className="text-sm text-muted-foreground">
                Cada comprador tiene su propia lectura de recompra, historial y proxima ventana esperada.
              </p>
            </div>

            <Link
              href="/analytics"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Abrir modulo completo
            </Link>
          </div>

          <BuyerAnalysisGrid clients={data.clients} limit={6} />
        </div>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Panorama rapido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Compradores analizados</span>
                <span className="font-medium">{data.summary.total_clients}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Prediccion 30 dias</span>
                <span className="font-medium">
                  ${data.summary.predicted_30d_revenue.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Prediccion 90 dias</span>
                <span className="font-medium">
                  ${data.summary.predicted_90d_revenue.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Que mira el analisis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                La senal cualitativa resume cuan probable es que el cliente vuelva a comprar.
              </p>
              <p>
                Para cada comprador se considera recencia, frecuencia, producto dominante,
                compras previas y estado comercial.
              </p>
              <p>
                Si queres profundizar, cada tarjeta abre el analisis completo de esa persona.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
