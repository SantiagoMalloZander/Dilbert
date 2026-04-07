-- Incremental migration: add columns required by new codebase
-- Safe to run on existing production database

-- Add is_active to users table
alter table public.users
  add column if not exists is_active boolean not null default true;

-- Add avatar_url to users table (may already exist)
alter table public.users
  add column if not exists avatar_url text;

-- Add settings to companies table
alter table public.companies
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- Index for is_active queries
create index if not exists users_is_active_idx on public.users (is_active);
create index if not exists users_company_is_active_idx on public.users (company_id, is_active);
