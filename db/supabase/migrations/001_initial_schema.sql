-- ============================================================
-- Auction RoOC — Initial Schema
-- ============================================================

-- ── 1. Profiles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id    TEXT        UNIQUE NOT NULL,
  display_name  TEXT        NOT NULL,
  uid_game      TEXT,
  role          TEXT        NOT NULL DEFAULT 'member'
                            CHECK (role IN ('admin', 'member')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Auction Rounds ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_rounds (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  item_type        TEXT        NOT NULL
                               CHECK (item_type IN ('Album','Puppet','White','RedBlack')),
  total_quantity   INT         NOT NULL CHECK (total_quantity > 0),
  personal_limit   INT         NOT NULL CHECK (personal_limit > 0),
  status           TEXT        NOT NULL DEFAULT 'voting'
                               CHECK (status IN ('voting','bidding','closed')),
  vote_message_id  TEXT,
  result_message_id TEXT,
  channel_id       TEXT        NOT NULL,
  created_by       UUID        REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Round Votes ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS round_votes (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id  UUID        NOT NULL REFERENCES auction_rounds(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id),
  vote      TEXT        NOT NULL
                        CHECK (vote IN ('want_bid','no_bid','absent')),
  voted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);

-- ── 4. Auction Queues ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_queues (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID        NOT NULL REFERENCES auction_rounds(id),
  user_id     UUID        NOT NULL REFERENCES profiles(id),
  item_type   TEXT        NOT NULL
                          CHECK (item_type IN ('Album','Puppet','White','RedBlack')),
  status      TEXT        NOT NULL DEFAULT 'waiting'
                          CHECK (status IN ('waiting','awarded','cancelled')),
  queued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  awarded_at  TIMESTAMPTZ,
  awarded_by  UUID        REFERENCES profiles(id),
  note        TEXT,
  UNIQUE (round_id, user_id, item_type)
);

-- ── 5. Carry Credits ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carry_credits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id),
  item_type    TEXT        NOT NULL
                           CHECK (item_type IN ('Album','Puppet','White','RedBlack')),
  credit       INT         NOT NULL DEFAULT 0 CHECK (credit >= 0),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type)
);

-- ── 6. Auction History ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID        REFERENCES auction_rounds(id),
  user_id     UUID        NOT NULL REFERENCES profiles(id),
  item_type   TEXT        NOT NULL
                          CHECK (item_type IN ('Album','Puppet','White','RedBlack')),
  qty_awarded INT         NOT NULL DEFAULT 1,
  awarded_by  UUID        REFERENCES profiles(id),
  note        TEXT,
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_round_votes_round_id    ON round_votes(round_id);
CREATE INDEX IF NOT EXISTS idx_round_votes_user_id     ON round_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_queues_round    ON auction_queues(round_id);
CREATE INDEX IF NOT EXISTS idx_auction_queues_user     ON auction_queues(user_id);
CREATE INDEX IF NOT EXISTS idx_carry_credits_user      ON carry_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_rounds_status   ON auction_rounds(status);
CREATE INDEX IF NOT EXISTS idx_auction_history_user    ON auction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_discord_id     ON profiles(discord_id);

-- ── Row Level Security ───────────────────────────────────────
-- เปิด RLS ทุก table แต่ service_role bypasses ได้เสมอ
-- Web ใช้ anon key ดูข้อมูลได้ (read-only public views)
-- Bot ใช้ service_role key เขียน/อ่านได้ทั้งหมด

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_rounds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_queues  ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_credits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_history ENABLE ROW LEVEL SECURITY;

-- Allow public read for all tables (web monitoring)
CREATE POLICY "Public read profiles"        ON profiles        FOR SELECT USING (true);
CREATE POLICY "Public read rounds"          ON auction_rounds  FOR SELECT USING (true);
CREATE POLICY "Public read votes"           ON round_votes     FOR SELECT USING (true);
CREATE POLICY "Public read queues"          ON auction_queues  FOR SELECT USING (true);
CREATE POLICY "Public read credits"         ON carry_credits   FOR SELECT USING (true);
CREATE POLICY "Public read history"         ON auction_history FOR SELECT USING (true);
