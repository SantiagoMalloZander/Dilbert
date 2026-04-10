-- Force fix: ensure channel_credentials has 'channel' column, not 'channel_type'

-- Check if channel_type exists and rename it
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_credentials' AND column_name = 'channel_type'
  ) INTO col_exists;

  IF col_exists THEN
    -- Drop the constraint that may reference it
    ALTER TABLE channel_credentials DROP CONSTRAINT IF EXISTS channel_credentials_user_channel_idx;

    -- Rename the column
    ALTER TABLE channel_credentials RENAME COLUMN channel_type TO channel;

    -- Create unique index on (user_id, channel)
    CREATE UNIQUE INDEX IF NOT EXISTS channel_credentials_user_channel_idx
      ON channel_credentials (user_id, channel);
  END IF;
END
$$;

-- If channel column still doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_credentials' AND column_name = 'channel'
  ) THEN
    ALTER TABLE channel_credentials
      ADD COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'gmail';
  END IF;
END
$$;
