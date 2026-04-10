-- Add whatsapp_business to channel_type enum
do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.channel_type'::regtype
      and enumlabel = 'whatsapp_business'
  ) then
    alter type public.channel_type add value if not exists 'whatsapp_business';
  end if;
end
$$;

-- Add missing columns to channel_credentials
alter table public.channel_credentials
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists status public.channel_connection_status default 'connected',
  add column if not exists updated_at timestamptz default now(),
  add column if not exists last_sync_at timestamptz,
  add column if not exists instance_name text;

-- Ensure status is not null and set default
update public.channel_credentials
set status = 'connected'
where status is null;

alter table public.channel_credentials
  alter column status set not null;

-- Create index for instance lookups
create index if not exists channel_credentials_instance_idx
  on public.channel_credentials (instance_name)
  where instance_name is not null;

-- Create index for company + user lookups
create index if not exists channel_credentials_company_user_idx
  on public.channel_credentials (company_id, user_id);
