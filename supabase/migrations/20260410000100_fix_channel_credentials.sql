-- Fix channel_credentials table structure

-- Rename channel_type to channel if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_credentials' AND column_name = 'channel_type'
  ) THEN
    ALTER TABLE channel_credentials RENAME COLUMN channel_type TO channel;
  END IF;
END
$$;

-- Ensure enums exist
DO $$
BEGIN
  CREATE TYPE public.channel_type AS ENUM (
    'whatsapp_business',
    'whatsapp_personal',
    'gmail',
    'instagram',
    'meet',
    'zoom',
    'teams',
    'fathom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.channel_connection_status AS ENUM (
    'connected',
    'disconnected',
    'error',
    'pending'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Ensure all required columns exist
ALTER TABLE channel_credentials
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS instance_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Ensure status has correct type and default
ALTER TABLE channel_credentials
  ALTER COLUMN status SET DEFAULT 'connected';

-- Create indexes
CREATE INDEX IF NOT EXISTS channel_credentials_instance_idx
  ON public.channel_credentials (instance_name)
  WHERE instance_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS channel_credentials_company_user_idx
  ON public.channel_credentials (company_id, user_id);
