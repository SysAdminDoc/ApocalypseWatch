CREATE TABLE IF NOT EXISTS level_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transitioned_at TEXT NOT NULL,
  from_level INTEGER NOT NULL,
  to_level INTEGER NOT NULL,
  sigma_shift REAL,
  concurrent_count INTEGER,
  expected_count REAL
);

CREATE INDEX IF NOT EXISTS idx_level_transitions_at
  ON level_transitions (transitioned_at);
