-- Billing & subscriptions (Stripe + Mercado Pago)
--
-- One subscription row per company. Access is granted when the company is
-- billing_exempt (grandfathered / comped) OR has a subscription in an active
-- state. The agent/app never reads card data — only the subscription state.

-- Grandfather everything that already exists so current users never get locked out.
alter table public.companies
  add column if not exists billing_exempt boolean not null default false;

update public.companies set billing_exempt = true;

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null unique references public.companies(id) on delete cascade,
  provider               text check (provider in ('stripe', 'mercadopago')),
  -- none | incomplete | pending | trialing | active | past_due | canceled
  status                 text not null default 'none',
  seats                  integer not null default 1,
  unit_amount            integer,          -- price per seat, minor units (e.g. 1500 = USD 15.00)
  currency               text,             -- 'usd' | 'ars'
  stripe_customer_id     text,
  stripe_subscription_id text,
  mp_preapproval_id      text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_stripe_sub_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists subscriptions_mp_idx
  on public.subscriptions (mp_preapproval_id)
  where mp_preapproval_id is not null;

-- Only service-role (webhooks + server actions) touches this table.
alter table public.subscriptions enable row level security;
