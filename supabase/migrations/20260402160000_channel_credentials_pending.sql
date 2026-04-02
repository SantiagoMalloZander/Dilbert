do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'channel_connection_status'
  ) then
    create type public.channel_connection_status as enum ('pending', 'connected');
  end if;
end
$$;

do $$
begin
  alter type public.channel_type add value if not exists 'whatsapp_personal';
exception
  when duplicate_object then
    null;
end
$$;

alter table public.channel_credentials
  add column if not exists status public.channel_connection_status;

update public.channel_credentials
set status = 'connected'
where status is null;

alter table public.channel_credentials
  alter column status set default 'connected',
  alter column status set not null;

create index if not exists channel_credentials_user_status_idx
  on public.channel_credentials (user_id, status);
