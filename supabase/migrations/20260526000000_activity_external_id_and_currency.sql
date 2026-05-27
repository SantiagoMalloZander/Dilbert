-- ============================================================
-- Idempotencia del pipeline + limpieza de moneda
-- Arregla: H-01 (cola que no drena), H-02 (dedup roto), H-05 (sin idempotencia)
-- y la causa del RangeError de moneda (currency null en leads del agente).
-- ============================================================

-- ── 1. activities.external_id ────────────────────────────────────────────────
-- Identificador del evento de origen (gmail message id, whatsapp message id,
-- fathom recording id). Reemplaza la deduplicación frágil basada en buscar el
-- marcador "<!-- gmail:ID -->" dentro de description (que se rompió al simplificar
-- el texto de la activity).
alter table public.activities
  add column if not exists external_id text;

-- Backfill: recuperar el id desde el marcador viejo en description, para no
-- perder la dedup de los emails ya importados antes de esta migración.
update public.activities
set external_id = substring(description from '<!-- gmail:([^>]+) -->')
where external_id is null
  and description like '%<!-- gmail:%';

-- Un mismo evento externo no puede generar dos activities en la misma empresa.
-- Parcial: solo aplica cuando external_id no es null (las activities manuales
-- siguen sin restricción).
create unique index if not exists activities_company_external_id_uidx
  on public.activities (company_id, external_id)
  where external_id is not null;

-- Índice de lookup para la deduplicación por lote en la sincronización de Gmail.
create index if not exists activities_external_id_idx
  on public.activities (external_id)
  where external_id is not null;

-- ── 2. Moneda: nunca null ─────────────────────────────────────────────────────
-- Los leads creados por el agente quedaban con currency null, lo que rompía el
-- formateador de moneda en el frontend (RangeError: Invalid currency code).
update public.leads
set currency = 'ARS'
where currency is null;
