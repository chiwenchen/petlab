import { env } from "cloudflare:test";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_otps (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pets (
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

CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  pet_id        TEXT NOT NULL REFERENCES pets(id),
  test_date     TEXT,
  hospital      TEXT,
  machine       TEXT,
  panel         TEXT,
  image_r2_key  TEXT NOT NULL,
  raw_ocr_json  TEXT,
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);

CREATE TABLE IF NOT EXISTS report_values (
  id            TEXT PRIMARY KEY,
  report_id     TEXT NOT NULL REFERENCES reports(id),
  name          TEXT NOT NULL,
  value         REAL,
  unit          TEXT,
  ref_low       REAL,
  ref_high      REAL,
  flag          TEXT,
  display_order INTEGER
);

CREATE TABLE IF NOT EXISTS share_tokens (
  token            TEXT PRIMARY KEY,
  pet_id           TEXT NOT NULL REFERENCES pets(id),
  scope            TEXT NOT NULL,
  report_ids_json  TEXT,
  created_at       INTEGER NOT NULL,
  last_accessed_at INTEGER,
  access_count     INTEGER NOT NULL DEFAULT 0,
  revoked_at       INTEGER
);
`;

beforeAll(async () => {
  const statements = SCHEMA
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
});
