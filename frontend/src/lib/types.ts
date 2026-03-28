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
