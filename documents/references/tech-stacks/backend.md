---
title: Backend Tech Stack
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-06-26
version: 2.2.0
status: approved
---

# Backend Tech Stack

alive's backend is a Python + FastAPI service backed by PostgreSQL.

The backend is being introduced to replace Supabase Auth/DB usage with server-owned OAuth, HttpOnly session cookies, API-level authorization, SQLAlchemy models, and Alembic migrations.

## Runtime

| Area | Choice |
|------|--------|
| Language | Python |
| Web framework | FastAPI |
| ASGI server | Uvicorn |
| ORM | SQLAlchemy 2 async ORM |
| Database driver | asyncpg |
| Database | PostgreSQL |
| Migrations | Alembic |
| Validation | Pydantic 2 |
| Settings | pydantic-settings |
| OAuth providers | Google ID, Apple ID |
| Session strategy | Signed JWT in HttpOnly cookie |
| Tests | pytest with FastAPI `TestClient` and dependency overrides |

## Dependencies

`backend/requirements.txt` is the source of truth.

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | `0.115.5` | API framework |
| `uvicorn[standard]` | `0.32.1` | ASGI server |
| `sqlalchemy` | `2.0.36` | Async ORM and database access |
| `asyncpg` | `0.30.0` | Async PostgreSQL driver |
| `alembic` | `1.14.0` | Database migrations |
| `pydantic` | `2.10.3` | Request and response validation |
| `email-validator` | `2.2.0` | Email validation for Pydantic schemas |
| `pydantic-settings` | `2.6.1` | Environment-backed settings |
| `python-dotenv` | `1.0.1` | Local environment loading |
| `httpx` | `0.28.1` | OAuth token/profile HTTP requests |
| `PyJWT[crypto]` | `2.10.1` | Session signing and ID token verification support |
| `python-multipart` | `0.0.19` | Apple OAuth form callback parsing |
| `pytest` | `8.3.4` | Backend tests |

## Infrastructure

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Backend container image |
| `docker-compose.local.yaml` | Local backend + PostgreSQL composition |
| `db/Dockerfile` | Local PostgreSQL image |
| `db/init.sql` | Initial local database SQL |
| `backend/alembic.ini` | Alembic configuration |
| `backend/migrations/env.py` | Alembic async migration runner |
| `backend/migrations/versions/20260626_0001_initial_alive_schema.py` | Initial alive backend schema |

## Environment Variables

Defined in `.env.example`.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Async SQLAlchemy PostgreSQL URL |
| `FRONTEND_ORIGINS` | Comma-separated allowed CORS origins |
| `AUTH_SECRET_KEY` | Session and OAuth state signing secret |
| `AUTH_COOKIE_NAME` | Session cookie name |
| `AUTH_COOKIE_SECURE` | Secure cookie flag |
| `AUTH_SESSION_TTL_SECONDS` | Session lifetime |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `APPLE_CLIENT_ID` | Apple OAuth client ID |
| `APPLE_CLIENT_SECRET` | Apple OAuth client secret or generated client secret |

## Implemented Backend Domains

| Domain | Router | Status |
|--------|--------|--------|
| Auth | `backend/app/api/v1/auth.py` | Implemented for Google/Apple OAuth, logout, current user |
| Profile state | `backend/app/api/v1/profiles.py` | Implemented for profile backup, structured state, onboarding |
| Shared characters and follows | `backend/app/api/v1/shared_characters.py` | Implemented for discovery, sharing, follows, follow-back |
| DM threads | `backend/app/api/v1/dm_threads.py` | Implemented for owner/shared DM CRUD with participant checks |
| AI generation | Not implemented yet | Planned Phase 7 |

## Verification

Current backend verification commands:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache backend/.venv/bin/python -m compileall -q backend/app backend/tests backend/migrations
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
```

Current expected pytest result:

```text
32 passed
```
