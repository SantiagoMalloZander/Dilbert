-- Companies
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Sellers
create table sellers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  name text not null,
  telegram_user_id text unique not null,
  created_at timestamptz default now()
);

-- Leads
create table leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  seller_id uuid references sellers(id) on delete set null,
  client_name text,
  client_company text,
  status text default 'new' check (status in ('new', 'contacted', 'negotiating', 'closed_won', 'closed_lost')),
  estimated_amount numeric,
  currency text check (currency in ('ARS', 'USD') or currency is null),
  product_interest text,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative') or sentiment is null),
  next_steps text,
  last_interaction timestamptz default now(),
  created_at timestamptz default now()
);

-- Interactions
create table interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade not null,
  seller_id uuid references sellers(id) on delete set null,
  raw_messages text,
  extracted_data jsonb,
  summary text,
  created_at timestamptz default now()
);

-- Indexes
create index idx_leads_company on leads(company_id);
create index idx_leads_seller on leads(seller_id);
create index idx_interactions_lead on interactions(lead_id);
create index idx_sellers_telegram on sellers(telegram_user_id);

-- Seed demo data
insert into companies (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Demo Company');

insert into sellers (id, company_id, name, telegram_user_id) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Demo Seller', '000000000');

-- Enable realtime
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table interactions;
