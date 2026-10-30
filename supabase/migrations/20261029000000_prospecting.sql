-- Prospección comercial de Dilvert (uso interno del super-admin).
--
-- `prospects`: inmobiliarias encontradas por el buscador (Google Places / OSM /
-- carga manual) en localidades de Provincia de Buenos Aires fuera de CABA.
-- `prospect_emails`: log de cada mail de campaña enviado (o fallido).
--
-- Solo el service-role toca estas tablas (panel /app/admin/prospeccion).

create table if not exists public.prospects (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  town               text,              -- localidad buscada (ej. "Pinamar")
  region             text,              -- agrupador (ej. "Costa Atlántica")
  address            text,
  phone              text,
  website            text,
  email              text,              -- email principal elegido para la campaña
  emails             text[] not null default '{}',  -- todos los encontrados
  source             text not null check (source in ('google', 'osm', 'manual')),
  external_id        text unique,       -- google place id / osm "node/123"
  maps_url           text,
  -- new | sent | replied | bounced | unsubscribed | discarded
  status             text not null default 'new',
  enriched_at        timestamptz,       -- cuando se rastreó la web buscando emails
  last_contacted_at  timestamptz,
  send_count         integer not null default 0,
  unsubscribe_token  uuid not null unique default gen_random_uuid(),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists prospects_status_idx on public.prospects (status);
create index if not exists prospects_town_idx on public.prospects (town);
create index if not exists prospects_email_idx on public.prospects (lower(email)) where email is not null;

create table if not exists public.prospect_emails (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid references public.prospects(id) on delete set null,
  to_email     text not null,
  subject      text not null,
  status       text not null check (status in ('sent', 'failed')),
  error        text,
  sent_at      timestamptz not null default now()
);

create index if not exists prospect_emails_sent_at_idx on public.prospect_emails (sent_at desc);

alter table public.prospects enable row level security;
alter table public.prospect_emails enable row level security;
