CREATE TABLE IF NOT EXISTS question_stats (
  source_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  question_order INTEGER,
  category TEXT,
  knowledge_point TEXT,
  question_text TEXT,
  answer TEXT,
  answer_text TEXT,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  bookmark_count INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  PRIMARY KEY (source_id, mode)
);

CREATE TABLE IF NOT EXISTS option_stats (
  source_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  option_key TEXT NOT NULL,
  option_text TEXT,
  chosen_count INTEGER NOT NULL DEFAULT 0,
  wrong_chosen_count INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT NOT NULL,
  PRIMARY KEY (source_id, mode, option_key)
);

CREATE TABLE IF NOT EXISTS answer_events (
  session_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  selected TEXT NOT NULL,
  selected_text TEXT,
  answer TEXT NOT NULL,
  answer_text TEXT,
  correct INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL,
  PRIMARY KEY (session_id, source_id, mode)
);

CREATE TABLE IF NOT EXISTS bookmark_events (
  session_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, source_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_question_stats_wrong
  ON question_stats (mode, wrong_count DESC, total_attempts DESC);

CREATE INDEX IF NOT EXISTS idx_question_stats_bookmark
  ON question_stats (mode, bookmark_count DESC);

CREATE INDEX IF NOT EXISTS idx_question_stats_category
  ON question_stats (mode, category);
