import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/ssr";
import { requireAuth } from "@/lib/workspace-auth";
import type {
  InsuranceAnalytics,
  RenewalItem,
  RamoBreakdown,
  CarrierBreakdown,
  StatusBreakdown,
} from "@/modules/crm/analytics/types";

interface InsuranceMeta {
  line_of_business?: string | null;
  carrier?: string | null;
  premium?: number | null;
  premium_currency?: string | null;
  expiration_date?: string | null;
  renewal_date?: string | null;
  status?: string | null;
}

function readInsurance(metadata: unknown): InsuranceMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const ins = (metadata as Record<string, unknown>).insurance;
  if (!ins || typeof ins !== "object") return null;
  return ins as InsuranceMeta;
}

function daysFromToday(date: string): number {
  const target = new Date(`${date}T00:00:00.000Z`).getTime();
  if (Number.isNaN(target)) return NaN;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.ceil((target - todayUtc) / 86_400_000);
}

/**
 * Insurance intelligence for the analytics page. Reads each lead's
 * metadata.insurance (written by the insurance extraction profile) and computes
 * upcoming renewals/expirations and book-of-business breakdowns. Company-scoped.
 */
export async function getInsuranceAnalytics(): Promise<InsuranceAnalytics> {
  const { company_id } = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, title, value, currency, status, contact_id, line_of_business, carrier, expiration_date, renewal_date, policy_status, metadata"
    )
    .eq("company_id", company_id);

  const rows = leads ?? [];

  // Resolve contact names for the renewal list.
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

  const renewals: RenewalItem[] = [];
  const ramoMap = new Map<string, { count: number; totalPremium: number }>();
  const carrierMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  let policiesCount = 0;
  let totalPremium = 0;

  for (const lead of rows) {
    // Prefer first-class columns, fall back to the legacy metadata.insurance blob.
    const meta = readInsurance(lead.metadata);
    const ins: InsuranceMeta = {
      line_of_business: lead.line_of_business ?? meta?.line_of_business ?? null,
      carrier: lead.carrier ?? meta?.carrier ?? null,
      expiration_date: lead.expiration_date ?? meta?.expiration_date ?? null,
      renewal_date: lead.renewal_date ?? meta?.renewal_date ?? null,
      status: lead.policy_status ?? meta?.status ?? null,
    };
    const isInsurance = Boolean(
      ins.line_of_business || ins.carrier || ins.expiration_date || ins.renewal_date || ins.status || meta
    );
    if (!isInsurance) continue;

    policiesCount += 1;
    totalPremium += Number(lead.value ?? 0) || 0;

    if (ins.line_of_business) {
      const cur = ramoMap.get(ins.line_of_business) ?? { count: 0, totalPremium: 0 };
      cur.count += 1;
      cur.totalPremium += Number(lead.value ?? 0) || 0;
      ramoMap.set(ins.line_of_business, cur);
    }
    if (ins.carrier) carrierMap.set(ins.carrier, (carrierMap.get(ins.carrier) ?? 0) + 1);
    if (ins.status) statusMap.set(ins.status, (statusMap.get(ins.status) ?? 0) + 1);

    // Renewals/expirations: prefer the explicit renewal date, else expiration.
    const dateStr = ins.renewal_date || ins.expiration_date;
    if (dateStr) {
      const d = daysFromToday(dateStr);
      if (!Number.isNaN(d) && d <= 60 && d >= -30) {
        renewals.push({
          leadId: lead.id,
          title: lead.title,
          contactName: lead.contact_id ? contactName.get(lead.contact_id) ?? null : null,
          ramo: ins.line_of_business ?? null,
          carrier: ins.carrier ?? null,
          premium: lead.value == null ? null : Number(lead.value),
          currency: lead.currency || "ARS",
          date: dateStr,
          kind: ins.renewal_date ? "renovacion" : "vencimiento",
          daysUntil: d,
        });
      }
    }
  }

  renewals.sort((a, b) => a.daysUntil - b.daysUntil);

  const byRamo: RamoBreakdown[] = [...ramoMap.entries()]
    .map(([ramo, v]) => ({ ramo, count: v.count, totalPremium: v.totalPremium }))
    .sort((a, b) => b.count - a.count);

  const byCarrier: CarrierBreakdown[] = [...carrierMap.entries()]
    .map(([carrier, count]) => ({ carrier, count }))
    .sort((a, b) => b.count - a.count);

  const byStatus: StatusBreakdown[] = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    hasInsuranceData: policiesCount > 0,
    policiesCount,
    totalPremium,
    byStatus,
    renewals,
    byRamo,
    byCarrier,
  };
}
