-- ============================================================
-- AGENT TABLES MIGRATION
-- Adds: agent_questions, contact_channel_links
-- Extends: contacts with enrichment fields
-- ============================================================

-- ── 1. Extend contacts with enrichment fields ─────────────────────────────────
alter table public.contacts
  add column if not exists linkedin_url    text,
  add column if not exists industry        text,
  add column if not exists address         text,
  add column if not exists website         text,
  add column if not exists annual_revenue  numeric,
  add column if not exists employee_count  integer,
  add column if not exists notes           text;

-- ── 2. agent_questions ────────────────────────────────────────────────────────
-- Questions the AI agent generates when it can't resolve something on its own.
-- The vendor answers them async from /app/agente.
create table if not exists public.agent_questions (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  user_id      uuid not null,   -- the vendor who should answer
  contact_id   uuid,            -- the contact this is about (nullable — might be unknown)
  question     text not null,   -- the actual question shown to the vendor
  context      text,            -- raw context that triggered the question (snippet of message/email)
  status       text not null default 'pending' check (status in ('pending', 'answered', 'skipped')),
  answer       text,
  created_at   timestamptz not null default now(),
  answered_at  timestamptz
);

alter table public.agent_questions enable row level security;

create index if not exists agent_questions_company_user_idx
  on public.agent_questions (company_id, user_id, status);

create index if not exists agent_questions_contact_idx
  on public.agent_questions (contact_id)
  where contact_id is not null;

-- RLS: vendors see only their own questions; owners see all in their company
create policy "vendor sees own questions"
  on public.agent_questions for all
  using (
    company_id = (select company_id from public.users where id = auth.uid())
    and (
      user_id = auth.uid()
      or (select role from public.users where id = auth.uid()) = 'owner'
    )
  );

-- ── 3. contact_channel_links ─────────────────────────────────────────────────
-- Maps external identifiers (phone, email, fathom id) to CRM contacts.
-- This is how the agent knows that +5491134567890 = mora@empresa.com = contact X.
create table if not exists public.contact_channel_links (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  channel      text not null check (channel in ('whatsapp', 'gmail', 'fathom', 'manual')),
  identifier   text not null,   -- phone number, email address, or fathom meeting id
  confidence   text not null default 'high' check (confidence in ('high', 'medium')),
  created_at   timestamptz not null default now(),
  unique (company_id, channel, identifier)
);

alter table public.contact_channel_links enable row level security;

create index if not exists contact_channel_links_lookup_idx
  on public.contact_channel_links (company_id, channel, identifier);

create index if not exists contact_channel_links_contact_idx
  on public.contact_channel_links (contact_id);

-- RLS: same company
create policy "company members see own links"
  on public.contact_channel_links for all
  using (
    company_id = (select company_id from public.users where id = auth.uid())
  );

-- ── 4. Seed existing contact emails + phones into contact_channel_links ───────
-- So the agent can immediately start resolving identities from day 1.
insert into public.contact_channel_links (company_id, contact_id, channel, identifier, confidence)
select company_id, id, 'gmail', lower(email), 'high'
from public.contacts
where email is not null and email != ''
on conflict (company_id, channel, identifier) do nothing;

insert into public.contact_channel_links (company_id, contact_id, channel, identifier, confidence)
select company_id, id, 'whatsapp', regexp_replace(phone, '[^0-9+]', '', 'g'), 'high'
from public.contacts
where phone is not null and phone != ''
on conflict (company_id, channel, identifier) do nothing;
