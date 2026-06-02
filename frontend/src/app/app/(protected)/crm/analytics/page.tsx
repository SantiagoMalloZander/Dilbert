import { Suspense } from "react";
import { Home, CalendarClock, Flame, TrendingUp } from "lucide-react";
import {
  DashboardSectionSkeleton,
  KpiCardsSection,
  LeadsByStageSection,
} from "@/components/crm/DashboardSections";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/workspace-auth";
import { getDashboardKpis, getLeadsByStageMetrics } from "@/modules/crm/leads/queries";
import { getRealEstateAnalytics } from "@/modules/crm/analytics/queries";
import type { RealEstateAnalytics } from "@/modules/crm/analytics/types";

const OPERATION_LABELS: Record<string, string> = {
  compra: "Compra", venta: "Venta", alquiler: "Alquiler", tasacion: "Tasación",
};
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  depto: "Departamento", casa: "Casa", ph: "PH",
  terreno: "Terreno", terreno_industrial: "Terreno industrial",
  terreno_barrio: "Lote en barrio cerrado", terreno_complejo: "Lote en complejo",
  local: "Local", oficina: "Oficina", cochera: "Cochera", galpon: "Galpón", quinta: "Quinta",
};

function money(value: number | null, currency: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00`)
  );
}

async function KpiBlock({ promise }: { promise: ReturnType<typeof getDashboardKpis> }) {
  return <KpiCardsSection data={await promise} />;
}

async function StageBlock({ promise }: { promise: ReturnType<typeof getLeadsByStageMetrics> }) {
  return <LeadsByStageSection data={await promise} />;
}

async function RealEstateBlock({ promise }: { promise: Promise<RealEstateAnalytics> }) {
  const data = await promise;

  if (!data.hasRealEstateData) {
    return (
      <Card className="bg-card/90">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Inteligencia inmobiliaria</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Todavía no hay búsquedas cargadas con datos inmobiliarios. Cuando el agente procese
                conversaciones (zonas, presupuestos, tipos de propiedad), acá vas a ver pipeline por
                operación, zonas calientes, próximas visitas y leads urgentes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Búsquedas totales</p>
            <p className="mt-2 text-3xl font-semibold">{data.searchesCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data.activeSearches} activas</p>
          </CardContent>
        </Card>
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pipeline de presupuesto</p>
            <p className="mt-2 text-3xl font-semibold">{money(data.pipelineBudget, "ARS")}</p>
            <p className="mt-1 text-xs text-muted-foreground">Suma de techos de búsquedas abiertas</p>
          </CardContent>
        </Card>
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Leads urgentes</p>
            <p className="mt-2 text-3xl font-semibold">{data.hotLeads.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data.upcomingVisits.length} visitas agendadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming visits */}
      <Card className="bg-card/90">
        <CardContent className="pt-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-primary" />
            Próximas visitas
          </div>
          {data.upcomingVisits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay visitas agendadas todavía.</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingVisits.map((v) => (
                <div
                  key={v.leadId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[v.contactName, v.propertyType ? PROPERTY_TYPE_LABELS[v.propertyType] ?? v.propertyType : null, v.zone]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {v.expectedCloseDate ? (
                    <span className="text-sm text-muted-foreground">{formatDate(v.expectedCloseDate)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hot leads (urgent) */}
      {data.hotLeads.length > 0 ? (
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Flame className="h-4 w-4 text-amber-500" />
              Leads urgentes
            </div>
            <div className="space-y-2">
              {data.hotLeads.map((h) => (
                <div
                  key={h.leadId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{h.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[h.contactName, h.operation ? OPERATION_LABELS[h.operation] ?? h.operation : null, h.zone]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium">{money(h.budgetMax, h.currency)}</span>
                    <Badge className="border-amber-400/40 bg-amber-500/15 text-amber-700">
                      {h.daysOld === 0 ? "Hoy" : `${h.daysOld}d`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Breakdowns */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <div className="mb-4 text-sm font-semibold">Por operación</div>
            <div className="space-y-2">
              {data.byOperation.map((o) => (
                <div key={o.operation} className="flex items-center justify-between text-sm">
                  <span>{OPERATION_LABELS[o.operation] ?? o.operation}</span>
                  <span className="text-muted-foreground">
                    {o.count} · {money(o.totalBudget, "ARS")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <div className="mb-4 text-sm font-semibold">Zonas calientes</div>
            <div className="space-y-2">
              {data.byZone.map((z) => (
                <div key={z.zone} className="flex items-center justify-between text-sm">
                  <span>{z.zone}</span>
                  <span className="text-muted-foreground">{z.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <div className="mb-4 text-sm font-semibold">Por tipo de propiedad</div>
            <div className="space-y-2">
              {data.byPropertyType.map((t) => (
                <div key={t.propertyType} className="flex items-center justify-between text-sm">
                  <span>{PROPERTY_TYPE_LABELS[t.propertyType] ?? t.propertyType}</span>
                  <span className="text-muted-foreground">{t.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  await requireSession();

  const kpiPromise = getDashboardKpis();
  const stagePromise = getLeadsByStageMetrics();
  const realEstatePromise = getRealEstateAnalytics();

  return (
    <div className="space-y-6">
      <Card className="bg-card/90">
        <CardContent className="pt-7">
          <div className="space-y-2">
            <Badge className="border border-primary/20 bg-primary/10 text-foreground">
              <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
              Analytics
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Inteligencia comercial</h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              Conversión del pipeline, distribución por etapa y, para inmobiliarias, próximas visitas,
              leads urgentes y cartera por operación, zona y tipo de propiedad.
            </p>
          </div>
        </CardContent>
      </Card>

      <Suspense fallback={<DashboardSectionSkeleton rows={4} />}>
        <KpiBlock promise={kpiPromise} />
      </Suspense>

      <Suspense fallback={<DashboardSectionSkeleton rows={4} />}>
        <StageBlock promise={stagePromise} />
      </Suspense>

      <Suspense fallback={<DashboardSectionSkeleton rows={5} />}>
        <RealEstateBlock promise={realEstatePromise} />
      </Suspense>
    </div>
  );
}
