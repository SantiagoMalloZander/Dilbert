alter table public.users
  alter column company_id drop not null,
  alter column role drop not null;

alter table public.authorized_emails
  add column if not exists role public.user_role;

update public.authorized_emails authorized_email
set role = user_row.role
from public.users user_row
where lower(authorized_email.email) = lower(user_row.email)
  and authorized_email.role is null;

update public.authorized_emails
set role = 'vendor'
where role is null;

alter table public.authorized_emails
  alter column role set default 'vendor',
  alter column role set not null;

create table if not exists public.pending_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  password_ciphertext text,
  oauth_provider text,
  oauth_provider_account_id text,
  avatar_url text,
  otp_hash text not null,
  otp_expires_at timestamptz not null,
  completed_session_token text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pending_registrations_email_unique_idx
  on public.pending_registrations (lower(email));

create unique index if not exists pending_registrations_completed_session_token_unique_idx
  on public.pending_registrations (completed_session_token)
  where completed_session_token is not null;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pending_registrations_set_updated_at on public.pending_registrations;
create trigger pending_registrations_set_updated_at
before update on public.pending_registrations
for each row
execute function public.set_updated_at_timestamp();
