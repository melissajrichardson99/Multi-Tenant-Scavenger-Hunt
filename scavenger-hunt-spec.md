# Scavenger Hunt App — Technical Spec

A multi-tenant QR-code scavenger hunt web app. It launched with Cobb's
Adventure Park and is designed so other properties can be added as data
(new organization, hunt and character rows), not as code changes.

## Development Progress

**Done:**
- [x] FastAPI backend + React/Vite frontend, Postgres schema (`backend/schema.sql`) with a SQLite development path
- [x] Anonymous guest sessions (`POST /api/sessions`, `GET /api/sessions/{device_token}`); `device_token` kept in localStorage, not cookies; sessions can't be started on inactive hunts
- [x] Scanning (`POST /api/scans`) via camera (html5-qrcode) or manual code entry; codes are normalized (case, dashes, spaces) before matching
- [x] Progress gallery (`GET /api/progress/{device_token}`) with unfound characters masked ("???", hint/area only)
- [x] Character reveal, and revisiting found characters from the gallery (ownership-checked via `device_token` + scan record)
- [x] Shareable completion card at 100% (html2canvas PNG, native share sheet on mobile, download fallback on desktop)
- [x] Per-organization theming (primary/secondary colors, light/dark mode, logo) scoped to the guest app only
- [x] Admin authentication (bcrypt password hashes, 24h JWT) on every `/api/admin/*` route except login
- [x] Admin UI for organizations, hunts, characters (image upload, QR generation), admin accounts and password change
- [x] Organization-scoped admin access on every admin route, with a pytest suite proving isolation
- [x] Optional per-character trivia (2–4 options); the correct answer is only revealed after the guest answers
- [x] Short human-friendly QR codes (`XXXX-XXXX-XXXX`, ambiguous characters excluded)
- [x] Printable QR sign PDF per hunt: guest signs with index numbers only, plus a staff reference sheet
- [x] Secret/bonus characters that never count toward completion
- [x] Configuration fails fast on missing secrets; CORS origins and the QR base URL come from settings

**Not yet started:**
- [ ] Field test of camera scanning on real phones (needs an HTTPS deployment; mobile browsers only allow camera access in a secure context)
- [ ] Admin UI and API for reward tiers (the table and the unlock check in `POST /api/scans` exist; v1 uses the completion card instead)
- [ ] Richer marketing branding on the completion card (website URL, contact info)
- [ ] Physical print test of the QR signs on site
- [ ] Deployment
- [ ] End-to-end live test with a real hunt

## 1. Architecture

```
Browser (React + Vite SPA)
   │  /api/*  (JSON; admin routes use a Bearer JWT, guest routes a device_token)
   ▼
FastAPI backend ── SQLAlchemy ──► Postgres (SQLite for local development)
   │
   └── file storage ──► Supabase Storage buckets, or local disk in development
```

- The backend is the only component with database credentials. Row Level
  Security is intentionally off; the API layer is the access-control point.
- Configuration lives in `backend/app/config.py` and is read from environment
  variables (or a `.env` file in development). See `.env.example`.
- Files (character images, QR PNGs) go to two public-read buckets,
  `character-images` and `qr-codes`. Without Supabase settings the backend
  writes them to `uploads/<bucket>/` and serves them at `/uploads/...`.

## 2. Data model

The full DDL is in [`backend/schema.sql`](backend/schema.sql); the
SQLAlchemy models in `backend/app/models.py` mirror it.

| Table | Purpose | Tenant link |
|---|---|---|
| `organizations` | A property (tenant): name, URL slug, theme colors, light/dark mode, logo | — |
| `hunts` | A campaign; `is_active` controls visibility and whether sessions can start | `organization_id` |
| `characters` | What guests find: description, image, points, `qr_code_value`, hint/area, optional trivia, `is_secret` | via `hunt_id` |
| `sessions` | Anonymous guest progress, keyed by an unguessable `device_token` | via `hunt_id` |
| `scans` | One row per (session, character); a unique constraint prevents double counting | via session/character |
| `reward_tiers` | Optional rewards returned when a session completes a hunt (no admin UI yet) | via `hunt_id` |
| `admin_users` | Staff accounts; `organization_id` NULL means super-admin | `organization_id` |

The model is named `PlayerSession` in code to avoid colliding with
SQLAlchemy's `Session`; it maps to the `sessions` table.

**Design choices:**
- No player accounts. Sessions are anonymous, which removes login friction
  entirely. `display_name` is reserved for a future opt-in leaderboard.
- `qr_code_value` is separate from `id`, so codes can be regenerated and
  reprinted without breaking the character record or recorded scans.
- Secret characters are excluded from both sides of every completion
  fraction (`total_found` / `total_characters`), so they can never block or
  pad 100%.

## 3. Tenant isolation

- Every admin route depends on `get_current_admin` (valid, unexpired JWT for
  an active admin account).
- An admin with an `organization_id` only sees and changes rows belonging to
  that organization: hunts directly, characters through their hunt. Rows of
  another organization return 404, the same response as a nonexistent id.
- Super-admins (`organization_id` NULL) can manage every organization.
  Creating organizations, hunts and admin accounts is super-admin only.
- Guest routes never accept admin credentials and admin routes never accept a
  `device_token`. Guest lookups of a character require a scan record for that
  device, and every failure returns the same generic 404.
- `backend/tests/test_tenant_isolation.py` proves these rules for list,
  create, update and delete of characters, plus hunt stats and QR printing.

## 4. API contract

### Public / gameplay endpoints

**`GET /api/hunts`** — active hunts across all organizations, for the hunt picker.

**`GET /api/hunts/{slug}`** — the organization's active hunt, for the entrance screen.
```json
{
  "hunt_id": "uuid",
  "name": "Cobb's Summer Hunt 2026",
  "organization": { "name": "Cobb's Adventure Park", "slug": "cobbs", "theme_primary": "#f7931e",
                    "theme_secondary": "#1a1a1a", "theme_mode": "light", "logo_url": null },
  "total_characters": 4,
  "is_active": true
}
```

**`POST /api/sessions`** — `{ "hunt_id": "uuid" }` → `{ "session_id": "uuid", "device_token": "..." }`.
Returns 403 if the hunt is inactive.

**`GET /api/sessions/{device_token}`** — resume a session.
```json
{ "session_id": "uuid", "hunt_id": "uuid", "total_found": 1, "total_characters": 4, "found_character_ids": ["uuid"] }
```

**`POST /api/scans`** — `{ "device_token": "...", "qr_code_value": "K7XQ-2M9P-T4RN" }`
```json
{
  "success": true,
  "character": { "id": "uuid", "name": "...", "description": "...", "image_url": "...", "points": 10, "has_trivia": true },
  "total_found": 2,
  "total_characters": 4,
  "newly_unlocked_rewards": []
}
```
or `{ "success": false, "reason": "already_scanned" | "invalid_code" }`.

**`GET /api/progress/{device_token}`** — gallery data. Unfound characters show
`"???"`, no image, and their hint/area; unfound secret characters are omitted.

**`GET /api/characters/lookup-hunt?code=...`** — routes a guest who scanned a
sign before starting a session; returns only the organization slug and hunt id.

**`GET /api/characters/{id}?device_token=...`** — revisit a found character.

**`GET /api/characters/{id}/trivia?device_token=...`** — question and options only.

**`POST /api/characters/{id}/trivia/answer`** — `{ "device_token": "...", "answer": "a" }`
→ `{ "correct": false, "correct_answer": "c", "trivia_description": "..." }`.

**`GET /api/proxy-image?url=...`** — same-origin copy of an organization logo,
so the completion card can be exported as an image. Only URLs that are
currently some organization's `logo_url` are fetched.

**`GET /api/health`** — `{ "status": "ok", "database": "connected", "database_type": "postgresql" }`.

### Admin endpoints (Bearer JWT required)

- `POST /api/admin/login` → `{ "access_token": "...", "token_type": "bearer" }`
- `POST /api/admin/change-password`
- `GET|POST|PATCH /api/admin/organizations` (create is super-admin only)
- `GET|POST|PATCH /api/admin/hunts` (create is super-admin only)
- `GET /api/admin/hunts/{id}/stats` → total sessions, completion rate, scans per character
- `GET /api/admin/hunts/{id}/print-qr-codes` → PDF
- `GET|POST|PATCH|DELETE /api/admin/characters`, `POST /api/admin/characters/upload-image`
- `GET|POST /api/admin/admin-users`, `PATCH /api/admin/admin-users/{id}/deactivate|reactivate` (super-admin only)

## 5. Product decisions for v1

1. **Reward:** a shareable completion card at 100%. No discount codes,
   redemption tracking or prize draws yet; the card doubles as informal
   marketing when guests share it.
2. **Hunt size:** 5–10 characters for the first hunt; the model has no fixed limit.
3. **Single reward tier:** 100% completion only; partial-progress rewards deferred.
4. **Multi-property from day one:** new properties are added as data.
5. **Out of scope for v1:** computer-vision character recognition (QR only),
   a native app (web instead), player accounts, multi-tier rewards.

**Open considerations before wider rollout:**
- **Connectivity:** guests' cell signal may be unreliable in parts of a park.
  An offline-tolerant mode (queue scans locally, sync later) may be worth it.
- **Hosting costs:** free tiers suit one small hunt; revisit if usage grows.
- **Maintenance:** printed QR signs need periodic checks (weather, fading,
  removal) and the app needs a long-term owner.
