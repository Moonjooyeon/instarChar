# Backend Guidelines

Python and FastAPI coding conventions for the alive backend.

---

## General Principles

- Keep backend changes scoped to backend files unless the task explicitly includes frontend integration.
- Type hints are required on all function parameters and return values.
- Do not use `Any`; use `object`, concrete types, or explicit unions.
- Prefer small functions with a single responsibility.
- Use early returns to reduce nesting.
- Keep endpoint functions thin; route, validate, call a repository/service, and return.
- Keep business rules and authorization-sensitive data access outside React and inside backend repositories/services.
- Do not introduce Supabase dependencies in backend code.

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | `PascalCase` | `OAuthService`, `DmThreadRepository` |
| Functions / variables / methods | `snake_case` | `get_current_user`, `upsert_shared_thread` |
| Files / directories | `snake_case` | `shared_characters.py`, `dm_threads.py` |
| Constants / env vars | `SCREAMING_SNAKE_CASE` | `DATABASE_URL`, `AUTH_SECRET_KEY` |
| Boolean variables | Verb prefix | `is_active`, `has_session`, `can_follow` |
| Private helpers | `_` prefix | `_shared_dm_by_key`, `_require_shared_participant` |

## Import Order

```python
# 1. Standard library
from typing import Optional
from uuid import UUID

# 2. Third-party
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

# 3. Local
from app.api.deps import get_current_user
from app.models import User
```

## Backend Layers

| Layer | Rule |
|-------|------|
| `api/v1/` | HTTP route definitions and response shaping only |
| `schemas/` | Pydantic request/response contracts |
| `repositories/` | SQLAlchemy queries, upserts, deletes, and owner/participant checks |
| `services/` | External flows or domain services such as OAuth |
| `models/` | SQLAlchemy ORM entities only |
| `core/` | Settings, security helpers, and shared exceptions |

Current backend uses repositories directly from routers where the behavior is mostly data access. Add a service only when it removes real complexity, such as external provider flows or multi-step domain orchestration.

## FastAPI Routers

- Mount versioned routers under `backend/app/api/v1/__init__.py`.
- Use one router file per domain.
- Use `Depends(get_current_user)` for authenticated routes.
- Use `Depends(get_db_session)` for database access.
- Prefer query/body parameters for values that may contain reserved URL characters, such as `thread_key`.
- Return Pydantic response models when a route returns JSON.

Example:

```python
router = APIRouter(tags=["dm-threads"])

@router.delete("/dm-threads", status_code=status.HTTP_204_NO_CONTENT)
async def delete_owner_dm_thread(
    thread_key: str = Query(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await DmThreadRepository(session).delete_owner_thread(user, thread_key)
```

## Auth and Authorization

- Google and Apple are the only OAuth providers.
- Backend sessions use signed HttpOnly cookies.
- Do not rely on Supabase session objects or RLS.
- API-level authorization is mandatory in repository methods.
- Owner-scoped rows must filter by the current user's ID.
- Shared DM access must require current user membership in `participant_user_ids`.
- Follow and follow-back operations must validate source/target ownership rules in backend code.

## Pydantic Schemas

- Define request/response contracts in `backend/app/schemas/`.
- Keep ORM models and schemas separate.
- Use `ConfigDict(from_attributes=True)` for ORM serialization.
- Use `dict[str, object]` and `list[object]` for legacy JSONB payloads whose internal shape is intentionally flexible.
- Do not expose raw tokens, cookies, or provider secrets in response schemas.

Example:

```python
from pydantic import BaseModel, ConfigDict, Field

class DmThreadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    thread_key: str
    messages: list[object] = Field(default_factory=list)
    world_pref: dict[str, object] = Field(default_factory=dict)
```

## SQLAlchemy and Migrations

- Use async SQLAlchemy sessions from `app/db/session.py`.
- Do not create engines or sessions inside route handlers.
- Define tables in `backend/app/models/entities.py`.
- Schema changes must go through Alembic migrations.
- Avoid `create_all()` in application code.
- Use PostgreSQL-compatible constructs because the local and target database is PostgreSQL.
- Keep conflict handling explicit with PostgreSQL `insert(...).on_conflict_do_update(...)`.

## Error Handling

- Use custom exceptions from `app/core/errors.py`.
- Let `app/main.py` convert `AppError` subclasses into JSON error responses.
- Use `UnauthorizedError` for missing/invalid sessions.
- Use `ForbiddenError` when the user is authenticated but does not own or participate in the resource.
- Use `BadRequestError` for missing or invalid domain resources.

## Testing

- Use `pytest`.
- Prefer FastAPI `TestClient` with dependency overrides for API contract tests.
- Override `get_current_user` and `get_db_session` instead of requiring a live database for route tests.
- Add repository-level unit tests for authorization-sensitive logic when possible.
- Always run backend verification after backend changes:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache backend/.venv/bin/python -m compileall -q backend/app backend/tests backend/migrations
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
```

Current expected pytest result:

```text
32 passed
```
