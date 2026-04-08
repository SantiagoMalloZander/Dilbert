-- CRM schema migration: add all tables and columns required by the new codebase
-- Safe to run on existing production database (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type public.crm_source as enum ('manual','whatsapp','gmail','instagram','zoom','meet','import');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entry_source as enum ('manual','automatic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('open','won','lost','paused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_type as enum ('call','email','meeting','note','task','whatsapp','instagram');
exception when duplicate_object then null; end $$;

-- ============================================================
-- ADD MISSING COLUMNS TO EXISTING leads TABLE
-- ============================================================

alter table public.leads
  add column if not exists assigned_to uuid references public.users(id),
  add column if not exists contact_id uuid,
  add column if not exists created_by uuid references public.users(id),
  add column if not exists currency text not null default 'ARS',
  add column if not exists expected_close_date date,
  add column if not exists lost_reason text,
  add column if not exists metadata jsonb not null default '{}',
  add column if not exists pipeline_id uuid,
  add column if not exists probability integer not null default 50,
  add column if not exists source public.crm_source not null default 'manual',
  add column if not exists stage_id uuid,
  add column if not exists status public.lead_status not null default 'open',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists value numeric;

-- ============================================================
-- contacts TABLE
-- ============================================================

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  first_name  text not null,
  last_name   text not null,
  email       text,
  phone       text,
  position    text,
  company_name text,
  assigned_to uuid,
  source      public.crm_source not null default 'manual',
  tags        text[] not null default '{}',
  custom_fields jsonb not null default '{}',
  created_by  uuid not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- pipelines TABLE
-- ============================================================

create table if not exists public.pipelines (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  name        text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- pipeline_stages TABLE
-- ============================================================

create table if not exists public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  pipeline_id uuid not null references public.pipelines(id),
  name        text not null,
  color       text not null default '#6B7280',
  position    integer not null default 0,
  is_won_stage boolean not null default false,
  is_lost_stage boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- notes TABLE
-- ============================================================

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  lead_id     uuid,
  contact_id  uuid,
  user_id     uuid not null,
  content     text not null,
  source      public.entry_source not null default 'manual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- activities TABLE
-- ============================================================

create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  lead_id      uuid,
  contact_id   uuid,
  user_id      uuid not null,
  type         public.activity_type not null,
  title        text not null,
  description  text,
  source       public.entry_source not null default 'manual',
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists leads_company_id_idx on public.leads (company_id);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists contacts_company_id_idx on public.contacts (company_id);
create index if not exists pipelines_company_id_idx on public.pipelines (company_id);
create index if not exists pipeline_stages_pipeline_id_idx on public.pipeline_stages (pipeline_id);
create index if not exists activities_company_id_idx on public.activities (company_id);
create index if not exists activities_lead_id_idx on public.activities (lead_id);
create index if not exists notes_company_id_idx on public.notes (company_id);
create index if not exists notes_lead_id_idx on public.notes (lead_id);

-- ============================================================
-- DEFAULT PIPELINE for existing companies
-- Creates one default pipeline + stages for each company that doesn't have one
-- ============================================================

insert into public.pipelines (id, company_id, name, is_default)
select
  gen_random_uuid(),
  c.id,
  'Pipeline principal',
  true
from public.companies c
where not exists (
  select 1 from public.pipelines p where p.company_id = c.id
);

-- Default stages for each new pipeline
insert into public.pipeline_stages (company_id, pipeline_id, name, color, position, is_won_stage, is_lost_stage)
select
  p.company_id,
  p.id,
  s.name,
  s.color,
  s.position,
  s.is_won_stage,
  s.is_lost_stage
from public.pipelines p
cross join (values
  ('Nuevo',        '#3B82F6', 0, false, false),
  ('En contacto',  '#8B5CF6', 1, false, false),
  ('Propuesta',    '#F59E0B', 2, false, false),
  ('Negociación',  '#F97316', 3, false, false),
  ('Ganado',       '#10B981', 4, true,  false),
  ('Perdido',      '#EF4444', 5, false, true)
) as s(name, color, position, is_won_stage, is_lost_stage)
where not exists (
  select 1 from public.pipeline_stages ps where ps.pipeline_id = p.id
);
