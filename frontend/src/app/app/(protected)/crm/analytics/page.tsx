import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck, CalendarClock, TrendingUp } from "lucide-react";
import {
  DashboardSectionSkeleton,
  KpiCardsSection,
  LeadsByStageSection,
} from "@/components/crm/DashboardSections";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/workspace-auth";
import { getDashboardKpis, getLeadsByStageMetrics } from "@/modules/crm/leads/queries";
import { getInsuranceAnalytics } from "@/modules/crm/analytics/queries";
import type { InsuranceAnalytics } from "@/modules/crm/analytics/types";

const RAMO_LABELS: Record<string, string> = {
  auto: "Automotor", hogar: "Hogar", vida: "Vida", salud: "Salud",
  comercial: "Comercial", art: "ART", caucion: "Caución",
  responsabilidad_civil: "Resp. Civil", otros: "Otros",
};
const STATUS_LABELS: Record<string, string> = {
  cotizacion: "Cotización", emitida: "Emitida", renovacion: "Renovación",
  siniestro: "Siniestro", baja: "Baja",
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

function RenewalBadge({ days }: { days: number }) {
  const tone =
    days < 0
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : days <= 15
      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
      : "border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground";
  const label = days < 0 ? `Vencido hace ${Math.abs(days)}d` : days === 0 ? "Hoy" : `En ${days}d`;
  return <Badge className={tone}>{label}</Badge>;
}

async function InsuranceBlock({ promise }: { promise: Promise<InsuranceAnalytics> }) {
  const data = await promise;

  if (!data.hasInsuranceData) {
    return (
      <Card className="bg-card/90">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Inteligencia de seguros</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Todavía no hay pólizas cargadas. Cuando el agente procese cotizaciones o pólizas
                (con el vertical de seguros activo), acá vas a ver renovaciones próximas y cartera por ramo.
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
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pólizas / cotizaciones</p>
            <p className="mt-2 text-3xl font-semibold">{data.policiesCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Prima total (cartera)</p>
            <p className="mt-2 text-3xl font-semibold">{money(data.totalPremium, "ARS")}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Renovaciones próximas (60d)</p>
            <p className="mt-2 text-3xl font-semibold">{data.renewals.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Renewals */}
      <Card className="bg-card/90">
        <CardContent className="pt-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-primary" />
            Renovaciones y vencimientos próximos
          </div>
          {data.renewals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin vencimientos en los próximos 60 días.</p>
          ) : (
            <div className="space-y-2">
              {data.renewals.map((r) => (
                <div
                  key={r.leadId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2A1A0A]/15 bg-[#F5F0E8] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[r.contactName, r.ramo ? RAMO_LABELS[r.ramo] ?? r.ramo : null, r.carrier]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{formatDate(r.date)}</span>
                    <span className="font-medium">{money(r.premium, r.currency)}</span>
                    <RenewalBadge days={r.daysUntil} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Book of business */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <div className="mb-4 text-sm font-semibold">Cartera por ramo</div>
            <div className="space-y-2">
              {data.byRamo.map((r) => (
                <div key={r.ramo} className="flex items-center justify-between text-sm">
                  <span>{RAMO_LABELS[r.ramo] ?? r.ramo}</span>
                  <span className="text-muted-foreground">
                    {r.count} · {money(r.totalPremium, "ARS")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/90">
          <CardContent className="pt-5">
            <div className="mb-4 text-sm font-semibold">Por aseguradora</div>
            <div className="space-y-2">
              {data.byCarrier.map((c) => (
                <div key={c.carrier} className="flex items-center justify-between text-sm">
                  <span>{c.carrier}</span>
                  <span className="text-muted-foreground">{c.count}</span>
                </div>
              ))}
            </div>
            {data.byStatus.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#2A1A0A]/10 pt-4">
                {data.byStatus.map((s) => (
                  <Badge key={s.status} className="border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground">
                    {(STATUS_LABELS[s.status] ?? s.status)}: {s.count}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const session = await requireSession();

  // Analytics is company-wide — vendors only see their own data in the CRM.
  if (session.user.role === "vendor") {
    redirect("/app/crm");
  }

  const kpiPromise = getDashboardKpis();
  const stagePromise = getLeadsByStageMetrics();
  const insurancePromise = getInsuranceAnalytics();

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
              Conversión del pipeline, distribución por etapa y, para seguros, renovaciones próximas y
              cartera por ramo y aseguradora.
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
        <InsuranceBlock promise={insurancePromise} />
      </Suspense>
    </div>
  );
}
