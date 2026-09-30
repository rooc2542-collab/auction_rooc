-- Pool snapshots table (stores pool state at a point in time)
CREATE TABLE IF NOT EXISTS pool_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name      TEXT NOT NULL,
  event_date      DATE NOT NULL,
  snapshot_label  TEXT NOT NULL,
  pool_data       JSONB NOT NULL DEFAULT '{}',
  member_data     JSONB NOT NULL DEFAULT '[]',
  discord_sent    BOOLEAN NOT NULL DEFAULT false,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pool_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read snapshots" ON pool_snapshots FOR SELECT USING (true);
CREATE POLICY "service write snapshots" ON pool_snapshots FOR ALL USING (auth.role() = 'service_role');
