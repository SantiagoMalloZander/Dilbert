import Link from "next/link";
import { Suspense } from "react";
import { BriefcaseBusiness, ListChecks } from "lucide-react";
import {
  DashboardSectionSkeleton,
  KpiCardsSection,
  RecentActivitySection,
  UpcomingLeadsSection,
} from "@/components/crm/DashboardSections";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/workspace-auth";
import { getRecentActivities } from "@/modules/crm/activities/queries";
import { getDashboardKpis, getUpcomingClosingLeads } from "@/modules/crm/leads/queries";

async function KpiSection({ promise }: { promise: ReturnType<typeof getDashboardKpis> }) {
  return <KpiCardsSection data={await promise} />;
}

async function RecentActivityBlock({
  promise,
  isVendor,
}: {
  promise: ReturnType<typeof getRecentActivities>;
  isVendor: boolean;
}) {
  return <RecentActivitySection data={await promise} isVendor={isVendor} />;
}

async function UpcomingLeadsBlock({
  promise,
}: {
  promise: ReturnType<typeof getUpcomingClosingLeads>;
}) {
  return <UpcomingLeadsSection data={await promise} />;
}

export default async function CrmPage() {
  const session = await requireSession();
  const firstName = (session.user.name || "equipo").split(" ")[0];

  const kpiPromise = getDashboardKpis();
  const recentActivitiesPromise = getRecentActivities();
  const upcomingLeadsPromise = getUpcomingClosingLeads();

  return (
    <div className="space-y-6">
      <Card className="bg-card/90">
        <CardContent className="pt-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Hola, {firstName}.
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Acá ves tus clientes y en qué anda cada uno. El asistente carga solo lo que llega
                por WhatsApp y mail.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" render={<Link href="/app/crm/contacts" />}>
                <BriefcaseBusiness className="mr-2 h-4 w-4" />
                Clientes
              </Button>
              <Button render={<Link href="/app/crm/leads" />}>
                <ListChecks className="mr-2 h-4 w-4" />
                Seguimiento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Suspense fallback={<DashboardSectionSkeleton rows={3} />}>
        <KpiSection promise={kpiPromise} />
      </Suspense>

      <Suspense fallback={<DashboardSectionSkeleton rows={4} />}>
        <UpcomingLeadsBlock promise={upcomingLeadsPromise} />
      </Suspense>

      <Suspense fallback={<DashboardSectionSkeleton rows={5} />}>
        <RecentActivityBlock
          promise={recentActivitiesPromise}
          isVendor={session.user.role === "vendor"}
        />
      </Suspense>
    </div>
  );
}
