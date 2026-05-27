export type RenewalItem = {
  leadId: string;
  title: string;
  contactName: string | null;
  ramo: string | null;
  carrier: string | null;
  premium: number | null;
  currency: string;
  /** The expiration or renewal date (YYYY-MM-DD) */
  date: string;
  kind: "vencimiento" | "renovacion";
  daysUntil: number;
};

export type RamoBreakdown = {
  ramo: string;
  count: number;
  totalPremium: number;
};

export type CarrierBreakdown = {
  carrier: string;
  count: number;
};

export type StatusBreakdown = {
  status: string;
  count: number;
};

export type InsuranceAnalytics = {
  /** Whether this tenant has any insurance-tagged leads at all. */
  hasInsuranceData: boolean;
  /** Leads carrying insurance metadata (policies/quotes). */
  policiesCount: number;
  /** Sum of premiums (lead.value) across insurance leads. */
  totalPremium: number;
  byStatus: StatusBreakdown[];
  /** Upcoming renewals/expirations (next 60 days, plus recently overdue). */
  renewals: RenewalItem[];
  byRamo: RamoBreakdown[];
  byCarrier: CarrierBreakdown[];
};
