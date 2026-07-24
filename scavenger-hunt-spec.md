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
- [x] Camera QR scanning verified via webcam on localhost — fixed a real bug where the scanner passed the full encoded URL instead of extracting the `code` param, now correctly matches real characters
- [x] Character reveal page — `CharacterReveal.jsx` verified against real scan results (found a real bug where it fell back to hardcoded mock data whenever route state was missing; fixed)
- [x] Reward page — `Reward.jsx` verified against real progress data; now displays real `reward_description`/`reward_code` when a reward is unlocked
- [x] Character revisit flow — clicking a found character in the Progress gallery now shows real details via a new `GET /api/characters/{character_id}` endpoint (ownership-verified via device_token + Scan record, returns uniform 404 for any unowned/nonexistent/malformed lookup — no data leak)
- [x] Shareable completion card — real PNG generation via html2canvas, with native share-sheet support (mobile) and direct-download fallback (desktop), verified via Playwright in real Chromium against both paths
- [x] Full core gameplay loop confirmed working end-to-end with real data: start hunt → scan character (camera or manual entry) → reveal → progress → revisit found characters → 100% completion → real shareable reward card
- [x] Per-organization visual theming for the guest-facing app — `organizations.theme_mode` column added via direct SQL against real Supabase (`light`/`dark`, default `dark`; Cobb's set to `light`, Screamfest to `dark`), included in `GET /api/hunts/{slug}`, `GET /api/hunts`, and admin org endpoints (also fixed `GET /api/hunts/{slug}` to include `organization.slug`/`theme_secondary`, which were missing before). Frontend: `Start.jsx` stores the org's branding in `localStorage['active_org']`; a new `OrgThemeProvider` (`src/theme.jsx`) scopes `--primary-color`/`--secondary-color` overrides and a `theme-light` class to the public app-container via React context (deliberately *not* `document.documentElement`, so it can never bleed into the separately-rendered admin layout) and wraps all guest pages (Scan/Progress/CharacterReveal/Reward inherit it automatically); a new shared `Header.jsx` shows generic "Scavenger Hunt" branding with no org link on `HuntSelector`, or the active org's logo/name linking to `/start/{slug}` on hunt pages; `HuntSelector` clears `active_org` on mount so theming never leaks between hunts. Verified via Playwright against the real dev server: Cobb's renders light with its colors/logo, Screamfest renders dark with its colors/logo, HuntSelector always stays generic, header logo correctly links back to that org's entrance screen, theme survives hard reloads on Progress/Reward, and the admin panel stays untouched even immediately after visiting a themed hunt page.
- [x] Real admin authentication — `admin_users.password_hash` via passlib/bcrypt, `POST /api/admin/login` issues a 24h JWT (python-jose/pyjwt), `get_current_admin` dependency (`backend/app/auth.py`) now guards every route in `organizations.py`, the `/api/admin/*` routes in `hunts.py`, the admin router in `characters.py`, and `admin.py` (except `/login` itself); `backend/create_admin.py` added for bootstrapping the first admin user with a properly hashed password. `Admin.jsx`/`client.js` already had real (non-mock) login + token-storage + Bearer-header wiring in place — only needed the 401 detection fixed (client.js now attaches `error.status` since FastAPI's `detail` text doesn't contain the status code) so `Admin.jsx` correctly redirects to the login screen on a 401. Verified: wrong/nonexistent credentials → clean 401 (not 500), valid login → working JWT, that JWT successfully authorizes real admin actions (listing hunts/orgs), no-token and garbage-token requests are rejected with 401 on the same endpoints, and `GET /api/hunts/{slug}` plus all scan/session/progress endpoints remain fully unauthenticated as intended.
- [x] Optional per-character trivia mini-game — `characters` table gained six nullable columns via direct SQL (`trivia_question`, `trivia_option_a/b/c/d`, `trivia_correct_answer`, `trivia_description`), added via direct SQL ALTER TABLE against real Supabase (same approach as `hint`/`area`). Presence of `trivia_question` alone determines whether the feature shows for a given character — no hunt-level toggle, so hunts like Pumpkins After Dark that don't use it are unaffected. New ownership-gated `GET /api/characters/{id}/trivia` endpoint mirrors the existing revisit endpoint's device_token/Scan-ownership check and uniform 404 (leaks nothing about which characters have trivia configured). `POST`/`PATCH /api/admin/characters` accept all six fields; a computed `has_trivia` boolean is now included in the scan response, the revisit endpoint, and the progress response for found characters, so the frontend never needs an extra round-trip just to decide whether to show the button. Frontend: `CharacterManager.jsx` has an optional trivia section (question, four options, correct-answer dropdown, description); `CharacterReveal.jsx` shows a "🎓 Fun Fact" button whenever `has_trivia` is true — for both a fresh scan and a gallery revisit — and is pixel-for-pixel unchanged when it's false; new `TriviaQuestion.jsx` (`/trivia/:characterId`) shows the question/options, reveals right/wrong plus the `trivia_description` fact regardless of correctness, then continues back to the reveal page. Verified end-to-end via Playwright against the real dev server and real Supabase data: set trivia on Cobb the Kangaroo (real Cobb's hunt) through the actual admin panel, left Sleepy the Sloth as a no-trivia control, confirmed the Fun Fact button appears only for the former (on both first-scan and gallery-revisit paths) and is completely absent for the latter, confirmed both a correct and an incorrect answer show the same description afterward, then cleaned up the test session/scans.
- [x] Short, human-friendly `qr_code_value` format — replaced the 36-char UUID with a 12-character code from a visually-safe alphabet (uppercase, excludes 0/O/1/I/L), formatted `XXXX-XXXX-XXXX` (e.g. `K7XQ-2M9P-T4RN`); generation/uniqueness-retry/normalization logic centralized in `backend/app/qr_codes.py` and shared by `characters.py` (creation) and the new one-time `backend/regenerate_qr_codes.py` script. `Character.id` (UUID PK) is untouched — only `qr_code_value` and the QR PNG filename changed. QR images now encode the shorter code (smaller/less dense pattern as a side effect). `POST /api/scans` normalizes submitted codes (uppercase, strips dashes/whitespace) before comparing, so `"k7xq2m9p t4rn"`, `"K7XQ-2M9P-T4RN"`, etc. all match; canonical dashed form is what's stored/displayed. Verified end-to-end against the real Supabase data: ran the regeneration script against all 4 real characters (old UUID codes/images fully replaced, re-run is a no-op/idempotent), created a real test character via the API and confirmed its code format, confirmed a real scan matched across 5 casing/spacing variations of the same code, confirmed the admin character list correctly displays/links the regenerated QR images, then cleaned up the test character/session.
- [x] QR code batch printing (printable PDF) — new `GET /api/admin/hunts/{hunt_id}/print-qr-codes`, org-scoped like the existing hunt endpoints (404 for a hunt outside a scoped admin's org). PDF generated with `reportlab` (`backend/app/pdf_generation.py`), fetching each character's existing `qr_code_image_url` from Supabase Storage rather than regenerating it. Two sections in one document: "Guest Signs" (2×3-per-page grid, QR image + plain numeric index only — no name/hint/spoiler content — with dashed cut lines, since these pages get printed/cut/posted where guests will see them before scanning) and a "STAFF USE ONLY — DO NOT POST" reference sheet (index → name/hint/area table, hint text word-wrapped rather than truncated so staff have everything they need to place each sign correctly). Frontend: `HuntManager.jsx` has a per-hunt "Print QR Codes" button; `client.js` got a `printQrCodes()` that bypasses the shared JSON `request()` helper (fetches a Blob) and triggers a real browser download. Verified against real Supabase data: generated for Cobb's Summer Hunt (3 characters, mixed hint/area coverage) and Collect-a-Boo (10 characters, spans two guest-sign pages) — confirmed via extracted PDF text and rendered page images that guest pages contain zero identifying text beyond the number, the staff sheet correctly maps every index to the right name/hint/area with full untruncated hint text, a minted JWT for the Cobb's-scoped admin can print Cobb's own hunt but gets a real 404 on Screamfest's hunt, and an unauthenticated request gets 401.

**Not yet started:**
- [ ] Verify camera QR scanning works on an actual phone in the field (blocked until deployment — mobile browsers require HTTPS for camera access, and localhost's secure-context exception doesn't extend to other devices hitting your laptop's local IP)
- [ ] Admin character CRUD UI (real forms, not just raw API calls via Swagger)
- [ ] Fix `POST /api/admin/reward-tiers` — now behind admin auth, but still a stub that echoes the payload without writing to the database; no real way to configure reward tiers through the normal admin flow yet
- [ ] Enhance shareable completion card with per-property marketing branding (logo, website URL, contact info) — card currently works but is generic; since it's meant to double as informal marketing for whichever property the hunt belongs to (Cobb's, Screamfest, etc.), it should pull from each Organization's existing logo_url/theme fields rather than being hardcoded
- [ ] Physical print-test on-site
- [ ] UI restructuring pass
- [ ] Deployment (hosting beyond localhost)
- [ ] End-to-end live test with a real hunt

**Known follow-ups / cleanup items:**
- `qr_codes/` folder generated at project root instead of inside `backend/` — functional, cosmetic fix optional
- Admin routes now require a valid JWT; scan/session/progress routes remain intentionally open (guest-facing, protected by `device_token` instead) — no change needed there
- `JWT_SECRET_KEY` isn't in `.env` yet — `backend/app/auth.py` falls back to an insecure dev default so the app doesn't crash, but a real random secret must be added to `.env` (`JWT_SECRET_KEY=...`) before deployment
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