import Link from "next/link";
import { Suspense } from "react";
import { BarChart3, BriefcaseBusiness, Filter, Sparkles } from "lucide-react";
import {
  DashboardSectionSkeleton,
  KpiCardsSection,
  LeadsBySourceSection,
  LeadsByStageSection,
  RecentActivitySection,
  SellerPerformanceSection,
  UpcomingLeadsSection,
} from "@/components/crm/DashboardSections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/workspace-auth";
import { getRoleLabel } from "@/lib/workspace-roles";
import { getRecentActivities } from "@/modules/crm/activities/queries";
import {
  getDashboardKpis,
  getLeadsBySourceMetrics,
  getLeadsByStageMetrics,
  getSellerPerformance,
  getUpcomingClosingLeads,
} from "@/modules/crm/leads/queries";

async function KpiSection({
  promise,
}: {
  promise: ReturnType<typeof getDashboardKpis>;
}) {
  const data = await promise;
  return <KpiCardsSection data={data} />;
}

async function StageChartSection({
  promise,
}: {
  promise: ReturnType<typeof getLeadsByStageMetrics>;
}) {
  const data = await promise;
  return <LeadsByStageSection data={data} />;
}

async function SourceChartSection({
  promise,
}: {
  promise: ReturnType<typeof getLeadsBySourceMetrics>;
}) {
  const data = await promise;
  return <LeadsBySourceSection data={data} />;
}

async function RecentActivityBlock({
  promise,
  isVendor,
}: {
  promise: ReturnType<typeof getRecentActivities>;
  isVendor: boolean;
}) {
  const data = await promise;
  return <RecentActivitySection data={data} isVendor={isVendor} />;
}

async function UpcomingLeadsBlock({
  promise,
}: {
  promise: ReturnType<typeof getUpcomingClosingLeads>;
}) {
  const data = await promise;
  return <UpcomingLeadsSection data={data} />;
}

async function SellerPerformanceBlock({
  promise,
}: {
  promise: ReturnType<typeof getSellerPerformance>;
}) {
  const data = await promise;
  if (data.length === 0) {
    return null;
  }

  return <SellerPerformanceSection data={data} />;
}

export default async function CrmPage() {
  const session = await requireSession();

  const kpiPromise = getDashboardKpis();
  const stageMetricsPromise = getLeadsByStageMetrics();
  const sourceMetricsPromise = getLeadsBySourceMetrics();
  const recentActivitiesPromise = getRecentActivities();
  const upcomingLeadsPromise = getUpcomingClosingLeads();
  const sellerPerformancePromise = getSellerPerformance();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[#2A1A0A]/15 bg-background px-6 py-7 text-foreground shadow-hard">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge className="border border-[#D4420A]/20 bg-[#D4420A]/10 text-foreground">
              {getRoleLabel(session.user.role)}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Bienvenido, {(session.user.name || "equipo").split(" ")[0]}.
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
                Este es tu centro operativo. Acá ves salud del pipeline, distribución de leads y la actividad comercial más reciente sin salir del CRM.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground hover:bg-[#F5F0E8] hover:text-foreground"
              render={<Link href="/app/crm/contacts" />}
            >
              <BriefcaseBusiness className="mr-2 h-4 w-4" />
              Contactos
            </Button>
            <Button
              variant="outline"
              className="border-[#2A1A0A]/15 bg-[#F5F0E8] text-foreground hover:bg-[#F5F0E8] hover:text-foreground"
              render={<Link href="/app/crm/leads" />}
            >
              <Filter className="mr-2 h-4 w-4" />
              Pipeline
            </Button>
            <Button render={<Link href="/app/crm/leads" />}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Abrir kanban
            </Button>
          </div>
        </div>
      </section>

      <Suspense fallback={<DashboardSectionSkeleton rows={4} />}>
        <KpiSection promise={kpiPromise} />
      </Suspense>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Suspense fallback={<DashboardSectionSkeleton rows={4} />}>
          <StageChartSection promise={stageMetricsPromise} />
        </Suspense>
        <Suspense fallback={<DashboardSectionSkeleton rows={4} />}>
          <SourceChartSection promise={sourceMetricsPromise} />
        </Suspense>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Suspense fallback={<DashboardSectionSkeleton rows={5} />}>
          <RecentActivityBlock
            promise={recentActivitiesPromise}
            isVendor={session.user.role === "vendor"}
          />
        </Suspense>
        <Suspense fallback={<DashboardSectionSkeleton rows={4} />}>
          <UpcomingLeadsBlock promise={upcomingLeadsPromise} />
        </Suspense>
      </div>

      {session.user.role !== "vendor" ? (
        <Suspense fallback={<DashboardSectionSkeleton rows={5} />}>
          <SellerPerformanceBlock promise={sellerPerformancePromise} />
        </Suspense>
      ) : (
        <section className="rounded-[28px] border border-[#2A1A0A]/15 bg-background px-6 py-5 text-foreground shadow-hard">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#D4420A]/10 p-3 text-[#D4420A]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Benchmark del equipo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tus cards de KPI ya muestran la referencia del equipo para que compares tu volumen y conversión sin perder foco en tus propias oportunidades.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

