# Scavenger Hunt App — Build Spec

## Development Progress

**Done and verified:**
- [x] Repo, Git, Supabase project, schema, storage bucket all set up
- [x] Skeleton scaffolding — FastAPI backend + React/Vite frontend, both running locally
- [x] Real Postgres connection confirmed (not SQLite fallback)
- [x] Session creation (`POST /api/sessions`) — real DB writes, verified via Swagger AND in-browser
- [x] Session lookup (`GET /api/sessions/{device_token}`) — verified via Swagger
- [x] Character creation + QR code generation (`POST /api/admin/characters`) — verified, real `.png` files generated and served
- [x] `PlayerSession` model naming (avoids SQLAlchemy `Session` collision)
- [x] `Home.jsx` wired to create/resume sessions via localStorage (not cookies) — verified in-browser
- [x] Seed script (`backend/seed_db.py`) for test Organization + Hunt
- [x] Admin `hunts.py` endpoints wired to real DB (list, create, update, stats)
- [x] Real scan validation (`POST /api/scans`) — invalid code, duplicate scan, and reward-unlock logic all verified
- [x] `Scan.jsx` wired to real camera QR reading (html5-qrcode) AND a permanent "Enter Code Manually" fallback for on-site reliability — both paths call the real endpoint
- [x] Real progress tracking (`GET /api/progress/{device_token}`) — verified for 0%, partial, and 100% found states; unfound characters correctly masked ("???", no image) to avoid spoiling the hunt
- [x] Confirmed a real end-to-end scan (Grim the Gatekeeper) recorded correctly in production Supabase data
- [x] Switched primary dev tool from Antigravity to Claude Code (VS Code extension)
- [x] `CLAUDE.md` created for persistent project context
- [x] Fixed camera scanner bug where `Scan.jsx` sent the full decoded QR URL (`http://localhost:3000/scan?code=...`) instead of the bare `qr_code_value` to `POST /api/scans`, causing real QR codes to fail with `invalid_code`; now extracts the `code` query param (with a fallback to the raw decoded text if it isn't a valid URL) — verified by decoding a real generated QR PNG and confirming the extracted code matched that character's `qr_code_value` in the DB
- [x] Verify camera QR scanning works via webcam on localhost — confirmed live in-browser after the parsing fix above

**Not yet started:**
- [ ] Verify camera QR scanning works on an actual phone in the field (blocked until deployment — mobile browsers require HTTPS for camera access, and localhost's secure-context exception doesn't extend to other devices hitting your laptop's local IP)
- [ ] Character reveal page — confirm `CharacterReveal.jsx` renders real scan results (likely close to working already, given `Scan.jsx` navigates to it with real data, but not explicitly re-verified since progress.py went live)
- [ ] Reward page — confirm `Reward.jsx` correctly displays a real unlocked reward (description/code) once `newly_unlocked_rewards` fires; currently only reads total_found/total_characters, share button is still a mock alert() (acceptable for v1 per spec, no discount codes)
- [ ] Admin character CRUD UI (real forms, not just raw API calls via Swagger)
- [ ] Admin login/auth made real (currently stubbed) — also needs to cover the auth gap on admin/scan/session/progress endpoints noted along the way
- [ ] QR code batch printing (printable sheet/PDF)
- [ ] Physical print-test on-site
- [ ] UI restructuring pass
- [ ] Deployment (hosting beyond localhost)
- [ ] End-to-end live test with a real hunt

**Known follow-ups / cleanup items:**
- `qr_codes/` folder generated at project root instead of inside `backend/` — functional, cosmetic fix optional
- No auth on admin routes (`hunts.py`, `characters.py`) or scan/session/progress routes — acceptable for local dev, must be addressed before deployment
- `backend/test.py` previously had a real Supabase password committed; current version is redacted, but the old password remains recoverable in Git history (low risk given private repo + since-rotated password, but not fully scrubbed)
- Database password has been rotated twice now (once after Antigravity exposure, once after the test.py exposure) — always confirm before committing that no file outside `.env` contains the real password

## 1. Database Schema (Postgres, via Supabase)

```sql
-- Organizations: Cobb's, Screamfest, future properties
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,        -- used in URLs, e.g. /cobbs
    theme_primary   TEXT DEFAULT '#000000',
    theme_secondary TEXT DEFAULT '#ffffff',
    logo_url        TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Hunts: a specific campaign belonging to an organization
CREATE TABLE hunts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    description           TEXT,
    is_active             BOOLEAN DEFAULT true,
    start_date            TIMESTAMPTZ,
    end_date              TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT now()
);

-- Characters: what players scan/find
CREATE TABLE characters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id         UUID REFERENCES hunts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,               -- shown on the reveal screen
    image_url       TEXT,
    points          INT DEFAULT 10,
    qr_code_value   TEXT UNIQUE NOT NULL,  -- the value encoded in the printed QR code
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Sessions: anonymous player progress, no login required
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id         UUID REFERENCES hunts(id) ON DELETE CASCADE,
    device_token    TEXT UNIQUE NOT NULL,  -- stored in a cookie on the client
    display_name    TEXT,                  -- optional, only if they opt into a leaderboard
    created_at      TIMESTAMPTZ DEFAULT now(),
    last_active_at  TIMESTAMPTZ DEFAULT now()
);

-- Scans: the core gameplay event
CREATE TABLE scans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    character_id    UUID REFERENCES characters(id) ON DELETE CASCADE,
    scanned_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, character_id)   -- prevents double-counting the same character
);

-- Reward tiers: what a player unlocks at a given progress point
CREATE TABLE reward_tiers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id            UUID REFERENCES hunts(id) ON DELETE CASCADE,
    threshold_type     TEXT CHECK (threshold_type IN ('count', 'percentage')) NOT NULL,
    threshold_value    INT NOT NULL,     -- e.g. 5 characters, or 100 (%)
    reward_description TEXT NOT NULL,    -- shown to the player
    reward_code        TEXT,             -- e.g. a discount code, nullable
    created_at         TIMESTAMPTZ DEFAULT now()
);

-- Admin users: staff who manage hunts/characters
CREATE TABLE admin_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),  -- null = super admin, all orgs
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

**Notes on design choices:**
- No `users` table for players — sessions are anonymous by default (`device_token` cookie), which removes login friction entirely. `display_name` is optional and only needed if a player wants to appear on a leaderboard.
- `qr_code_value` is separate from `id` so you can regenerate/reprint codes without breaking the underlying character record.
- `reward_tiers` supports multiple tiers per hunt (e.g. 50% reward + 100% reward), not just a single completion reward.

---

## 2. API Contract (FastAPI)

### Public / gameplay endpoints

**`GET /api/hunts/{slug}`**
Returns public hunt info for the landing screen.
```json
// Response
{
  "hunt_id": "uuid",
  "name": "Cobb's Summer Hunt 2026",
  "organization": { "name": "Cobb's Adventure Park", "theme_primary": "#...", "logo_url": "..." },
  "total_characters": 10,
  "is_active": true
}
```

**`POST /api/sessions`**
Creates a new anonymous session for a hunt.
```json
// Request
{ "hunt_id": "uuid" }

// Response
{ "session_id": "uuid", "device_token": "opaque-string-set-as-cookie" }
```

**`GET /api/sessions/{device_token}`**
Resumes an existing session's progress.
```json
// Response
{
  "session_id": "uuid",
  "total_found": 4,
  "total_characters": 10,
  "found_character_ids": ["uuid", "uuid", ...]
}
```

**`POST /api/scans`**
The core gameplay action — called when a QR code is successfully read.
```json
// Request
{ "device_token": "...", "qr_code_value": "scanned-value" }

// Response (success)
{
  "success": true,
  "character": { "id": "uuid", "name": "...", "description": "...", "image_url": "...", "points": 10 },
  "total_found": 5,
  "total_characters": 10,
  "newly_unlocked_rewards": [
    { "reward_description": "10% off gift shop", "reward_code": "HUNT10" }
  ]
}

// Response (invalid or already-scanned code)
{ "success": false, "reason": "already_scanned" | "invalid_code" }
```

**`GET /api/progress/{device_token}`**
Full progress detail for the gallery/progress screen.
```json
{
  "total_found": 5,
  "total_characters": 10,
  "characters": [
    { "id": "uuid", "name": "...", "found": true, "image_url": "..." },
    { "id": "uuid", "name": "???", "found": false, "image_url": null }
  ]
}
```

### Admin endpoints (auth required)

- `POST /api/admin/login` → issues an auth token
- `GET|POST /api/admin/organizations`
- `GET|POST|PATCH /api/admin/hunts`
- `GET|POST|PATCH|DELETE /api/admin/characters` — includes image upload and QR code generation on create
- `POST /api/admin/reward-tiers`
- `GET /api/admin/hunts/{id}/stats` → scan counts per character, completion rate, most/least found

```json
// GET /api/admin/hunts/{id}/stats response
{
  "total_sessions": 342,
  "completion_rate": 0.28,
  "character_stats": [
    { "name": "...", "scan_count": 310 },
    { "name": "...", "scan_count": 88 }
  ]
}
```

---

## 3. One-Pager for Mark / Mike (to confirm before scaffolding)

**Project:** Generic scavenger hunt app, launching with Cobb's Adventure Park, designed from the start to be reused by Screamfest and other properties.

**How it works (v1):** Guests scan a "Start Hunt" QR code, then find and scan QR codes placed at physical character locations around the park. Each scan reveals a character description. Progress is tracked automatically, no login required.

**Confirmed decisions for v1:**
1. **Reward mechanic:** a shareable completion card, generated at 100% hunt completion. Kept simple for v1 — no discount codes, redemption tracking, or prize draw logic yet. (Doubles as informal marketing when guests share it.)
2. **First hunt size:** 5–10 characters. The character model is generic — characters can be added or removed for any hunt without code changes, so this range isn't a hard limit going forward.
3. **Reward tiers:** single tier (100% completion only) for v1. Partial-progress rewards deferred to a future version.
4. **Timeline:** as soon as practical, balanced against other job responsibilities (phone support, bookings, Google review outreach). No hard external deadline — pace is builder-driven, not event-driven, for v1.
5. **Multi-property design:** even though only Cobb's launches first, the schema and app are being built multi-tenant from day one so Screamfest and future properties can be added by creating new records, not by rebuilding the app.

**Open considerations flagged for follow-up (not blocking v1 start, but worth deciding before wider rollout):**
- **Wi-Fi coverage** — the app shouldn't fully depend on guests' own cell signal working reliably throughout the park. Worth evaluating on-site connectivity and considering an offline-tolerant scanning approach (queue scans locally, sync when back online) if dead zones are common.
- **Hosting costs at scale** — free-tier hosting (Vercel/Supabase) works for a single small hunt; costs and limits should be revisited if usage grows or more properties come on board.
- **Ongoing maintenance** — both of the app itself and the physical QR codes (weather damage, fading, guests removing them). Needs an owner identified for the long term, especially given this developer's role at Cobb's is a short-term bridge position.

**What's explicitly out of scope for v1:** computer vision character recognition (QR only for now), native mobile app (web-based instead), user accounts/login (anonymous sessions only), discount codes or prize-draw logistics, multi-tier rewards.
