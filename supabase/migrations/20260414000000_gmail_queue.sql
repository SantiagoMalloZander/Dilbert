-- gmail_queue: staging table for raw emails waiting to be processed by the AI agent.
-- The sync route inserts here instantly (no AI). The process route reads one row,
-- runs the full agent pipeline, writes to CRM, then deletes the row.

create table if not exists public.gmail_queue (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null,
  email_id     text not null,            -- Gmail message ID (for dedup)
  raw_text     text not null,            -- Pre-formatted text sent to the AI
  external_email text not null,          -- The external party's email address
  sender_name  text,                     -- Display name from the From: header
  occurred_at  timestamptz not null,     -- Email date
  direction    text not null check (direction in ('sent', 'received')),
  created_at   timestamptz not null default now()
);

-- One row per email per user — no duplicate queueing
create unique index if not exists gmail_queue_user_email_idx
  on public.gmail_queue (user_id, email_id);

-- Fast lookup: all pending items for a user, oldest first
create index if not exists gmail_queue_user_created_idx
  on public.gmail_queue (user_id, created_at asc);

-- RLS: users can only see their own queue entries
alter table public.gmail_queue enable row level security;

create policy "user_own_queue" on public.gmail_queue
  for all using (auth.uid() = user_id);
