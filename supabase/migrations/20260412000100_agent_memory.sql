-- Add agent_memory to channel_type enum
-- Stores vendor learned preferences as JSONB in channel_credentials
ALTER TYPE public.channel_type ADD VALUE IF NOT EXISTS 'agent_memory';
