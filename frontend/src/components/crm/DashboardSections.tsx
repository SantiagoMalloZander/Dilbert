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
            className="border-[#2A1A0A]/15 bg-background text-white shadow-[0_22px_60px_rgba(2,6,23,0.22)]"
          >
            <CardHeader>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4420A]/12 text-[#D4420A]">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-3xl font-semibold tracking-tight">{metric.formattedValue}</span>
              </div>
              <CardTitle className="text-lg text-white">{metric.label}</CardTitle>
              <CardDescription className="text-muted-foreground">{metric.description}</CardDescription>
            </CardHeader>
            {metric.benchmark ? (
              <CardContent className="pt-0 text-xs text-[#9fe9d5]">
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
    <Card className="border-[#2A1A0A]/15 bg-background text-white shadow-[0_22px_60px_rgba(2,6,23,0.22)]">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-white">Leads por etapa</CardTitle>
          <CardDescription className="text-muted-foreground">
            Hacé click en una barra para abrir el kanban filtrado por esa etapa.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          className="border-[#2A1A0A]/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
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
    <Card className="border-[#2A1A0A]/15 bg-background text-white shadow-[0_22px_60px_rgba(2,6,23,0.22)]">
      <CardHeader>
        <CardTitle className="text-white">Leads por fuente</CardTitle>
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
    <Card className="border-[#2A1A0A]/15 bg-background text-white shadow-[0_22px_60px_rgba(2,6,23,0.22)]">
      <CardHeader>
        <CardTitle className="text-white">
          {isVendor ? "Tu actividad reciente" : "Actividad reciente"}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Últimos 10 eventos {isVendor ? "propios" : "de la empresa"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#2A1A0A]/10 text-left text-muted-foreground">
              <th className="py-2 font-medium">Tipo</th>
              <th className="py-2 font-medium">Descripción</th>
              <th className="py-2 font-medium">Lead/Contacto</th>
              <th className="py-2 font-medium">Usuario</th>
              <th className="py-2 font-medium text-right">Hace cuánto</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Todavía no hay actividad registrada.
                </td>
              </tr>
            ) : (
              data.map((activity) => (
                <tr key={activity.id} className="border-b border-[#2A1A0A]/10">
                  <td className="py-3">
                    <Badge className="border border-[#2A1A0A]/15 bg-white/5 text-[#d8e4f2]">
                      {activity.type}
                    </Badge>
                  </td>
                  <td className="py-3 text-[#d8e4f2]">{activity.description}</td>
                  <td className="py-3 text-muted-foreground">{activity.relatedLabel}</td>
                  <td className="py-3 text-muted-foreground">{activity.userName}</td>
                  <td className="py-3 text-right text-muted-foreground">
                    {formatRelativeTime(activity.createdAt)}
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

export function UpcomingLeadsSection({ data }: { data: UpcomingLeadRecord[] }) {
  return (
    <Card className="border-[#2A1A0A]/15 bg-background text-white shadow-[0_22px_60px_rgba(2,6,23,0.22)]">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-white">Leads próximos a vencer</CardTitle>
          <CardDescription className="text-muted-foreground">
            Oportunidades con cierre esperado dentro de los próximos 7 días.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          className="border-[#2A1A0A]/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          render={<Link href="/app/crm/leads" />}
        >
          Abrir kanban
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2A1A0A]/15 px-4 py-8 text-sm text-muted-foreground">
            No hay leads próximos a vencer.
          </div>
        ) : (
          data.map((lead) => (
            <div
              key={lead.id}
              className="flex flex-col gap-3 rounded-2xl border border-[#2A1A0A]/10 bg-white/5 px-4 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium text-white">{lead.title}</p>
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
                      ? "border-red-400/30 bg-red-500/10 text-red-100"
                      : "border-amber-300/30 bg-amber-400/10 text-amber-100"
                  )}
                >
                  {lead.daysUntilClose < 0
                    ? "Vencido"
                    : lead.daysUntilClose === 0
                      ? "Vence hoy"
                      : `${lead.daysUntilClose} días`}
                </Badge>
                <span className="text-sm text-[#d8e4f2]">{formatCurrency(lead.value || 0)}</span>
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
    <Card className="border-[#2A1A0A]/15 bg-background text-white shadow-[0_22px_60px_rgba(2,6,23,0.22)]">
      <CardHeader>
        <CardTitle className="text-white">Rendimiento por vendedor</CardTitle>
        <CardDescription className="text-muted-foreground">
          Comparativa operativa del equipo comercial en el mes actual.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[#2A1A0A]/10 text-left text-muted-foreground">
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
                <tr key={seller.userId} className="border-b border-[#2A1A0A]/10">
                  <td className="py-3 font-medium text-white">{seller.name}</td>
                  <td className="py-3 text-[#d8e4f2]">{seller.activeLeads}</td>
                  <td className="py-3 text-[#d8e4f2]">{seller.wonThisMonth}</td>
                  <td className="py-3 text-right text-[#d8e4f2]">
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
    <div className={cn("rounded-[28px] border border-[#2A1A0A]/15 bg-background p-6", className)}>
      <div className="h-7 w-44 animate-pulse rounded-full bg-white/8" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded-full bg-white/8" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/8" />
        ))}
      </div>
    </div>
  );
}
