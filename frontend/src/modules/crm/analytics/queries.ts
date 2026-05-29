import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { requireAuth } from "@/lib/workspace-auth";
import type {
  RealEstateAnalytics,
  OperationBreakdown,
  ZoneBreakdown,
  PropertyTypeBreakdown,
  UpcomingVisit,
  HotLead,
} from "@/modules/crm/analytics/types";

function daysSince(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.floor((Date.now() - target) / 86_400_000);
}

/**
 * Real-estate intelligence for the analytics page. Reads each lead's structured
 * real-estate columns and computes pipeline by operation/zone/type, upcoming
 * visits and hot leads (urgent, recently opened). Company-scoped.
 */
export async function getRealEstateAnalytics(): Promise<RealEstateAnalytics> {
  const { company_id } = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, title, status, currency, value, contact_id, created_at, expected_close_date, operation_type, property_type, zone, city, budget_min, budget_max, budget_currency, urgency, visit_status")
    .eq("company_id", company_id);

  const rows = leads ?? [];

  // Resolve contact names for the visit/hot-leads lists.
  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))] as string[];
  const contactName = new Map<string, string>();
  if (contactIds.length) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .in("id", contactIds);
    for (const c of contacts ?? []) {
      contactName.set(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sin nombre");
    }
  }

  const opMap = new Map<string, { count: number; totalBudget: number }>();
  const zoneMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const upcomingVisits: UpcomingVisit[] = [];
  const hotLeads: HotLead[] = [];

  let searchesCount = 0;
  let activeSearches = 0;
  let pipelineBudget = 0;

  for (const lead of rows) {
    const isRealEstate = Boolean(
      lead.operation_type || lead.property_type || lead.zone || lead.budget_max || lead.urgency || lead.visit_status
    );
    if (!isRealEstate) continue;

    searchesCount += 1;
    const isOpen = lead.status === "open" || lead.status === "paused";
    if (isOpen) {
      activeSearches += 1;
      pipelineBudget += Number(lead.budget_max ?? lead.value ?? 0) || 0;
    }

    if (lead.operation_type) {
      const cur = opMap.get(lead.operation_type) ?? { count: 0, totalBudget: 0 };
      cur.count += 1;
      cur.totalBudget += Number(lead.budget_max ?? lead.value ?? 0) || 0;
      opMap.set(lead.operation_type, cur);
    }
    if (lead.zone) zoneMap.set(lead.zone, (zoneMap.get(lead.zone) ?? 0) + 1);
    if (lead.property_type) typeMap.set(lead.property_type, (typeMap.get(lead.property_type) ?? 0) + 1);

    // Upcoming visits: scheduled but not yet realised.
    if (lead.visit_status === "agendada" && isOpen) {
      upcomingVisits.push({
        leadId: lead.id,
        title: lead.title,
        contactName: lead.contact_id ? contactName.get(lead.contact_id) ?? null : null,
        zone: lead.zone,
        propertyType: lead.property_type,
        expectedCloseDate: lead.expected_close_date,
      });
    }

    // Hot leads: high urgency, open, with budget.
    if (lead.urgency === "high" && isOpen) {
      hotLeads.push({
        leadId: lead.id,
        title: lead.title,
        contactName: lead.contact_id ? contactName.get(lead.contact_id) ?? null : null,
        zone: lead.zone,
        operation: lead.operation_type,
        budgetMax: lead.budget_max ?? lead.value ?? null,
        currency: lead.budget_currency || lead.currency || "ARS",
        daysOld: daysSince(lead.created_at),
      });
    }
  }

  const byOperation: OperationBreakdown[] = [...opMap.entries()]
    .map(([operation, v]) => ({ operation, count: v.count, totalBudget: v.totalBudget }))
    .sort((a, b) => b.count - a.count);

  const byZone: ZoneBreakdown[] = [...zoneMap.entries()]
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const byPropertyType: PropertyTypeBreakdown[] = [...typeMap.entries()]
    .map(([propertyType, count]) => ({ propertyType, count }))
    .sort((a, b) => b.count - a.count);

  hotLeads.sort((a, b) => a.daysOld - b.daysOld);

  return {
    hasRealEstateData: searchesCount > 0,
    searchesCount,
    activeSearches,
    pipelineBudget,
    byOperation,
    byZone,
    byPropertyType,
    upcomingVisits,
    hotLeads,
  };
}
