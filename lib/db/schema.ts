// Wishwell schema (SQLite). Kept as a TypeScript module so it travels with the
// server bundle rather than depending on a file path at runtime.
export const SCHEMA = `
-- Wishwell schema. SQLite. Timestamps are unix epoch milliseconds (INTEGER).
--
-- No PRAGMAs here. journal_mode and busy_timeout describe how a local file is
-- opened, which is lib/db's business, and Turso refuses the statement outright:
-- "SQL not allowed statement: PRAGMA journal_mode = WAL". This string has to be
-- the schema and nothing else, because both places have to accept all of it.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,                       -- null when the account is OAuth-only
  oauth_provider TEXT,
  oauth_subject  TEXT,
  created_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_oauth_idx
  ON users (oauth_provider, oauth_subject)
  WHERE oauth_provider IS NOT NULL;

CREATE TABLE IF NOT EXISTS profiles (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  bio          TEXT,
  avatar_url   TEXT,
  accent       TEXT NOT NULL DEFAULT 'madder',
  location     TEXT,
  links        TEXT NOT NULL DEFAULT '[]',  -- JSON [{label,url}]
  visibility   TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  discoverable INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id                  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Gifting
  surprise_mode            INTEGER NOT NULL DEFAULT 1,
  allow_guest_reservations INTEGER NOT NULL DEFAULT 1,
  reservations_expire      INTEGER NOT NULL DEFAULT 1,
  reservation_days         INTEGER NOT NULL DEFAULT 7,
  -- Defaults
  default_visibility       TEXT NOT NULL DEFAULT 'link' CHECK (default_visibility IN ('public','link','private')),
  -- Notifications
  email_notifications      INTEGER NOT NULL DEFAULT 1,
  app_notifications        INTEGER NOT NULL DEFAULT 1,
  notify_gift_activity     INTEGER NOT NULL DEFAULT 1,
  notify_reservation_reminders INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- A guest who reserved something without making an account. Identified by a cookie token.
CREATE TABLE IF NOT EXISTS guests (
  token      TEXT PRIMARY KEY,
  name       TEXT,
  email      TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wishlists (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,                          -- emoji
  cover_url   TEXT,
  accent      TEXT NOT NULL DEFAULT 'madder',
  occasion    TEXT,                          -- birthday | holiday | graduation | wedding | none
  event_date  INTEGER,
  visibility  TEXT NOT NULL DEFAULT 'link' CHECK (visibility IN ('public','link','private')),
  share_token TEXT NOT NULL,
  archived_at INTEGER,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS wishlists_owner_slug_idx ON wishlists (user_id, slug);
CREATE INDEX IF NOT EXISTS wishlists_share_token_idx ON wishlists (share_token);

CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,
  wishlist_id  TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  url          TEXT,
  store        TEXT,
  price_cents  INTEGER,
  currency     TEXT NOT NULL DEFAULT 'USD',
  description  TEXT,
  why_want     TEXT,
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('someday','medium','high','dream')),
  category     TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  notes        TEXT,
  size         TEXT,
  color        TEXT,
  variant      TEXT,
  feature      INTEGER NOT NULL DEFAULT 0,   -- owner pinned this as an editorial feature
  position     INTEGER NOT NULL DEFAULT 0,
  archived_at  INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS items_wishlist_idx ON items (wishlist_id, position);

CREATE TABLE IF NOT EXISTS item_media (
  id         TEXT PRIMARY KEY,
  item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('image','video')),
  url        TEXT NOT NULL,
  poster_url TEXT,
  alt        TEXT,
  caption    TEXT,
  width      INTEGER,
  height     INTEGER,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS item_media_item_idx ON item_media (item_id, position);

CREATE TABLE IF NOT EXISTS reservations (
  id             TEXT PRIMARY KEY,
  item_id        TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  buyer_user_id  TEXT REFERENCES users(id) ON DELETE CASCADE,
  guest_token    TEXT REFERENCES guests(token) ON DELETE CASCADE,
  guest_name     TEXT,
  status         TEXT NOT NULL CHECK (status IN ('reserved','purchased','released','expired')),
  note           TEXT,
  reserved_at    INTEGER NOT NULL,
  expires_at     INTEGER,
  purchased_at   INTEGER,
  released_at    INTEGER,
  reminded_at    INTEGER,
  CHECK (buyer_user_id IS NOT NULL OR guest_token IS NOT NULL)
);

-- The heart of the promise: at most one live claim per item, enforced by the database
-- rather than by application logic, so two simultaneous reservations cannot both win.
CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_item
  ON reservations (item_id)
  WHERE status IN ('reserved','purchased');

CREATE INDEX IF NOT EXISTS reservations_buyer_idx ON reservations (buyer_user_id, status);
CREATE INDEX IF NOT EXISTS reservations_guest_idx ON reservations (guest_token, status);
CREATE INDEX IF NOT EXISTS reservations_expiry_idx ON reservations (status, expires_at);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience    TEXT NOT NULL CHECK (audience IN ('owner','buyer')),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  href        TEXT,
  read_at     INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- Coarse, non-spoiling analytics. Deliberately stores no item id for gift events.
CREATE TABLE IF NOT EXISTS wishlist_events (
  id          TEXT PRIMARY KEY,
  wishlist_id TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('view','share','gift_activity')),
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wishlist_events_idx ON wishlist_events (wishlist_id, kind, created_at DESC);
`;
