-- PetLab schema v1
-- D1 / SQLite

CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at   INTEGER NOT NULL
);

-- email OTP challenges (short-lived, one-time)
CREATE TABLE auth_otps (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,    -- sha256(code) hex
  expires_at INTEGER NOT NULL, -- unix seconds
  attempts   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  species    TEXT NOT NULL,
  breed      TEXT,
  birth_date TEXT,
  notes      TEXT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX idx_pets_user ON pets(user_id);

CREATE TABLE reports (
  id            TEXT PRIMARY KEY,
  pet_id        TEXT NOT NULL REFERENCES pets(id),
  test_date     TEXT,                 -- ISO 8601, OCR-extracted
  hospital      TEXT,
  machine       TEXT,
  panel         TEXT,
  image_r2_key  TEXT NOT NULL,
  raw_ocr_json  TEXT,                 -- full Claude Vision response
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);
CREATE INDEX idx_reports_pet_date ON reports(pet_id, test_date DESC);

CREATE TABLE report_values (
  id            TEXT PRIMARY KEY,
  report_id     TEXT NOT NULL REFERENCES reports(id),
  name          TEXT NOT NULL,        -- "HCT", "WBC", ...
  value         REAL,
  unit          TEXT,
  ref_low       REAL,
  ref_high      REAL,
  flag          TEXT,                 -- 'LOW' | 'HIGH' | NULL
  display_order INTEGER
);
CREATE INDEX idx_values_report ON report_values(report_id);
CREATE INDEX idx_values_name ON report_values(name);

CREATE TABLE share_tokens (
  token            TEXT PRIMARY KEY,
  pet_id           TEXT NOT NULL REFERENCES pets(id),
  scope            TEXT NOT NULL,     -- 'all' | 'latest' | 'recent_3' | 'specific'
  report_ids_json  TEXT,              -- JSON array, only when scope='specific'
  created_at       INTEGER NOT NULL,
  last_accessed_at INTEGER,
  access_count     INTEGER NOT NULL DEFAULT 0,
  revoked_at       INTEGER
);
CREATE INDEX idx_share_pet ON share_tokens(pet_id);
