# Cobb's Scavenger Hunt App

Multi-tenant scavenger hunt web app for Cobb's Adventure Park, designed to be 
reusable by other properties (e.g. Screamfest) in the future.

## Full spec
See `scavenger-hunt-spec.md` at the project root for the complete database 
schema, API contract, and one-pager. Always check the "Development Progress" 
section at the top of that file for current status before starting new work.

## Tech stack
- Backend: FastAPI (Python), SQLAlchemy, Postgres via Supabase
- Frontend: React + Vite (not Create React App)
- Database: Supabase Postgres — connection string in `.env` (DATABASE_URL), 
  never commit real credentials, `.env.example` shows the expected format

## Key decisions / conventions
- Sessions are anonymous, no login required for guests
- Session model is named `PlayerSession` in code (avoids collision with 
  SQLAlchemy's own `Session` class), but maps to the `sessions` table
- device_token is stored in localStorage on the frontend and passed explicitly 
  on requests — NOT using cookies
- QR codes encode a URL pointing to /scan?code={qr_code_value}
- Reward mechanic for v1: a single shareable completion card at 100% found, 
  no discount codes or multi-tier rewards yet
- RLS is intentionally disabled on Supabase tables — FastAPI is the only 
  service that talks to Postgres, so the API layer is the access control point

## Running locally
Backend: `cd backend && python -m uvicorn app.main:app --reload --port 8000`
Frontend: `cd frontend && npm run dev`

## What NOT to do
- Don't modify .env or .env.example unless explicitly asked
- Don't touch pages/features marked as "not yet started" in the spec's 
  progress tracker unless that's the current task
- Keep changes scoped to one vertical slice at a time, not sprawling multi-feature commits