do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'company_status'
  ) then
    create type public.company_status as enum ('active', 'inactive');
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'user_role'
  ) then
    create type public.user_role as enum ('owner', 'analyst', 'vendor');
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'channel_type'
  ) then
    create type public.channel_type as enum (
      'whatsapp',
      'gmail',
      'instagram',
      'meet',
      'zoom',
      'teams',
      'fathom'
    );
  end if;
end
$$;

alter table public.companies
  add column if not exists vendor_limit integer,
  add column if not exists status public.company_status;

update public.companies
set vendor_limit = 5
where vendor_limit is null;

update public.companies
set status = 'active'
where status is null;

alter table public.companies
  alter column vendor_limit set default 5,
  alter column vendor_limit set not null,
  alter column status set default 'active',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_vendor_limit_positive'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_vendor_limit_positive
      check (vendor_limit > 0);
  end if;
end
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  name text not null,
  avatar_url text,
  role public.user_role not null,
  department text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.authorized_emails (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  added_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.invite_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel_type public.channel_type not null,
  credentials jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now()
);

create unique index if not exists users_email_unique_idx
  on public.users (lower(email));

create index if not exists users_company_idx
  on public.users (company_id);

create index if not exists users_company_role_idx
  on public.users (company_id, role);

create unique index if not exists authorized_emails_company_email_unique_idx
  on public.authorized_emails (company_id, lower(email));

create index if not exists authorized_emails_company_idx
  on public.authorized_emails (company_id);

create unique index if not exists invite_links_token_unique_idx
  on public.invite_links (token);

create index if not exists invite_links_company_idx
  on public.invite_links (company_id);

create unique index if not exists channel_credentials_user_channel_unique_idx
  on public.channel_credentials (user_id, channel_type);

create or replace function public.normalize_email_value()
returns trigger
language plpgsql
as $$
begin
  if new.email is not null then
    new.email := lower(trim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists users_normalize_email_trigger on public.users;
create trigger users_normalize_email_trigger
before insert or update of email on public.users
for each row
execute function public.normalize_email_value();

drop trigger if exists authorized_emails_normalize_email_trigger on public.authorized_emails;
create trigger authorized_emails_normalize_email_trigger
before insert or update of email on public.authorized_emails
for each row
execute function public.normalize_email_value();

create or replace function public.enforce_vendor_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_vendors integer;
  vendor_count integer;
begin
  if new.role <> 'vendor' then
    return new;
  end if;

  select company.vendor_limit
  into max_vendors
  from public.companies company
  where company.id = new.company_id;

  if max_vendors is null then
    return new;
  end if;

  select count(*)
  into vendor_count
  from public.users existing_user
  where existing_user.company_id = new.company_id
    and existing_user.role = 'vendor'
    and existing_user.id <> new.id;

  if vendor_count >= max_vendors then
    raise exception 'vendor_limit_exceeded'
      using detail = format(
        'Company %s reached its vendor limit (%s).',
        new.company_id,
        max_vendors
      );
  end if;

  return new;
end;
$$;

drop trigger if exists users_enforce_vendor_limit_trigger on public.users;
create trigger users_enforce_vendor_limit_trigger
before insert or update of company_id, role on public.users
for each row
execute function public.enforce_vendor_limit();

create or replace function public.is_admin_email()
returns boolean
language sql
stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = 'dilbert@gmail.com';
$$;

create or replace function public.current_user_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select user_row.company_id
  from public.users user_row
  where user_row.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select user_row.role
  from public.users user_row
  where user_row.id = auth.uid()
  limit 1;
$$;

create or replace function public.can_access_company(target_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_admin_email()
    or exists (
      select 1
      from public.users user_row
      where user_row.id = auth.uid()
        and user_row.company_id = target_company_id
    );
$$;

create or replace function public.is_owner_for_company(target_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_admin_email()
    or exists (
      select 1
      from public.users user_row
      where user_row.id = auth.uid()
        and user_row.company_id = target_company_id
        and user_row.role = 'owner'
    );
$$;

create or replace function public.is_email_authorized_for_company(
  target_company_id uuid,
  target_email text
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_admin_email()
    or exists (
      select 1
      from public.authorized_emails authorized_email
      where authorized_email.company_id = target_company_id
        and lower(authorized_email.email) = lower(trim(target_email))
    );
$$;

create or replace function public.can_manage_channel_credentials(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_admin_email()
    or auth.uid() = target_user_id
    or exists (
      select 1
      from public.users actor
      join public.users target
        on target.id = target_user_id
      where actor.id = auth.uid()
        and actor.role = 'owner'
        and actor.company_id = target.company_id
    );
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.authorized_emails to authenticated;
grant select, insert, update, delete on public.invite_links to authenticated;
grant select, insert, update, delete on public.channel_credentials to authenticated;

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.authorized_emails enable row level security;
alter table public.invite_links enable row level security;
alter table public.channel_credentials enable row level security;

drop policy if exists "companies_select_own_company" on public.companies;
create policy "companies_select_own_company"
on public.companies
for select
using (public.can_access_company(id));

drop policy if exists "companies_insert_admin_only" on public.companies;
create policy "companies_insert_admin_only"
on public.companies
for insert
with check (public.is_admin_email());

drop policy if exists "companies_update_admin_only" on public.companies;
create policy "companies_update_admin_only"
on public.companies
for update
using (public.is_admin_email())
with check (public.is_admin_email());

drop policy if exists "companies_delete_admin_only" on public.companies;
create policy "companies_delete_admin_only"
on public.companies
for delete
using (public.is_admin_email());

drop policy if exists "users_select_same_company" on public.users;
create policy "users_select_same_company"
on public.users
for select
using (public.can_access_company(company_id));

drop policy if exists "users_insert_authorized_or_admin" on public.users;
create policy "users_insert_authorized_or_admin"
on public.users
for insert
with check (
  public.is_admin_email()
  or (
    auth.uid() = id
    and lower(email) = coalesce(lower(auth.jwt() ->> 'email'), '')
    and public.is_email_authorized_for_company(company_id, email)
  )
);

drop policy if exists "users_update_owner_or_admin" on public.users;
create policy "users_update_owner_or_admin"
on public.users
for update
using (
  public.is_admin_email()
  or public.is_owner_for_company(company_id)
)
with check (
  public.is_admin_email()
  or public.is_owner_for_company(company_id)
);

drop policy if exists "users_delete_owner_or_admin" on public.users;
create policy "users_delete_owner_or_admin"
on public.users
for delete
using (
  public.is_admin_email()
  or public.is_owner_for_company(company_id)
);

drop policy if exists "authorized_emails_select_owner_only" on public.authorized_emails;
create policy "authorized_emails_select_owner_only"
on public.authorized_emails
for select
using (public.is_owner_for_company(company_id));

drop policy if exists "authorized_emails_insert_owner_only" on public.authorized_emails;
create policy "authorized_emails_insert_owner_only"
on public.authorized_emails
for insert
with check (
  public.is_admin_email()
  or (
    added_by = auth.uid()
    and public.is_owner_for_company(company_id)
  )
);

drop policy if exists "authorized_emails_update_owner_only" on public.authorized_emails;
create policy "authorized_emails_update_owner_only"
on public.authorized_emails
for update
using (public.is_owner_for_company(company_id))
with check (
  public.is_admin_email()
  or (
    added_by = auth.uid()
    and public.is_owner_for_company(company_id)
  )
);

drop policy if exists "authorized_emails_delete_owner_only" on public.authorized_emails;
create policy "authorized_emails_delete_owner_only"
on public.authorized_emails
for delete
using (public.is_owner_for_company(company_id));

drop policy if exists "invite_links_select_owner_only" on public.invite_links;
create policy "invite_links_select_owner_only"
on public.invite_links
for select
using (public.is_owner_for_company(company_id));

drop policy if exists "invite_links_insert_owner_only" on public.invite_links;
create policy "invite_links_insert_owner_only"
on public.invite_links
for insert
with check (public.is_owner_for_company(company_id));

drop policy if exists "invite_links_update_owner_only" on public.invite_links;
create policy "invite_links_update_owner_only"
on public.invite_links
for update
using (public.is_owner_for_company(company_id))
with check (public.is_owner_for_company(company_id));

drop policy if exists "invite_links_delete_owner_only" on public.invite_links;
create policy "invite_links_delete_owner_only"
on public.invite_links
for delete
using (public.is_owner_for_company(company_id));

drop policy if exists "channel_credentials_select_scoped_access" on public.channel_credentials;
create policy "channel_credentials_select_scoped_access"
on public.channel_credentials
for select
using (public.can_manage_channel_credentials(user_id));

drop policy if exists "channel_credentials_insert_scoped_access" on public.channel_credentials;
create policy "channel_credentials_insert_scoped_access"
on public.channel_credentials
for insert
with check (public.can_manage_channel_credentials(user_id));

drop policy if exists "channel_credentials_update_scoped_access" on public.channel_credentials;
create policy "channel_credentials_update_scoped_access"
on public.channel_credentials
for update
using (public.can_manage_channel_credentials(user_id))
with check (public.can_manage_channel_credentials(user_id));

drop policy if exists "channel_credentials_delete_scoped_access" on public.channel_credentials;
create policy "channel_credentials_delete_scoped_access"
on public.channel_credentials
for delete
using (public.can_manage_channel_credentials(user_id));
