-- Lead follow-up state (bandeja de Seguimiento)
--
-- Each time the agent processes a conversation it leaves the lead in a state:
--   attention_status = 'desatendido'  -> the client is waiting for a reply
--                    = 'atendido'     -> the conversation is up to date
-- plus a copy-ready suggested reply and the timestamp of the client's last
-- message (to show "hace cuánto que no se le responde"). attended_at records a
-- manual "marcar como atendido" by the vendor.

alter table public.leads
  add column if not exists attention_status text
    check (attention_status in ('atendido', 'desatendido')),
  add column if not exists suggested_reply text,
  add column if not exists last_client_message_at timestamptz,
  add column if not exists attended_at timestamptz;

-- Seguimiento queries: list/count by company and by assigned vendor, only the
-- leads that have an attention state.
create index if not exists leads_attention_company_idx
  on public.leads (company_id, attention_status)
  where attention_status is not null;

create index if not exists leads_attention_assigned_idx
  on public.leads (assigned_to, attention_status)
  where attention_status is not null;
