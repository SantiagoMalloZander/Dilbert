-- ============================================================
-- PIVOT to real-estate CRM.
-- Drops the insurance vertical (no live data) and adds first-class
-- real-estate lead fields + a `property_zones` config table.
-- ============================================================

-- ── Drop insurance vertical (no production data — verified empty) ────────────
alter table public.leads
  drop column if exists line_of_business,
  drop column if exists carrier,
  drop column if exists policy_number,
  drop column if exists premium_frequency,
  drop column if exists coverage_amount,
  drop column if exists coverage_currency,
  drop column if exists deductible,
  drop column if exists effective_date,
  drop column if exists expiration_date,
  drop column if exists renewal_date,
  drop column if exists insured_item,
  drop column if exists beneficiary,
  drop column if exists policy_status;

drop table if exists public.insurance_providers cascade;

-- ── Real-estate lead fields (first-class, queryable) ────────────────────────
alter table public.leads
  add column if not exists operation_type   text,    -- compra | venta | alquiler | tasacion
  add column if not exists client_role      text,    -- buyer | seller | owner | renter | investor
  add column if not exists property_type    text,    -- depto | casa | ph | terreno | local | oficina | cochera | galpon | quinta
  add column if not exists zone             text,    -- barrio / zona libre
  add column if not exists city             text,
  add column if not exists province         text,
  add column if not exists budget_min       numeric,
  add column if not exists budget_max       numeric,
  add column if not exists budget_currency  text,
  add column if not exists rooms            integer, -- ambientes
  add column if not exists bedrooms         integer, -- dormitorios
  add column if not exists bathrooms        integer,
  add column if not exists surface_total    numeric, -- m² totales
  add column if not exists surface_covered  numeric, -- m² cubiertos
  add column if not exists has_garage       boolean,
  add column if not exists urgency          text,    -- high | medium | low
  add column if not exists timeline         text,    -- "este mes", "antes de fin de año"…
  add column if not exists listing_ref      text,    -- url o id del listing externo
  add column if not exists visit_status     text,    -- agendada | realizada | cancelada
  add column if not exists financing        text;    -- contado | credito | mixto

-- Useful filters for the real-estate analytics page.
create index if not exists leads_operation_idx
  on public.leads (company_id, operation_type) where operation_type is not null;
create index if not exists leads_zone_idx
  on public.leads (company_id, zone) where zone is not null;
create index if not exists leads_property_type_idx
  on public.leads (company_id, property_type) where property_type is not null;

-- ── Configuración → Zonas ───────────────────────────────────────────────────
-- Zones the agency operates in. The agent will use them to validate/normalize
-- the extracted `zone` and to surface unknown zones for review.
create table if not exists public.property_zones (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,                  -- "Palermo", "Recoleta"
  city        text,                           -- "CABA", "La Plata"
  province    text,                           -- "Buenos Aires"
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

alter table public.property_zones enable row level security;
create index if not exists property_zones_company_idx on public.property_zones (company_id);
create policy "company members manage zones"
  on public.property_zones for all
  using (company_id = (select company_id from public.users where id = auth.uid()));

-- ── Default vertical → real_estate ──────────────────────────────────────────
update public.companies
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('vertical', 'real_estate')
where (settings->>'vertical') is null or (settings->>'vertical') = 'insurance';
