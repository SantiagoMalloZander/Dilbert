-- ============================================================
-- Multi-tenant security: RLS on the core CRM tables.
--
-- Until now leads/contacts/activities/notes/pipelines/pipeline_stages had NO
-- row-level security — isolation between agencies relied entirely on a
-- .eq(company_id) filter in each query. This enforces isolation at the database
-- level using the existing can_access_company() helper (super admin OR the
-- user's own company), the same pattern already used by properties/companies.
--
-- Reads in the CRM run with the user's session (anon key + cookies), so RLS
-- applies. The agent and admin paths use the service-role key, which bypasses
-- RLS by design — they keep working.
-- ============================================================

-- ── 0. Point super-admin at the real admin account ──────────────────────────
create or replace function public.is_admin_email()
returns boolean
language sql
stable
as $function$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = 'mzanderconsulting@gmail.com';
$function$;

-- ── 1. Core tables scoped by company_id ──────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['leads','contacts','activities','notes','pipelines','pipeline_stages','sellers']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_access on public.%I', t);
    execute format(
      'create policy tenant_access on public.%I for all
         using (public.can_access_company(company_id))
         with check (public.can_access_company(company_id))', t);
  end loop;
end$$;

-- ── 2. Legacy tables without company_id → closed to normal users ─────────────
-- (service-role bypasses; the super admin can still read via is_admin_email)
do $$
declare t text;
begin
  foreach t in array array['interactions','pending_registrations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_only on public.%I', t);
    execute format(
      'create policy admin_only on public.%I for all
         using (public.is_admin_email())
         with check (public.is_admin_email())', t);
  end loop;
end$$;
