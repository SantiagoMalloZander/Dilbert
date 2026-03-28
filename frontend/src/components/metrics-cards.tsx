"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lead } from "@/lib/types";

export function MetricsCards({ leads }: { leads: Lead[] }) {
  const totalLeads = leads.length;
  const negotiating = leads.filter((l) => l.status === "negotiating").length;
  const closedWon = leads.filter((l) => l.status === "closed_won").length;

  const totalPipeline = leads
    .filter((l) => l.status !== "closed_lost")
    .reduce((sum, l) => sum + (l.estimated_amount || 0), 0);

  const positiveCount = leads.filter((l) => l.sentiment === "positive").length;
  const sentimentRate =
    totalLeads > 0 ? Math.round((positiveCount / totalLeads) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalLeads}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            En Negociacion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{negotiating}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cerrados (Ganados)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">{closedWon}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pipeline Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            ${totalPipeline.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {sentimentRate}% sentimiento positivo
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
