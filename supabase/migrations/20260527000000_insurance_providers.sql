-- ============================================================
-- Insurance providers (carriers) per tenant, tagged by category (ramo).
-- Powers the Configuración → Aseguradoras screen and, later, quote routing.
-- ============================================================

create table if not exists public.insurance_providers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  -- ramos that this carrier covers: auto, hogar, vida, salud, comercial, art,
  -- caucion, responsabilidad_civil, otros
  categories  text[] not null default '{}',
  logo_url    text,
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

alter table public.insurance_providers enable row level security;

create index if not exists insurance_providers_company_idx
  on public.insurance_providers (company_id);

-- RLS: members of the same company can read/write their providers.
create policy "company members manage insurance providers"
  on public.insurance_providers for all
  using (company_id = (select company_id from public.users where id = auth.uid()));
