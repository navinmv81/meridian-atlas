-- Bootstrap progress tracking (keyed by series_id, one row per fund series)
CREATE TABLE IF NOT EXISTS edgar_bootstrap_progress (
  series_id        TEXT PRIMARY KEY,
  cik              TEXT,
  ticker           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  net_assets       REAL,
  error_msg        TEXT,
  processed_at     TEXT
);

-- Bootstrap run state (key-value)
CREATE TABLE IF NOT EXISTS edgar_bootstrap_state (
  key              TEXT PRIMARY KEY,
  value            TEXT NOT NULL,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed initial state rows
INSERT OR IGNORE INTO edgar_bootstrap_state (key, value) VALUES
  ('status',                  'not_started'),
  ('cik_offset',              '0'),
  ('total_ciks_discovered',   '0'),
  ('etfs_added',              '0'),
  ('last_run',                ''),
  ('ticker_map_cache',        '');
