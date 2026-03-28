"use client";

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

  const stats = [
    {
      label: "Total Leads",
      value: String(totalLeads),
      sub: "en pipeline",
      color: "text-foreground",
    },
    {
      label: "Negociando",
      value: String(negotiating),
      sub: "activos ahora",
      color: "text-[#D4420A]",
    },
    {
      label: "Cerrados / Ganados",
      value: String(closedWon),
      sub: "deals cerrados",
      color: "text-[#1A7A6E]",
    },
    {
      label: "Pipeline Total",
      value: `$${totalPipeline.toLocaleString()}`,
      sub: `${sentimentRate}% sentimiento positivo`,
      color: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card border rounded-lg p-4 flex flex-col gap-2.5"
        >
          <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {stat.label}
          </p>
          <div
            className={`font-heading text-5xl leading-none tracking-wide ${stat.color}`}
          >
            {stat.value}
          </div>
          <p className="text-xs text-muted-foreground">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}
