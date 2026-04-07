-- Fix schema for new admin actions compatibility

-- Add slug column to companies (nullable, so existing rows are unaffected)
alter table public.companies
  add column if not exists slug text;

-- Unique index on slug, only for non-null values
create unique index if not exists companies_slug_unique_idx
  on public.companies (slug)
  where slug is not null;

-- Make authorized_emails.added_by nullable
-- (admin-created entries have no adding user)
alter table public.authorized_emails
  alter column added_by drop not null;
