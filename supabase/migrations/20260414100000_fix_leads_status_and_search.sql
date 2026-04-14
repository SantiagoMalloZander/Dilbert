-- ============================================================
-- Fix 1: leads.status — drop old constraint FIRST, then update values
-- ============================================================

-- Step 1: Drop the old check constraints and default before touching data
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_currency_check;

-- Step 2: Migrate old status values to new ones
UPDATE public.leads SET status = 'open'
  WHERE status IN ('new', 'contacted', 'negotiating');
UPDATE public.leads SET status = 'won'
  WHERE status = 'closed_won';
UPDATE public.leads SET status = 'lost'
  WHERE status = 'closed_lost';
-- Catch any remaining unknown values
UPDATE public.leads SET status = 'open'
  WHERE status NOT IN ('open', 'won', 'lost', 'paused');

-- Step 3: Create enum type if not exists
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('open','won','lost','paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 4: Change column type from text to the proper enum, then set default
ALTER TABLE public.leads
  ALTER COLUMN status TYPE public.lead_status
    USING status::text::public.lead_status;

ALTER TABLE public.leads
  ALTER COLUMN status SET DEFAULT 'open'::public.lead_status,
  ALTER COLUMN status SET NOT NULL;

-- ============================================================
-- Fix 2: contacts.full_name generated column for combined search
-- ============================================================

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS full_name text
    GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED;

CREATE INDEX IF NOT EXISTS contacts_full_name_idx
  ON public.contacts (lower(full_name));
