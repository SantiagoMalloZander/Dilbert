-- Add metadata column to activities table
-- Required by the agent pipeline (crm-writer.ts createActivity)
alter table public.activities
  add column if not exists metadata jsonb not null default '{}';
