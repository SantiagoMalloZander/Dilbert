-- ============================================================
-- Properties catalog: the agency's listed properties.
-- One row per listing. Leads reference them via leads.listing_ref (text).
-- This is NOT an MLS / portal-sync system — it's the agency's internal catalog.
-- ============================================================

create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,

  -- Identification
  title         text not null,                -- "Depto 2 amb Palermo, balcón al frente"
  internal_code text,                         -- código interno del aviso
  listing_url   text,                         -- URL pública del aviso

  -- Classification
  property_type  text not null,               -- depto | casa | ph | terreno | local | oficina | cochera | galpon | quinta
  operation_type text not null,               -- venta | alquiler | alquiler_temporario
  status         text not null default 'disponible', -- disponible | reservada | vendida | alquilada | pausada

  -- Location
  address   text,                             -- calle + número
  zone      text,                             -- barrio (libre o de property_zones)
  city      text,
  province  text,

  -- Specs
  floor             text,                     -- "PB", "1°", "8°"
  apartment         text,                     -- "A", "B", "12"
  rooms             integer,                  -- ambientes
  bedrooms          integer,                  -- dormitorios
  bathrooms         integer,
  surface_total     numeric,                  -- m² totales
  surface_covered   numeric,                  -- m² cubiertos
  year_built        integer,

  -- Price
  price              numeric,
  currency           text,                    -- USD | ARS
  expenses           numeric,                 -- expensas / mes
  expenses_currency  text,

  -- Features
  has_garage         boolean,
  garage_count       integer,
  mortgage_eligible  boolean,                 -- apto crédito
  amenities          text[] not null default '{}', -- balcón, terraza, parrilla, pileta, gym, sum, seguridad…

  -- Description + assignment
  description  text,
  assigned_to  uuid references public.users(id),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.properties enable row level security;

create index if not exists properties_company_idx on public.properties (company_id);
create index if not exists properties_status_idx on public.properties (company_id, status) where status='disponible';
create index if not exists properties_type_idx on public.properties (company_id, property_type);
create index if not exists properties_zone_idx on public.properties (company_id, zone) where zone is not null;

create policy "company members manage properties"
  on public.properties for all
  using (company_id = (select company_id from public.users where id = auth.uid()));
