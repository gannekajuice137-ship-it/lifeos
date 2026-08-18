-- Life OS Database Schema
-- Run this in Supabase SQL Editor after creating the project

-- ============================================================
-- Tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  due_date date NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  payload_enc text NOT NULL
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON tasks
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, due_date);

-- ============================================================
-- Habits
-- ============================================================
CREATE TABLE IF NOT EXISTS habits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  payload_enc text NOT NULL
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON habits
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Habit Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS habit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  log_date date NOT NULL,
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  payload_enc text,
  UNIQUE (user_id, habit_id, log_date)
);

ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON habit_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_habit ON habit_logs(user_id, habit_id);

-- ============================================================
-- GATE Topics
-- ============================================================
CREATE TABLE IF NOT EXISTS gate_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  subject text NOT NULL,
  topic_no int NOT NULL,
  stage text NOT NULL DEFAULT 'S0',
  next_review date NOT NULL DEFAULT CURRENT_DATE,
  weak boolean DEFAULT false,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
  payload_enc text NOT NULL
);

ALTER TABLE gate_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON gate_topics
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gate_topics_user ON gate_topics(user_id, subject);

-- ============================================================
-- CF Entries
-- ============================================================
CREATE TABLE IF NOT EXISTS cf_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  entry_date date NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('rating', 'problem', 'contest')),
  payload_enc text NOT NULL
);

ALTER TABLE cf_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON cf_entries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cf_entries_user ON cf_entries(user_id, entry_date);

-- ============================================================
-- Notes
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  entry_date date NOT NULL,
  payload_enc text NOT NULL,
  UNIQUE (user_id, entry_date)
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON notes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_date ON notes(user_id, entry_date);

-- ============================================================
-- Wiki Pages
-- ============================================================
CREATE TABLE IF NOT EXISTS wiki_pages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  slug text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('short-notes', 'error-book', 'general')),
  payload_enc text NOT NULL,
  UNIQUE (user_id, slug)
);

ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON wiki_pages
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_user ON wiki_pages(user_id, category);

-- ============================================================
-- People
-- ============================================================
CREATE TABLE IF NOT EXISTS people (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  last_contacted date,
  payload_enc text NOT NULL
);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON people
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_people_user ON people(user_id, last_contacted);

-- ============================================================
-- Crypto Meta
-- ============================================================
CREATE TABLE IF NOT EXISTS crypto_meta (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salt text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crypto_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON crypto_meta
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Storage Bucket (run via Supabase Dashboard)
-- ============================================================
-- Go to Storage > New Bucket:
--   Name: lifeos
--   Public: OFF (private)
--   Then add policy in Storage > Policies:
--     "owner only" - ALLOW ALL for authenticated users where bucket_id = 'lifeos'
