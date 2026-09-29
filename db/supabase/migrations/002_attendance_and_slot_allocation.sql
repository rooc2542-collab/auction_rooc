-- Remove uid_game and add job_class to profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS uid_game;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_class TEXT
  CHECK (job_class IN (
    'Lord Knight','Paladin','Biochemist','Mastersmith','Bard',
    'Gypsy','Sniper','Champion','Priest','Assassin','Rogue',
    'Wizard','Sage','Summoner','Rebellion'
  ));

-- Event attendance table
CREATE TABLE IF NOT EXISTS event_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name      TEXT NOT NULL,
  event_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  message_id      TEXT,
  channel_id      TEXT,
  discord_id      TEXT NOT NULL,
  user_id         UUID REFERENCES profiles(id),
  status          TEXT NOT NULL CHECK (status IN ('want_bid','no_bid','absent')),
  interested_items TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_name, event_date, discord_id)
);

-- Event sessions (admin input: item quantities/page coords)
CREATE TABLE IF NOT EXISTS event_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name      TEXT NOT NULL,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  item_type       TEXT NOT NULL CHECK (item_type IN ('Album','Puppet','White','RedBlack')),
  start_page      INT NOT NULL DEFAULT 1,
  start_slot      INT NOT NULL DEFAULT 1 CHECK (start_slot BETWEEN 1 AND 4),
  end_page        INT NOT NULL DEFAULT 1,
  end_slot        INT NOT NULL DEFAULT 4 CHECK (end_slot BETWEEN 1 AND 4),
  total_quantity  INT NOT NULL DEFAULT 0,
  personal_limit  INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_name, session_date, item_type)
);

-- Allocated slots (result of allocation engine)
CREATE TABLE IF NOT EXISTS allocated_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name      TEXT NOT NULL,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id         UUID REFERENCES profiles(id),
  item_type       TEXT NOT NULL,
  page_number     INT NOT NULL,
  slot_number     INT NOT NULL CHECK (slot_number BETWEEN 1 AND 4),
  total_pages     INT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'allocated' CHECK (status IN ('allocated','awarded','skipped')),
  allocated_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS (Idempotent with DROP POLICY IF EXISTS)
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read attendance" ON event_attendance;
CREATE POLICY "public read attendance" ON event_attendance FOR SELECT USING (true);
DROP POLICY IF EXISTS "service write attendance" ON event_attendance;
CREATE POLICY "service write attendance" ON event_attendance FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read sessions" ON event_sessions;
CREATE POLICY "public read sessions" ON event_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "service write sessions" ON event_sessions;
CREATE POLICY "service write sessions" ON event_sessions FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE allocated_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read slots" ON allocated_slots;
CREATE POLICY "public read slots" ON allocated_slots FOR SELECT USING (true);
DROP POLICY IF EXISTS "service write slots" ON allocated_slots;
CREATE POLICY "service write slots" ON allocated_slots FOR ALL USING (auth.role() = 'service_role');
