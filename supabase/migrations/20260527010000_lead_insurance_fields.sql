-- ============================================================
-- Promote insurance attributes to first-class lead columns.
-- They were living in metadata.insurance (jsonb, written by the agent).
-- As columns they become queryable/indexable (renewals, reporting, AMS mapping).
-- metadata.insurance is kept in sync for backward compatibility.
-- ============================================================

alter table public.leads
  add column if not exists line_of_business  text,   -- ramo
  add column if not exists carrier           text,   -- aseguradora
  add column if not exists policy_number     text,
  add column if not exists premium_frequency text,   -- mensual/anual/...
  add column if not exists coverage_amount   numeric,-- suma asegurada
  add column if not exists coverage_currency text,
  add column if not exists deductible        numeric,-- franquicia
  add column if not exists effective_date    date,   -- vigencia desde
  add column if not exists expiration_date   date,   -- vencimiento
  add column if not exists renewal_date       date,
  add column if not exists insured_item      text,   -- bien asegurado
  add column if not exists beneficiary       text,
  add column if not exists policy_status     text;   -- cotizacion/emitida/...
-- (premium = leads.value, premium_currency = leads.currency)

-- Backfill from the existing metadata.insurance blob.
update public.leads set
  line_of_business  = coalesce(line_of_business,  nullif(metadata->'insurance'->>'line_of_business','')),
  carrier           = coalesce(carrier,           nullif(metadata->'insurance'->>'carrier','')),
  policy_number     = coalesce(policy_number,     nullif(metadata->'insurance'->>'policy_number','')),
  premium_frequency = coalesce(premium_frequency, nullif(metadata->'insurance'->>'premium_frequency','')),
  coverage_amount   = coalesce(coverage_amount,   nullif(metadata->'insurance'->>'coverage_amount','')::numeric),
  coverage_currency = coalesce(coverage_currency, nullif(metadata->'insurance'->>'coverage_currency','')),
  deductible        = coalesce(deductible,        nullif(metadata->'insurance'->>'deductible','')::numeric),
  effective_date    = coalesce(effective_date,    nullif(metadata->'insurance'->>'effective_date','')::date),
  expiration_date   = coalesce(expiration_date,   nullif(metadata->'insurance'->>'expiration_date','')::date),
  renewal_date      = coalesce(renewal_date,      nullif(metadata->'insurance'->>'renewal_date','')::date),
  insured_item      = coalesce(insured_item,      nullif(metadata->'insurance'->>'insured_item','')),
  beneficiary       = coalesce(beneficiary,       nullif(metadata->'insurance'->>'beneficiary','')),
  policy_status     = coalesce(policy_status,     nullif(metadata->'insurance'->>'status',''))
where metadata->'insurance' is not null;

create index if not exists leads_expiration_idx
  on public.leads (company_id, expiration_date) where expiration_date is not null;
create index if not exists leads_renewal_idx
  on public.leads (company_id, renewal_date) where renewal_date is not null;
