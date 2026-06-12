import Link from "next/link";
import { CheckCircle2, Clock3, Percent, Users } from "lucide-react";
import { LeadsBySourceChart, LeadsByStageChart } from "@/components/crm/DashboardCharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RecentActivityRecord } from "@/modules/crm/activities/queries";
import type {
  DashboardKpiData,
  LeadsBySourceMetric,
  LeadsByStageMetric,
  SellerPerformanceRecord,
  UpcomingLeadRecord,
} from "@/modules/crm/leads/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function getKpiIcon(index: number) {
  switch (index) {
    case 1:
      return CheckCircle2;
    case 2:
      return Percent;
    case 3:
      return Users;
    default:
      return Clock3;
  }
}

export function KpiCardsSection({ data }: { data: DashboardKpiData }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {data.metrics.map((metric, index) => {
        const Icon = getKpiIcon(index);

        return (
          <Card
            key={metric.label}
            className="bg-card/90"
          >
            <CardHeader>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-3xl font-semibold tracking-tight">{metric.formattedValue}</span>
              </div>
              <CardTitle className="text-lg text-foreground">{metric.label}</CardTitle>
              <CardDescription className="text-muted-foreground">{metric.description}</CardDescription>
            </CardHeader>
            {metric.benchmark ? (
              <CardContent className="pt-0 text-xs text-foreground">
                {metric.benchmark.label}: {metric.benchmark.formattedValue}
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

export function LeadsByStageSection({ data }: { data: LeadsByStageMetric[] }) {
  return (
    <Card className="bg-card/90">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-foreground">Leads por etapa</CardTitle>
          <CardDescription className="text-muted-foreground">
            Hacé click en una barra para abrir el kanban filtrado por esa etapa.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          className="border-border bg-muted text-foreground hover:bg-muted hover:text-foreground"
          render={<Link href="/app/crm/leads" />}
        >
          Ver pipeline
        </Button>
      </CardHeader>
      <CardContent>
        <LeadsByStageChart data={data} />
      </CardContent>
    </Card>
  );
}

export function LeadsBySourceSection({ data }: { data: LeadsBySourceMetric[] }) {
  return (
    <Card className="bg-card/90">
      <CardHeader>
        <CardTitle className="text-foreground">Leads por fuente</CardTitle>
        <CardDescription className="text-muted-foreground">
          Distribución del ingreso de oportunidades por canal o carga manual.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LeadsBySourceChart data={data} />
      </CardContent>
    </Card>
  );
}

export function RecentActivitySection({ data, isVendor }: { data: RecentActivityRecord[]; isVendor: boolean }) {
  return (
    <Card className="bg-card/90">
      <CardHeader>
        <CardTitle className="text-foreground">
          {isVendor ? "Tu actividad" : "Actividad reciente"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todavía no hay actividad.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.slice(0, 8).map((activity) => (
              <li key={activity.id} className="flex items-center gap-3 py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {activity.relatedLabel || activity.description}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(activity.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function WonLostMiniChart({ data }: { data: { label: string; won: number; lost: number }[] }) {
  const max = Math.max(1, ...data.map((m) => Math.max(m.won, m.lost)));
  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-foreground">Ganados vs perdidos</CardTitle>
        <CardDescription className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ganados
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#D4420A]" /> Perdidos
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2" style={{ height: 110 }}>
          {data.map((m, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-[88px] w-full items-end justify-center gap-1">
                <div
                  className="w-1/2 max-w-[14px] rounded-t bg-emerald-500"
                  style={{ height: `${(m.won / max) * 100}%` }}
                  title={`${m.won} ganados`}
                />
                <div
                  className="w-1/2 max-w-[14px] rounded-t bg-[#D4420A]"
                  style={{ height: `${(m.lost / max) * 100}%` }}
                  title={`${m.lost} perdidos`}
                />
              </div>
              <span className="text-[11px] capitalize text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function UpcomingLeadsSection({ data }: { data: UpcomingLeadRecord[] }) {
  return (
    <Card className="bg-card/90">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-foreground">Leads próximos a vencer</CardTitle>
          <CardDescription className="text-muted-foreground">
            Oportunidades con cierre esperado dentro de los próximos 7 días.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          className="border-border bg-muted text-foreground hover:bg-muted hover:text-foreground"
          render={<Link href="/app/crm/leads" />}
        >
          Abrir kanban
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            No hay leads próximos a vencer.
          </div>
        ) : (
          data.map((lead) => (
            <div
              key={lead.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background/50 px-4 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium text-foreground">{lead.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.contactName}
                  {lead.stageName ? ` · ${lead.stageName}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "border",
                    lead.daysUntilClose < 0
                      ? "border-red-400/30 bg-red-500/10 text-red-700"
                      : "border-amber-300/30 bg-amber-400/10 text-amber-700"
                  )}
                >
                  {lead.daysUntilClose < 0
                    ? "Vencido"
                    : lead.daysUntilClose === 0
                      ? "Vence hoy"
                      : `${lead.daysUntilClose} días`}
                </Badge>
                <span className="text-sm text-foreground">{formatCurrency(lead.value || 0)}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function SellerPerformanceSection({ data }: { data: SellerPerformanceRecord[] }) {
  return (
    <Card className="bg-card/90">
      <CardHeader>
        <CardTitle className="text-foreground">Rendimiento por vendedor</CardTitle>
        <CardDescription className="text-muted-foreground">
          Comparativa operativa del equipo comercial en el mes actual.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 font-medium">Vendedor</th>
              <th className="py-2 font-medium">Leads activos</th>
              <th className="py-2 font-medium">Ganados (mes)</th>
              <th className="py-2 font-medium text-right">Valor cerrado</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  Todavía no hay vendedores activos con datos.
                </td>
              </tr>
            ) : (
              data.map((seller) => (
                <tr key={seller.userId} className="border-b border-border">
                  <td className="py-3 font-medium text-foreground">{seller.name}</td>
                  <td className="py-3 text-foreground">{seller.activeLeads}</td>
                  <td className="py-3 text-foreground">{seller.wonThisMonth}</td>
                  <td className="py-3 text-right text-foreground">
                    {formatCurrency(seller.closedValueThisMonth)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function DashboardSectionSkeleton({
  className,
  rows = 1,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card/90 p-6", className)}>
      <div className="h-7 w-44 animate-pulse rounded-full bg-card/10" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded-full bg-card/10" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-card/10" />
        ))}
      </div>
    </div>
  );
}
