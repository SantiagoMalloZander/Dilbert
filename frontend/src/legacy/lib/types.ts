// @ts-nocheck
export type Lead = {
  id: string;
  company_id: string;
  seller_id: string | null;
  client_name: string | null;
  client_company: string | null;
  status: "new" | "contacted" | "negotiating" | "closed_won" | "closed_lost";
  estimated_amount: number | null;
  currency: "ARS" | "USD" | null;
  product_interest: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  next_steps: string | null;
  last_interaction: string;
  created_at: string;
  sellers?: { name: string } | null;
};

export type Interaction = {
  id: string;
  lead_id: string;
  seller_id: string | null;
  raw_messages: string;
  extracted_data: Record<string, unknown> | null;
  summary: string | null;
  created_at: string;
  source_type: string | null;
};

export type Seller = {
  id: string;
  company_id: string;
  name: string;
  telegram_user_id: string;
  created_at: string;
};

export type Company = {
  id: string;
  name: string;
  created_at: string;
};

export type AnalyticsCompanyContext = {
  company: Company;
  sellers: Seller[];
  leads: Lead[];
  interactions: Interaction[];
};

export type PurchaseSignalLevel =
  | "muy_alta"
  | "alta"
  | "media"
  | "baja"
  | "muy_baja";

export type PurchaseSignal = {
  level: PurchaseSignalLevel;
  label: string;
  description: string;
};

export type ClientLeadHistoryItem = {
  id: string;
  status: Lead["status"];
  estimated_amount: number | null;
  currency: Lead["currency"];
  product_interest: string | null;
  next_steps: string | null;
  last_interaction: string;
  created_at: string;
  seller_name: string | null;
  sentiment: Lead["sentiment"];
};

export type ClientInteractionHistoryItem = {
  id: string;
  created_at: string;
  summary: string | null;
  raw_messages: string | null;
  extracted_data: Record<string, unknown> | null;
};

export type AnalyticsClient = {
  client_key: string;
  primary_lead_id: string;
  lead_ids: string[];
  client_name: string;
  client_company: string | null;
  current_status: Lead["status"];
  dominant_product: string | null;
  dominant_currency: Lead["currency"];
  average_estimated_amount: number;
  predicted_30d_amount: number;
  predicted_90d_amount: number;
  purchase_probability_30d: number;
  purchase_signal: PurchaseSignal;
  predicted_next_purchase_days: number;
  recency_days: number;
  average_cadence_days: number;
  confidence_score: number;
  lead_count: number;
  interaction_count: number;
  closed_won_count: number;
  closed_won_amount: number;
  segment: string;
  segment_label: string;
  top_drivers: string[];
  seller_names: string[];
  lead_history: ClientLeadHistoryItem[];
  interaction_history: ClientInteractionHistoryItem[];
};

export type AnalyticsSummary = {
  company_id: string;
  company_name: string;
  generated_at: string;
  total_clients: number;
  total_leads: number;
  total_interactions: number;
  predicted_30d_revenue: number;
  predicted_90d_revenue: number;
  average_purchase_probability_30d: number;
  top_products: { product: string; clients: number }[];
  segment_breakdown: Record<string, number>;
};

export type AnalyticsReport = {
  summary: AnalyticsSummary;
  clients: AnalyticsClient[];
};
