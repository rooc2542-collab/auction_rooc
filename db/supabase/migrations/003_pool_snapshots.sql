-- Migration: Create pool_snapshots table
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/sxonuhwimsvbxhtcqpvg/sql

CREATE TABLE IF NOT EXISTS pool_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name      TEXT NOT NULL,
  event_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  snapshot_label  TEXT NOT NULL,
  pool_data       JSONB NOT NULL DEFAULT '{}',
  member_data     JSONB DEFAULT '[]',
  slots_data      JSONB DEFAULT '[]',
  queue_entries   INT NOT NULL DEFAULT 0,
  discord_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pool_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'pool_snapshots' AND policyname = 'public read snapshots'
  ) THEN
    CREATE POLICY "public read snapshots" ON pool_snapshots FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'pool_snapshots' AND policyname = 'service write snapshots'
  ) THEN
    CREATE POLICY "service write snapshots" ON pool_snapshots FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Verify
SELECT COUNT(*) AS row_count FROM pool_snapshots;
