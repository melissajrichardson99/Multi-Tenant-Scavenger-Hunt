# Multi Tenant Scavenger Hunt

A mobile-first QR-code scavenger hunt web app, built for **Cobb's Adventure
Park** and designed from day one to serve several parks from one deployment.

Guests walk the park, scan QR signs placed at character locations and build
a collection on their phone. No app to install, no account to create. Each
find reveals the character, an optional trivia question and progress toward a
shareable completion card. Park staff manage hunts, characters and printable
QR signs from an admin dashboard. Each property (organization) gets its own
branding and can only ever see its own data.

| Finding a character | Trivia | Completion card |
|---|---|---|
| <img src="docs/images/guest-character-found.png" width="260" alt="Character reveal screen on a phone after scanning a QR code"> | <img src="docs/images/guest-trivia.png" width="260" alt="Trivia question answered correctly, with the fun fact revealed"> | <img src="docs/images/guest-completion-card.png" width="260" alt="Hunt completed card with the park's branding"> |

## Features

**For guests**
- Start a hunt from the park's entrance screen. Progress is saved on the device, with no login.
- Scan signs with the phone camera, or type the short code printed under each QR code (`K7XQ-2M9P-T4RN`; case, spaces and dashes don't matter).
- Scanning a sign with the phone's normal camera app routes the guest to the right park and records the find after they start.
- Progress gallery grouped by park area, with hints for characters still out there.
- Optional trivia per character (2–4 options). The answer is checked server-side and never sent to the phone before the guest answers.
- Secret bonus characters that stay hidden until found and never count toward completion.
- A completion card at 100%, in the park's colors, shareable through the phone's share sheet or downloadable as a PNG.

**For park staff (admin)**
- Email/password login (bcrypt hashes, 24-hour JWT) and password change.
- Manage organizations (name, slug, theme colors, light/dark mode, logo), hunts and characters, including image upload.
- Automatic QR code generation per character, plus a printable PDF: cut-out guest signs that show only an index number, and a "staff only" reference sheet mapping each number to its character and location.
- Per-hunt stats: sessions, completion rate, scans per character.
- Super-admins manage every park and the admin accounts; park admins are confined to their own park.

<img src="docs/images/admin-characters.png" alt="Admin character list with images, points, QR codes and edit/delete actions">

## Multi-tenant design

Each park is an **organization**. Everything else hangs off it, so adding a
park means adding rows, not code. The theme travels with the organization,
and the same frontend renders each park in its own branding:

<img src="docs/images/themes-two-parks.png" width="560" alt="The same progress screen in Cobb's light orange theme and in a fictional park's dark purple theme">

*Left: Cobb's Adventure Park (light theme). Right: Lantern Grove Fun Park, a
fictional second park included in the demo data.*

```mermaid
flowchart LR
    subgraph Tenant["Organization (tenant)"]
        ORG["organizations<br/>name, slug, theme colors,<br/>light/dark mode, logo"]
        HUNT["hunts<br/>is_active"]
        CHAR["characters<br/>qr_code_value, trivia, is_secret"]
        ORG --> HUNT --> CHAR
    end
    ADMIN["admin_users<br/>organization_id<br/>(NULL = super-admin)"] -. scoped to .-> ORG
    SESS["sessions<br/>anonymous device_token"] --> HUNT
    SCAN["scans<br/>unique per session + character"] --> SESS
    SCAN --> CHAR
```

How isolation is enforced (the backend is the only component with database
credentials, so the API layer is the access-control point):

```mermaid
flowchart TD
    R["Request to /api/admin/*"] --> J{"Valid JWT for an<br/>active admin?"}
    J -- no --> E401["401"]
    J -- yes --> S{"admin.organization_id"}
    S -- "NULL (super-admin)" --> ALL["Query across all organizations"]
    S -- "set" --> F["Filter by organization:<br/>hunts directly,<br/>characters via their hunt"]
    F --> M{"Row in admin's<br/>organization?"}
    M -- no --> E404["404, same as a nonexistent id"]
    M -- yes --> OK["Proceed"]
```

- Guest endpoints authenticate with the session's `device_token` and can only
  read characters that session has actually scanned; admin endpoints never
  accept a `device_token`.
- [`backend/tests/test_tenant_isolation.py`](backend/tests/test_tenant_isolation.py)
  proves that a park admin can't list, read, create into, update or delete
  another park's characters (and checks the data is unchanged afterwards),
  that a super-admin can, and that a guest session gets 401 on admin routes.

## Tech stack and architecture

- **Backend:** Python, FastAPI, SQLAlchemy 2, PyJWT, passlib/bcrypt, qrcode, ReportLab
- **Database:** PostgreSQL (Supabase in the original setup); SQLite for local development and tests
- **File storage:** Supabase Storage buckets, or local disk in development
- **Frontend:** React 18, Vite, React Router, html5-qrcode (camera scanning), html2canvas (completion card image)
- **Tests:** pytest with FastAPI's TestClient

```mermaid
flowchart LR
    P["Guest phone /<br/>staff browser"] -->|"HTTPS"| FE["React SPA<br/>(Vite)"]
    FE -->|"/api JSON<br/>Bearer JWT or device_token"| API["FastAPI backend"]
    API -->|"SQLAlchemy"| DB[("PostgreSQL<br/>or SQLite (dev)")]
    API -->|"images, QR PNGs"| ST[("Supabase Storage<br/>or local uploads/")]
    API -->|"PDF"| PDF["Printable QR signs"]
```

The full data model, API contract and design decisions are in
[`scavenger-hunt-spec.md`](scavenger-hunt-spec.md); the schema is
[`backend/schema.sql`](backend/schema.sql).

## Run it locally

Requirements: **Python 3.10+** and **Node.js 18+**. No cloud accounts needed;
the default setup uses SQLite and local file storage. Commands run from the
project root unless noted.

### 1. Configure

```bash
cp .env.example .env
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(48))" >> .env
```

(PowerShell: `Copy-Item .env.example .env`, then the same `python -c ...`
line with `| Add-Content .env` instead of `>> .env`.)

Environment variables (all documented in [`.env.example`](.env.example)):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | `sqlite:///./dev.db` (default in the example) or a Postgres URL |
| `JWT_SECRET_KEY` | yes | Signs admin tokens. The backend won't start without it. |
| `APP_ENV` | no | `development` (default) or `production` |
| `CORS_ALLOWED_ORIGINS` | production | Comma-separated allowed browser origins (dev default: `http://localhost:3000`) |
| `PUBLIC_BASE_URL` | production | Guest app address encoded in QR codes (dev default: `http://localhost:3000`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | production | Supabase Storage. If unset in development, files go to `uploads/`. |

### 2. Backend setup, database and demo data

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements-dev.txt

python scripts/init_db.py          # creates the tables
python scripts/seed_demo.py        # two demo parks with hunts and characters
python scripts/create_admin.py --email admin@example.com                    # super-admin
python scripts/create_admin.py --email cobbs-admin@example.com --org-slug cobbs   # optional park admin
```

`create_admin.py` prompts for a password (8+ characters). For scripted
setups, set it in the `ADMIN_PASSWORD` environment variable instead.

**Postgres instead of SQLite:** point `DATABASE_URL` at an empty database.
`python scripts/init_db.py` then applies `backend/schema.sql`, or you can run
`psql "$DATABASE_URL" -f backend/schema.sql` yourself. A throwaway local
Postgres:

```bash
docker run -d --name hunt-pg -e POSTGRES_PASSWORD=devpassword -p 5432:5432 postgres:16-alpine
# DATABASE_URL=postgresql://postgres:devpassword@localhost:5432/postgres
```

### 3. Start the servers (two terminals)

```bash
# terminal 1 (with the virtualenv active)
cd backend
python -m uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000. Pick a park, press **Start Hunt!**, then use
**Scan QR Code → Enter Code Manually** with a code from the admin character
list, or open a QR code's URL directly. The admin dashboard is at
http://localhost:3000/admin. The API docs are at http://localhost:8000/docs.

On a laptop the camera scanner works on `localhost`. Phones need HTTPS for
camera access, so on-device camera testing needs a deployment or an HTTPS tunnel.

### 4. Run the tests

```bash
cd backend
python -m pytest
```

The suite creates its own temporary SQLite database and file storage, and
never reads `.env`. To run it against a throwaway Postgres instead, set
`TEST_DATABASE_URL` (the tests delete all rows, so never point it at real data).

Frontend checks: `npm run lint` and `npm run build` in `frontend/`.

## Status

Built in about two weeks in July 2026 as a working v1 for Cobb's Adventure
Park. The full guest and admin flows work locally against SQLite and
PostgreSQL, and the backend test suite passes on both. **It is not deployed.**

### Roadmap and known limitations

These are known and deliberately left for the next iteration:

- **Admin login rate limiting.** Add per-IP and per-account throttling and
  lockout on `POST /api/admin/login`.
- **Request validation.** Most endpoints accept a plain `dict`; moving every
  request body to Pydantic models would give typed validation and better
  generated docs.
- **Image proxy hardening.** `/api/proxy-image` resolves the host and rejects
  private addresses, then fetches the URL separately, which leaves a small
  DNS-rebinding window. Pin the resolved IP for the actual request.
- **Public API docs.** `/docs` and `/openapi.json` are open; disable or
  protect them in production.
- **Device token in the URL path.** `GET /api/sessions/{device_token}` and
  `/api/progress/{device_token}` put the guest's token in URLs, where it can
  end up in logs. Move it to a header.
- **Row Level Security is intentionally off** on the database tables. Only
  the backend holds credentials and it enforces access, so this is a
  conscious design choice. RLS would become necessary if a client ever
  talked to the database directly.
- **Dependencies:** the frontend still uses Vite 5 and React Router 6, which
  have open advisories that need major-version upgrades (the Vite ones only
  affect the development server).
- **Next features:** HTTPS deployment and a field test on real phones, an
  admin UI for reward tiers, offline-tolerant scanning for areas of the park
  with poor signal, and richer park branding on the completion card.

## Credits and licence

Built for **Cobb's Adventure Park**. Park names and branding belong to their
owners. "Lantern Grove Fun Park" and its characters are fictional demo data,
and the demo character images are simple placeholders.

**Licence status: all rights reserved.** The source is published for viewing;
no licence is granted to use, copy or modify it.

Third-party libraries are used unmodified under their own licences, installed
from PyPI and npm. Most are MIT, BSD or Apache-2.0. Two exceptions: the
backend's Postgres driver `psycopg2-binary` is LGPL-licensed, and `certifi`
(a dependency of `httpx`) is MPL-2.0.
