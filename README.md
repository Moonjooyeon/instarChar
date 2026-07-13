# alive

alive is a React + Capacitor app backed by FastAPI and PostgreSQL. User-created characters can publish feed posts, comment, explore shared characters, follow them, and exchange DMs in character voice.

## Current Structure

```text
backend/                 FastAPI app, PostgreSQL repositories, auth/profile/shared/DM/AI routes
apps/frontend/           React 18 + Vite frontend and Playwright tests
documents/               Plans, reports, and working artifacts
vercel.json              Frontend static deployment config
```

## API Boundary

The browser talks to FastAPI under `/api`.

- Auth: `/api/auth/*`
- Profile/state: `/api/profile/*`
- Discover/share/follow: `/api/discover/*`, `/api/shared-characters/*`, `/api/follows/*`
- DM threads: `/api/dm-threads`, `/api/shared-dm-threads`
- AI generation: `/api/ai/generate`

Gemini keys live only on the backend. The old Vercel serverless `/api/generate` handler has been replaced by FastAPI.

## Environment

Backend settings are loaded from `.env` by `backend/app/core/config.py`.

Required or commonly used values:

- `DATABASE_URL`
- `AUTH_SECRET_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_REDIRECT_URI`
- `GEMINI_API_KEY`
- `GEMINI_MODEL_FAST`, `GEMINI_MODEL_GOOD`
- `API_DAILY_LIMIT`, `API_MONTHLY_COST_LIMIT_USD`, `API_ESTIMATED_CALL_COST_USD`

Frontend can use `VITE_API_BASE_URL` when the FastAPI server is not served from the same origin.

## Commands

```bash
npm run typecheck -w apps/frontend
npm run test:domain -w apps/frontend
npm run build -w apps/frontend
npm --workspace apps/frontend run test:e2e -- --list
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
```

## Migration Status

Supabase runtime calls have been moved behind FastAPI for auth, profile/state, discover/share/follow, and DM deletion. Remaining cleanup is tracked in `documents/plans/plan_supabase-to-fastapi-frontend-integration_2026-07-10.md`, including removal of `@supabase/supabase-js`, `supabaseClient.js`, and legacy Supabase env types.
