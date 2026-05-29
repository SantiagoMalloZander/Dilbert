export type OperationBreakdown = {
  operation: string;
  count: number;
  totalBudget: number;
};

export type ZoneBreakdown = {
  zone: string;
  count: number;
};

export type PropertyTypeBreakdown = {
  propertyType: string;
  count: number;
};

export type UpcomingVisit = {
  leadId: string;
  title: string;
  contactName: string | null;
  zone: string | null;
  propertyType: string | null;
  expectedCloseDate: string | null;
};

export type HotLead = {
  leadId: string;
  title: string;
  contactName: string | null;
  zone: string | null;
  operation: string | null;
  budgetMax: number | null;
  currency: string;
  daysOld: number;
};

export type RealEstateAnalytics = {
  /** Whether this tenant has any real-estate-tagged leads at all. */
  hasRealEstateData: boolean;
  /** Leads carrying any real-estate attributes (searches/listings). */
  searchesCount: number;
  /** Active open searches. */
  activeSearches: number;
  /** Pipeline budget value (sum of budget_max for open searches). */
  pipelineBudget: number;
  byOperation: OperationBreakdown[];
  byZone: ZoneBreakdown[];
  byPropertyType: PropertyTypeBreakdown[];
  upcomingVisits: UpcomingVisit[];
  hotLeads: HotLead[];
};
