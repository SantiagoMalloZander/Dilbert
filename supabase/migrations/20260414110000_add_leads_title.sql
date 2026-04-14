-- Add title column to leads table (was missing from crm_schema migration)
-- The original table used client_name; new code uses title.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

-- Populate title from client_name for existing records
UPDATE public.leads
  SET title = client_name
  WHERE title = '' AND client_name IS NOT NULL AND client_name <> '';

-- Any remaining blanks get a generic title
UPDATE public.leads
  SET title = 'Lead sin título'
  WHERE title = '';
