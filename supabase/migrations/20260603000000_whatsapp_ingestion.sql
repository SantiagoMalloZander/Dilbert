-- WhatsApp ingestion pipeline (Evolution API)
--
-- The channel_connection_status enum shipped with only 'pending'/'connected' in
-- prod (an early CREATE TYPE won over a later one). Add the missing states we
-- need for the connect/disconnect lifecycle. ADD VALUE is idempotent with IF NOT EXISTS.
alter type public.channel_connection_status add value if not exists 'disconnected';
alter type public.channel_connection_status add value if not exists 'error';

--
-- The Evolution webhook stages every relevant message into whatsapp_message_queue
-- instantly (no AI). A debounced cron processor then groups the pending messages
-- per conversation, builds a transcript and runs the CRM agent once per burst.
-- This mirrors the gmail_queue pattern: dumb+fast ingestion, smart batched processing.

-- ── Connected line metadata on channel_credentials ─────────────────────────────
-- We already store instance_name/status here. Add the connected WhatsApp number
-- (used to attribute the line and to filter out vendor-to-vendor chats) and a
-- backfill marker so we only import history once per connection.
alter table public.channel_credentials
  add column if not exists phone text,
  add column if not exists backfilled_at timestamptz;

-- One Evolution instance maps to exactly one channel_credentials row.
create unique index if not exists channel_credentials_instance_unique_idx
  on public.channel_credentials (instance_name)
  where instance_name is not null;

-- ── Message staging queue ───────────────────────────────────────────────────────
create table if not exists public.whatsapp_message_queue (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  user_id       uuid not null,                 -- vendor that owns the connected line
  instance_name text not null,
  remote_jid    text not null,                 -- counterpart chat id (e.g. 5491122334455@s.whatsapp.net)
  phone         text not null,                 -- digits of the counterpart number
  message_id    text not null,                 -- Evolution message key id (dedup)
  from_me       boolean not null default false,-- true = sent by the vendor
  push_name     text,                          -- WhatsApp display name of the counterpart
  raw_text      text not null,                 -- message text / caption
  occurred_at   timestamptz not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'processing', 'done', 'skipped')),
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);

-- No duplicate queueing of the same message on the same line (webhook retries, backfill overlap).
create unique index if not exists whatsapp_queue_instance_message_idx
  on public.whatsapp_message_queue (instance_name, message_id);

-- Processor scan: pending messages oldest-first, and grouping per conversation.
create index if not exists whatsapp_queue_status_occurred_idx
  on public.whatsapp_message_queue (status, occurred_at asc);

create index if not exists whatsapp_queue_conversation_idx
  on public.whatsapp_message_queue (instance_name, remote_jid, occurred_at asc);

-- RLS: this table is only ever touched by service-role (webhook + cron). Enable RLS
-- with no policies so the anon/auth keys can never read raw message text.
alter table public.whatsapp_message_queue enable row level security;
