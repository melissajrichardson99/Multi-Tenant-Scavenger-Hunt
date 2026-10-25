-- Scavenger Hunt database schema (PostgreSQL 13+; gen_random_uuid() is built in).
--
-- Apply with either:
--   psql "$DATABASE_URL" -f backend/schema.sql
--   python scripts/init_db.py          (runs this file when DATABASE_URL is Postgres)
--
-- Idempotent: every statement uses IF NOT EXISTS, so re-running is safe.
-- Matches the SQLAlchemy models in backend/app/models.py, including the
-- columns that were added after the first release (organizations.theme_mode,
-- characters.hint/area/trivia_*/is_secret, admin_users.is_active).
--
-- Row Level Security is intentionally left off: only the FastAPI backend
-- connects to the database, and it is the access-control layer.

-- Organizations: one row per property (tenant), e.g. Cobb's Adventure Park.
CREATE TABLE IF NOT EXISTS organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,            -- used in guest URLs: /start/{slug}
    theme_primary   TEXT DEFAULT '#000000',
    theme_secondary TEXT DEFAULT '#ffffff',
    theme_mode      TEXT NOT NULL DEFAULT 'dark'
                    CONSTRAINT ck_organizations_theme_mode CHECK (theme_mode IN ('light', 'dark')),
    logo_url        TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Hunts: a campaign belonging to one organization.
CREATE TABLE IF NOT EXISTS hunts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN DEFAULT true,             -- inactive hunts are hidden and can't be started
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Characters: what guests find and scan. Tenant = the hunt's organization.
CREATE TABLE IF NOT EXISTS characters (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id               UUID NOT NULL REFERENCES hunts (id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    description           TEXT,                       -- shown on the reveal screen
    image_url             TEXT,
    points                INTEGER DEFAULT 10,
    qr_code_value         TEXT NOT NULL UNIQUE,       -- printed code, e.g. K7XQ-2M9P-T4RN
    sort_order            INTEGER DEFAULT 0,
    hint                  TEXT,                       -- shown on locked cards
    area                  TEXT,                       -- groups locked cards by park area
    trivia_question       TEXT,                       -- non-null turns trivia on for this character
    trivia_option_a       TEXT,
    trivia_option_b       TEXT,
    trivia_option_c       TEXT,                       -- c/d optional: 2-4 option questions
    trivia_option_d       TEXT,
    trivia_correct_answer TEXT,                       -- 'a' | 'b' | 'c' | 'd'
    trivia_description    TEXT,                       -- fun fact revealed after answering
    is_secret             BOOLEAN NOT NULL DEFAULT false, -- bonus: never counts toward completion
    created_at            TIMESTAMPTZ DEFAULT now()
);

-- Sessions: anonymous guest progress, no login. The device_token lives in the
-- guest's localStorage and is passed explicitly on each request.
CREATE TABLE IF NOT EXISTS sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id        UUID NOT NULL REFERENCES hunts (id) ON DELETE CASCADE,
    device_token   TEXT NOT NULL UNIQUE,
    display_name   TEXT,                              -- reserved for an opt-in leaderboard
    created_at     TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ DEFAULT now()
);

-- Scans: the core gameplay event. One row per (session, character).
CREATE TABLE IF NOT EXISTS scans (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
    scanned_at   TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_session_character UNIQUE (session_id, character_id)
);

-- Reward tiers: optional rewards returned by POST /api/scans when a session
-- completes a hunt (100% or the full count). There is no admin UI for these
-- yet; v1 uses the shareable completion card instead.
CREATE TABLE IF NOT EXISTS reward_tiers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id            UUID NOT NULL REFERENCES hunts (id) ON DELETE CASCADE,
    threshold_type     TEXT NOT NULL
                       CONSTRAINT ck_threshold_type CHECK (threshold_type IN ('count', 'percentage')),
    threshold_value    INTEGER NOT NULL,
    reward_description TEXT NOT NULL,
    reward_code        TEXT,
    created_at         TIMESTAMPTZ DEFAULT now()
);

-- Admin users: staff accounts. organization_id NULL = super-admin (all orgs).
CREATE TABLE IF NOT EXISTS admin_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations (id),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,                    -- bcrypt, never plaintext
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_hunts_organization_id ON hunts (organization_id);
CREATE INDEX IF NOT EXISTS ix_characters_hunt_id ON characters (hunt_id);
CREATE INDEX IF NOT EXISTS ix_sessions_hunt_id ON sessions (hunt_id);
CREATE INDEX IF NOT EXISTS ix_scans_character_id ON scans (character_id);
CREATE INDEX IF NOT EXISTS ix_admin_users_organization_id ON admin_users (organization_id);

-- ---------------------------------------------------------------------------
-- File storage buckets
--
-- Two public-read buckets hold uploaded files:
--   character-images   admin-uploaded character artwork
--   qr-codes           generated QR PNGs, named {qr_code_value}.png
--
-- Local development needs nothing here: without SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY the backend writes to uploads/<bucket>/ on disk.
-- On Supabase, create both buckets once (Storage UI, or this SQL in the
-- Supabase SQL editor; the storage schema only exists on Supabase):
--
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('character-images', 'character-images', true),
--          ('qr-codes', 'qr-codes', true)
--   ON CONFLICT (id) DO NOTHING;
-- ---------------------------------------------------------------------------
