"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnalyticsData = {
  current: {
    total_leads: number;
    active_leads: number;
    total_revenue: number;
    active_pipeline: number;
    win_rate: number;
    avg_deal_size: number;
    avg_days_to_close: number;
  };
  funnel: Record<string, number>;
  sentiment: Record<string, number>;
  product_revenue: Record<string, number>;
  seller_stats: Record<string, { leads: number; won: number; revenue: number }>;
  predictions: {
    "30d": { estimated_new_leads: number; estimated_revenue: number; estimated_pipeline: number };
    "90d": { estimated_new_leads: number; estimated_revenue: number; estimated_pipeline: number };
  };
};

const funnelLabels: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  negotiating: "Negociando",
  closed_won: "Ganado",
  closed_lost: "Perdido",
};

const funnelColors: Record<string, string> = {
  new: "bg-blue-500",
  contacted: "bg-yellow-500",
  negotiating: "bg-orange-500",
  closed_won: "bg-green-500",
  closed_lost: "bg-red-500",
};

const sentimentColors: Record<string, string> = {
  positive: "bg-green-500",
  neutral: "bg-yellow-500",
  negative: "bg-red-500",
};

const sentimentLabels: Record<string, string> = {
  positive: "Positivo",
  neutral: "Neutral",
  negative: "Negativo",
};

export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Cargando analytics...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        Error cargando analytics
      </div>
    );
  }

  const maxFunnel = Math.max(...Object.values(data.funnel), 1);
  const maxSentiment = Math.max(...Object.values(data.sentiment), 1);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.current.win_rate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Revenue Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${data.current.total_revenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Deal Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${data.current.avg_deal_size.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Dias para Cerrar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.current.avg_days_to_close}d</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funnel de Conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.funnel).map(([stage, count]) => (
              <div key={stage} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{funnelLabels[stage] || stage}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${funnelColors[stage] || "bg-gray-500"}`}
                    style={{ width: `${(count / maxFunnel) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sentiment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribucion de Sentimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.sentiment).map(([sent, count]) => (
              <div key={sent} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{sentimentLabels[sent] || sent}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${sentimentColors[sent] || "bg-gray-500"}`}
                    style={{ width: `${(count / maxSentiment) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Revenue by Product */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue por Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(data.product_revenue)
                .sort(([, a], [, b]) => b - a)
                .map(([product, revenue]) => {
                  const maxRev = Math.max(...Object.values(data.product_revenue), 1);
                  return (
                    <div key={product} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{product}</span>
                        <span className="font-medium">${revenue.toLocaleString()}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(revenue / maxRev) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Predictions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Predicciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Proximos 30 dias</h4>
                <div>
                  <div className="text-xs text-muted-foreground">Nuevos leads</div>
                  <div className="text-xl font-bold">{data.predictions["30d"].estimated_new_leads}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Revenue estimado</div>
                  <div className="text-xl font-bold text-green-600">
                    ${data.predictions["30d"].estimated_revenue.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pipeline estimado</div>
                  <div className="text-xl font-bold">
                    ${data.predictions["30d"].estimated_pipeline.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Proximos 90 dias</h4>
                <div>
                  <div className="text-xs text-muted-foreground">Nuevos leads</div>
                  <div className="text-xl font-bold">{data.predictions["90d"].estimated_new_leads}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Revenue estimado</div>
                  <div className="text-xl font-bold text-green-600">
                    ${data.predictions["90d"].estimated_revenue.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pipeline estimado</div>
                  <div className="text-xl font-bold">
                    ${data.predictions["90d"].estimated_pipeline.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
