---
title: Backend Structure
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-06-26
version: 3.2.0
status: approved
---

# Backend Structure

This file describes the current Python + FastAPI backend structure for alive.

The backend replaces the previous Supabase Auth/DB boundary with server-owned OAuth, API-level authorization, and PostgreSQL persistence.

## Directory Structure

```text
backend/
├── Dockerfile
├── alembic.ini
├── requirements.txt
├── migrations/
│   ├── env.py
│   └── versions/
│       └── 20260626_0001_initial_alive_schema.py
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── deps.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── dm_threads.py
│   │       ├── profiles.py
│   │       └── shared_characters.py
│   ├── core/
│   │   ├── config.py
│   │   ├── errors.py
│   │   └── security.py
│   ├── db/
│   │   ├── base.py
│   │   └── session.py
│   ├── models/
│   │   └── entities.py
│   ├── repositories/
│   │   ├── dm_threads.py
│   │   ├── profile_state.py
│   │   ├── shared_characters.py
│   │   └── users.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── dm_threads.py
│   │   ├── profile.py
│   │   └── shared_characters.py
│   └── services/
│       └── oauth.py
└── tests/
    ├── test_auth_api.py
    ├── test_dm_threads_api.py
    ├── test_profile_api.py
    ├── test_security.py
    └── test_shared_characters_api.py
```

## Layers

| Layer | Path | Responsibility |
|-------|------|----------------|
| App entry | `backend/app/main.py` | FastAPI app creation, CORS, router mounting, global `AppError` handler, `/health` |
| API dependencies | `backend/app/api/deps.py` | Current user loading from signed session cookie |
| API routers | `backend/app/api/v1/` | HTTP routing and response shaping |
| Settings | `backend/app/core/config.py` | Environment-backed settings via `pydantic-settings` |
| Errors | `backend/app/core/errors.py` | Application exceptions converted by the global handler |
| Security | `backend/app/core/security.py` | Session signing, OAuth state signing, JWT verification helpers |
| DB | `backend/app/db/` | Async SQLAlchemy engine/session and declarative base |
| Models | `backend/app/models/entities.py` | SQLAlchemy ORM entities for users, profiles, characters, follows, DM threads |
| Repositories | `backend/app/repositories/` | Database operations and authorization-sensitive data access |
| Schemas | `backend/app/schemas/` | Pydantic request/response contracts |
| Services | `backend/app/services/oauth.py` | Google and Apple OAuth URL/token/profile flow |
| Migrations | `backend/migrations/` | Alembic schema migration files |
| Tests | `backend/tests/` | FastAPI route and core security tests |

## API Surface

All API routes are mounted under `/api` except the system health check.

| Method | Path | Router | Purpose |
|--------|------|--------|---------|
| `GET` | `/health` | `main.py` | Health check |
| `GET` | `/api/auth/google/start` | `auth.py` | Start Google OAuth |
| `GET` | `/api/auth/apple/start` | `auth.py` | Start Apple OAuth |
| `GET` | `/api/auth/google/callback` | `auth.py` | Complete Google OAuth and issue session cookie |
| `POST` | `/api/auth/apple/callback` | `auth.py` | Complete Apple OAuth and issue session cookie |
| `POST` | `/api/auth/logout` | `auth.py` | Clear session cookie |
| `GET` | `/api/auth/me` | `auth.py` | Return current backend user DTO |
| `GET` | `/api/profile/state` | `profiles.py` | Load profile backup and structured state |
| `PUT` | `/api/profile/state` | `profiles.py` | Save compact profile backup |
| `POST` | `/api/profile/structured-state` | `profiles.py` | Upsert characters, personas, owner DM, shared DM rows |
| `POST` | `/api/profile/onboarding` | `profiles.py` | Save display name and mark onboarding complete |
| `GET` | `/api/discover/characters` | `shared_characters.py` | Return discover character DTOs |
| `GET` | `/api/shared-characters/follower-counts` | `shared_characters.py` | Batch follower counts |
| `GET` | `/api/shared-characters/{shared_character_id}` | `shared_characters.py` | Load a shared character by ID |
| `GET` | `/api/shared-characters/{shared_character_id}/followers` | `shared_characters.py` | List followers for a shared character |
| `PUT` | `/api/shared-characters/{shared_character_id}/follow` | `shared_characters.py` | Follow a shared character |
| `DELETE` | `/api/shared-characters/{shared_character_id}/follow` | `shared_characters.py` | Unfollow a shared character |
| `POST` | `/api/shared-characters/{shared_character_id}/relationship-follow-back` | `shared_characters.py` | Apply relationship-based follow-back |
| `GET` | `/api/characters/{source_account_id}/share` | `shared_characters.py` | Find the current user's share ID for a character |
| `PUT` | `/api/shared-characters/by-source/{source_account_id}` | `shared_characters.py` | Upsert a shared character by local source account ID |
| `PATCH` | `/api/shared-characters/by-source/{source_account_id}` | `shared_characters.py` | Update a shared character snapshot |
| `DELETE` | `/api/shared-characters/by-source/{source_account_id}` | `shared_characters.py` | Delete a shared character snapshot |
| `POST` | `/api/follows/sync-owned-snapshot` | `shared_characters.py` | Update follow row snapshots for the current user's character |
| `GET` | `/api/dm-threads` | `dm_threads.py` | Load an owner DM thread by `thread_key` query |
| `PUT` | `/api/dm-threads` | `dm_threads.py` | Upsert an owner DM thread |
| `DELETE` | `/api/dm-threads` | `dm_threads.py` | Delete an owner DM thread by `thread_key` query |
| `GET` | `/api/shared-dm-threads` | `dm_threads.py` | Load a shared DM thread by `thread_key` query |
| `PUT` | `/api/shared-dm-threads` | `dm_threads.py` | Upsert a shared DM thread |
| `DELETE` | `/api/shared-dm-threads` | `dm_threads.py` | Delete a shared DM thread by `thread_key` query |

## Authorization Rules

- Authenticated routes depend on `get_current_user`.
- Sessions are signed backend cookies, not Supabase sessions.
- Google and Apple are the only allowed OAuth providers.
- Email/password, magic link, Kakao, Naver, and X login are out of scope.
- Repository methods must enforce owner or participant constraints before modifying data.
- Shared DM access requires the current user's ID to be present in `participant_user_ids`.
- `thread_key` is passed through query/body instead of path parameters to avoid URL encoding issues.

## Database Model Groups

| Group | Models |
|-------|--------|
| Auth and profile | `User`, `Profile` |
| Character state | `Character`, `UserPersona` |
| Public discovery | `SharedCharacter`, `CharacterFollow` |
| DM state | `DmThread`, `SharedDmThread` |

## Verification

Current backend verification command:

```bash
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
```

Current expected result:

```text
32 passed
```
