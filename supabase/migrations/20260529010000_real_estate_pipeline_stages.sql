-- ============================================================
-- Default pipeline stages → real-estate flow.
-- New flow: Nuevo → Contactado → Calificado → Visita agendada → Negociación → Cerrado / Perdido.
--
-- For existing pipelines that still have the original 6 generic stages
-- (Nuevo / En contacto / Propuesta / Negociación / Ganado / Perdido), we rename
-- in place (existing leads keep their stage_id and shift semantically with their stage)
-- and insert the new "Visita agendada" stage at position 3.
--
-- For NEW companies, a trigger seeds the real-estate pipeline so the product
-- works out of the box even when companies are created outside SQL migrations.
-- ============================================================

-- ── 1. Update existing default pipelines ────────────────────────────────────
do $$
declare
  p record;
  is_default_set boolean;
begin
  for p in select id, company_id from public.pipelines loop
    select
      (select count(*) = 6 from public.pipeline_stages where pipeline_id = p.id)
      and exists (select 1 from public.pipeline_stages where pipeline_id = p.id and position = 0 and name = 'Nuevo')
      and exists (select 1 from public.pipeline_stages where pipeline_id = p.id and position = 1 and name = 'En contacto')
      and exists (select 1 from public.pipeline_stages where pipeline_id = p.id and position = 2 and name = 'Propuesta')
      and exists (select 1 from public.pipeline_stages where pipeline_id = p.id and position = 3 and name = 'Negociación')
      and exists (select 1 from public.pipeline_stages where pipeline_id = p.id and position = 4 and name = 'Ganado' and is_won_stage)
      and exists (select 1 from public.pipeline_stages where pipeline_id = p.id and position = 5 and name = 'Perdido' and is_lost_stage)
    into is_default_set;

    if is_default_set then
      -- Shift positions 3-5 up by one to make room for "Visita agendada" at pos 3.
      update public.pipeline_stages
        set position = position + 1, updated_at = now()
        where pipeline_id = p.id and position >= 3;

      -- Rename existing rows (stage_id stays the same — existing leads follow their stage).
      -- pos 0 "Nuevo" stays.
      update public.pipeline_stages set name = 'Contactado', color = '#8B5CF6', updated_at = now()
        where pipeline_id = p.id and position = 1;
      update public.pipeline_stages set name = 'Calificado', color = '#A855F7', updated_at = now()
        where pipeline_id = p.id and position = 2;
      -- pos 4 (was 3) "Negociación" — name stays, just position shifted.
      update public.pipeline_stages set name = 'Cerrado', color = '#10B981', updated_at = now()
        where pipeline_id = p.id and position = 5;
      -- pos 6 (was 5) "Perdido" — name stays.

      -- Insert the new "Visita agendada" stage at position 3.
      insert into public.pipeline_stages (company_id, pipeline_id, name, color, position, is_won_stage, is_lost_stage)
      values (p.company_id, p.id, 'Visita agendada', '#F59E0B', 3, false, false);
    end if;
  end loop;
end$$;

-- ── 2. Trigger: seed real-estate pipeline for every new company ─────────────
create or replace function public.seed_real_estate_pipeline_for_company()
returns trigger language plpgsql security definer as $$
declare
  pid uuid;
begin
  -- Don't seed if the company already has a pipeline (race-safe).
  if exists (select 1 from public.pipelines where company_id = NEW.id) then
    return NEW;
  end if;

  insert into public.pipelines (company_id, name, is_default)
  values (NEW.id, 'Pipeline principal', true)
  returning id into pid;

  insert into public.pipeline_stages (company_id, pipeline_id, name, color, position, is_won_stage, is_lost_stage)
  values
    (NEW.id, pid, 'Nuevo',           '#3B82F6', 0, false, false),
    (NEW.id, pid, 'Contactado',      '#8B5CF6', 1, false, false),
    (NEW.id, pid, 'Calificado',      '#A855F7', 2, false, false),
    (NEW.id, pid, 'Visita agendada', '#F59E0B', 3, false, false),
    (NEW.id, pid, 'Negociación',     '#F97316', 4, false, false),
    (NEW.id, pid, 'Cerrado',         '#10B981', 5, true,  false),
    (NEW.id, pid, 'Perdido',         '#EF4444', 6, false, true);
  return NEW;
end;
$$;

drop trigger if exists seed_pipeline_after_company_insert on public.companies;
create trigger seed_pipeline_after_company_insert
after insert on public.companies
for each row execute function public.seed_real_estate_pipeline_for_company();
