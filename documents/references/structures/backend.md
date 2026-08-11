---
title: Backend Structure
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-08-11
version: 3.8.0
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
│       ├── 20260626_0001_initial_alive_schema.py
│       ├── 20260723_0002_post_authority_and_usage.py
│       ├── 20260724_0003_character_post_likes.py
│       ├── 20260724_0004_post_like_character_targets.py
│       ├── 20260724_0005_native_oauth_codes.py
│       ├── 20260724_0006_ugc_safety.py
│       ├── 20260728_0007_apple_oauth_credentials.py
│       ├── 20260728_0008_apple_account_notifications.py
│       ├── 20260730_0009_character_handle_uniqueness.py
│       ├── 20260731_0010_toss_user_provider.py
│       └── 20260806_0011_media_assets.py
├── app/
│   ├── main.py
│   ├── iap_release_check.py
│   ├── legal/
│   ├── public/
│   ├── api/
│   │   ├── deps.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── ai.py
│   │       ├── auth.py
│   │       ├── characters.py
│   │       ├── dm_threads.py
│   │       ├── media.py
│   │       ├── moderation.py
│   │       ├── post_likes.py
│   │       ├── profiles.py
│   │       └── shared_characters.py
│   ├── core/
│   │   ├── character_handles.py
│   │   ├── config.py
│   │   ├── errors.py
│   │   ├── security.py
│   │   └── token_encryption.py
│   ├── db/
│   │   ├── base.py
│   │   └── session.py
│   ├── models/
│   │   └── entities.py
│   ├── repositories/
│   │   ├── ai_usage.py
│   │   ├── apple_account_events.py
│   │   ├── apple_credentials.py
│   │   ├── auto_posts.py
│   │   ├── characters.py
│   │   ├── character_posts.py
│   │   ├── dm_threads.py
│   │   ├── media_assets.py
│   │   ├── moderation.py
│   │   ├── post_likes.py
│   │   ├── profile_state.py
│   │   ├── shared_characters.py
│   │   └── users.py
│   ├── schemas/
│   │   ├── ai.py
│   │   ├── auth.py
│   │   ├── characters.py
│   │   ├── character_posts.py
│   │   ├── dm_threads.py
│   │   ├── media.py
│   │   ├── moderation.py
│   │   ├── post_likes.py
│   │   ├── profile.py
│   │   └── shared_characters.py
│   └── services/
│       ├── account_deletion.py
│       ├── ai.py
│       ├── apple_client_secret.py
│       ├── apple_notifications.py
│       ├── apple_token_revocation.py
│       ├── auto_post_scheduler.py
│       ├── content_safety.py
│       ├── feed_generation.py
│       ├── media_ai.py
│       ├── media_references.py
│       ├── media_storage.py
│       ├── media_validation.py
│       ├── native_oauth.py
│       ├── oauth.py
│       └── toss_login.py
└── tests/
    ├── test_account_deletion.py
    ├── test_ai_api.py
    ├── test_ai_usage.py
    ├── test_apple_client_secret.py
    ├── test_apple_notifications.py
    ├── test_apple_oauth_credentials.py
    ├── test_auth_api.py
    ├── test_auto_post_scheduler.py
    ├── test_character_handles.py
    ├── test_character_posts_repository.py
    ├── test_characters_api.py
    ├── test_characters_repository.py
    ├── test_content_safety.py
    ├── test_dm_threads_api.py
    ├── test_feed_generation.py
    ├── test_legal_pages.py
    ├── test_iap_release_check.py
    ├── test_media_storage.py
    ├── test_migrations.py
    ├── test_moderation_api.py
    ├── test_post_likes_api.py
    ├── test_post_likes_repository.py
    ├── test_profile_api.py
    ├── test_security.py
    └── test_shared_characters_api.py
```

## Layers

| Layer                    | Path                                        | Responsibility                                                                                                                                |
| ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| App entry                | `backend/app/main.py`                       | FastAPI app creation, CORS, router mounting, scheduler lifespan, global `AppError` handler, `/health`                                         |
| IAP release preflight    | `backend/app/iap_release_check.py`          | Validate console bundle, SKU, price, copy, asset, exposure, and minimum-version evidence against server policy                                |
| API dependencies         | `backend/app/api/deps.py`                   | Current user loading from signed session cookie                                                                                               |
| API routers              | `backend/app/api/v1/`                       | HTTP routing and response shaping                                                                                                             |
| Settings                 | `backend/app/core/config.py`                | Environment-backed settings via `pydantic-settings`                                                                                           |
| Errors and handle policy | `backend/app/core/`                         | Application exceptions, handle normalization/validation, and encrypted token helpers                                                          |
| Security                 | `backend/app/core/security.py`              | Session signing, OAuth state signing, and JWT verification helpers                                                                            |
| DB                       | `backend/app/db/`                           | Async SQLAlchemy engine/session and declarative base                                                                                          |
| Models                   | `backend/app/models/entities.py`            | SQLAlchemy ORM entities for auth credentials, profiles, characters, media, moderation, follows, post likes, DM threads, and AI usage counters |
| Repositories             | `backend/app/repositories/`                 | Database operations and authorization-sensitive data access                                                                                   |
| Schemas                  | `backend/app/schemas/`                      | Pydantic request/response contracts                                                                                                           |
| Services                 | `backend/app/services/`                     | OAuth, Toss/native login, MonoGPT Gemini generation, media storage/validation, safety, account deletion, feed generation, and autonomous scheduling   |
| Legal/public assets      | `backend/app/legal/`, `backend/app/public/` | Privacy, terms, account-deletion pages, CSS, and public brand assets                                                                          |
| Migrations               | `backend/migrations/`                       | Alembic schema migration files                                                                                                                |
| Tests                    | `backend/tests/`                            | FastAPI route and core security tests                                                                                                         |

## API Surface

All API routes are mounted under `/api` except the system health check.

| Method   | Path                                                                    | Router                 | Purpose                                                                                          |
| -------- | ----------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`    | `/health`                                                               | `main.py`              | Health check                                                                                     |
| `GET`    | `/api/auth/google/start`                                                | `auth.py`              | Start Google OAuth                                                                               |
| `GET`    | `/api/auth/apple/start`                                                 | `auth.py`              | Start Apple OAuth                                                                                |
| `GET`    | `/api/auth/google/callback`                                             | `auth.py`              | Complete Google OAuth and issue session cookie                                                   |
| `POST`   | `/api/auth/apple/callback`                                              | `auth.py`              | Complete Apple OAuth and issue session cookie                                                    |
| `POST`   | `/api/auth/native/exchange`                                             | `auth.py`              | Exchange a one-time native OAuth code for a session cookie                                       |
| `POST`   | `/api/auth/apple/native`                                                | `auth.py`              | Complete native Apple login                                                                      |
| `POST`   | `/api/auth/toss/login`                                                  | `auth.py`              | Complete Apps in Toss login                                                                      |
| `POST`   | `/api/auth/apple/notifications`                                         | `auth.py`              | Process Apple account lifecycle notifications                                                    |
| `POST`   | `/api/auth/logout`                                                      | `auth.py`              | Clear session cookie                                                                             |
| `DELETE` | `/api/auth/account`                                                     | `auth.py`              | Permanently delete the authenticated account and owned data                                      |
| `GET`    | `/api/auth/me`                                                          | `auth.py`              | Return current backend user DTO                                                                  |
| `GET`    | `/api/profile/state`                                                    | `profiles.py`          | Load profile backup and structured state                                                         |
| `PUT`    | `/api/profile/state`                                                    | `profiles.py`          | Save compact profile backup                                                                      |
| `POST`   | `/api/profile/structured-state`                                         | `profiles.py`          | Upsert characters, personas, owner DM, shared DM rows                                            |
| `POST`   | `/api/profile/onboarding`                                               | `profiles.py`          | Save display name and mark onboarding complete                                                   |
| `POST`   | `/api/ai/generate`                                                      | `ai.py`                | Generate character, feed, DM, or analysis text through MonoGPT Gemini                             |
| `GET`    | `/api/characters/handle-availability`                                   | `characters.py`        | Normalize a handle and report global availability, optionally excluding one owned source account |
| `PUT`    | `/api/characters/{source_account_id}`                                   | `characters.py`        | Atomically create or update a character and its authoritative globally unique handle             |
| `GET`    | `/api/characters/{source_account_id}/posts`                             | `characters.py`        | Load authoritative posts, revision, and autonomous schedule state                                |
| `PUT`    | `/api/characters/{source_account_id}/posts`                             | `characters.py`        | Save posts with optimistic revision validation                                                   |
| `PATCH`  | `/api/characters/{source_account_id}/auto-post`                         | `characters.py`        | Enable or disable autonomous posts and select a supported interval                               |
| `POST`   | `/api/characters/{source_account_id}/posts/generate`                    | `characters.py`        | Generate and append one character post through the backend                                       |
| `POST`   | `/api/characters/public/{character_id}/posts/{post_id}/comments`        | `characters.py`        | Add a comment to an accessible public character post                                             |
| `POST`   | `/api/post-likes/query`                                                 | `post_likes.py`        | Batch-load current character like state and canonical counts                                     |
| `PUT`    | `/api/post-likes`                                                       | `post_likes.py`        | Idempotently set a followed post's like state                                                    |
| `GET`    | `/api/discover/characters`                                              | `shared_characters.py` | Return discover character DTOs                                                                   |
| `GET`    | `/api/shared-characters/follower-counts`                                | `shared_characters.py` | Batch follower counts                                                                            |
| `GET`    | `/api/shared-characters/{shared_character_id}`                          | `shared_characters.py` | Load a shared character by ID                                                                    |
| `GET`    | `/api/shared-characters/{shared_character_id}/followers`                | `shared_characters.py` | List followers for a shared character                                                            |
| `PUT`    | `/api/shared-characters/{shared_character_id}/follow`                   | `shared_characters.py` | Follow a shared character                                                                        |
| `DELETE` | `/api/shared-characters/{shared_character_id}/follow`                   | `shared_characters.py` | Unfollow a shared character                                                                      |
| `POST`   | `/api/shared-characters/{shared_character_id}/relationship-follow-back` | `shared_characters.py` | Apply relationship-based follow-back                                                             |
| `GET`    | `/api/characters/{source_account_id}/share`                             | `shared_characters.py` | Find the current user's share ID for a character                                                 |
| `DELETE` | `/api/characters/{source_account_id}`                                   | `characters.py`        | Delete structured state for one local character                                                  |
| `PUT`    | `/api/shared-characters/by-source/{source_account_id}`                  | `shared_characters.py` | Upsert a shared character by local source account ID                                             |
| `PATCH`  | `/api/shared-characters/by-source/{source_account_id}`                  | `shared_characters.py` | Update a shared character snapshot                                                               |
| `DELETE` | `/api/shared-characters/by-source/{source_account_id}`                  | `shared_characters.py` | Delete a shared character snapshot                                                               |
| `POST`   | `/api/follows/sync-owned-snapshot`                                      | `shared_characters.py` | Update follow row snapshots for the current user's character                                     |
| `GET`    | `/api/dm-threads`                                                       | `dm_threads.py`        | Load an owner DM thread by `thread_key` query                                                    |
| `PUT`    | `/api/dm-threads`                                                       | `dm_threads.py`        | Upsert an owner DM thread                                                                        |
| `DELETE` | `/api/dm-threads`                                                       | `dm_threads.py`        | Delete an owner DM thread by `thread_key` query                                                  |
| `GET`    | `/api/shared-dm-threads`                                                | `dm_threads.py`        | Load a shared DM thread by `thread_key` query                                                    |
| `PUT`    | `/api/shared-dm-threads`                                                | `dm_threads.py`        | Upsert a shared DM thread                                                                        |
| `DELETE` | `/api/shared-dm-threads`                                                | `dm_threads.py`        | Delete a shared DM thread by `thread_key` query                                                  |
| `POST`   | `/api/media/upload-intents`                                             | `media.py`             | Create a private/public image upload intent                                                      |
| `POST`   | `/api/media/{asset_id}/complete`                                        | `media.py`             | Verify uploaded bytes and mark an image asset ready                                              |
| `GET`    | `/api/media/{asset_id}/access`                                          | `media.py`             | Return the authenticated asset content URL                                                       |
| `GET`    | `/api/media/{asset_id}/content`                                         | `media.py`             | Stream an authorized media asset                                                                 |
| `GET`    | `/api/safety/consent`                                                   | `moderation.py`        | Read the current terms/safety consent state                                                      |
| `PUT`    | `/api/safety/consent`                                                   | `moderation.py`        | Accept the current terms/safety version                                                          |
| `POST`   | `/api/safety/reports`                                                   | `moderation.py`        | Create a content report                                                                          |
| `GET`    | `/api/safety/blocks`                                                    | `moderation.py`        | List blocked user IDs                                                                            |
| `PUT`    | `/api/safety/blocks/{blocked_id}`                                       | `moderation.py`        | Block a user                                                                                     |
| `DELETE` | `/api/safety/blocks/{blocked_id}`                                       | `moderation.py`        | Unblock a user                                                                                   |
| `GET`    | `/api/moderation/reports`                                               | `moderation.py`        | Read the moderator queue with the moderation key                                                 |
| `PATCH`  | `/api/moderation/reports/{report_id}`                                   | `moderation.py`        | Apply a moderation decision                                                                      |

## Authorization Rules

- Authenticated routes depend on `get_current_user`.
- Sessions are signed backend cookies, not Supabase sessions.
- Google, Apple, and Apps in Toss are the allowed providers; native OAuth uses one-time exchange codes where required.
- Email/password, magic link, Kakao, Naver, and X login are out of scope.
- Repository methods must enforce owner or participant constraints before modifying data.
- Shared DM access requires the current user's ID to be present in `participant_user_ids`.
- Post-like writes require an owned liker character, an active follow row, and an existing target post.
- Character handles are globally unique, lowercase canonical values with a 24-character limit; the database is the final concurrency authority.
- Generic structured-state sync preserves existing database handles, while the dedicated character `PUT` endpoint is the only rename path.
- Shared-character and follower snapshots copy the owned `Character.handle` instead of trusting client snapshots.
- `thread_key` is passed through query/body instead of path parameters to avoid URL encoding issues.
- Media references use `asset:<UUID>`; storage keys and signed/content access remain server-owned.
- Media upload completion verifies ownership, checksum, content type, size, and image dimensions before marking an asset ready.
- Safety consent, reports, and blocks are user-authorized; moderation queue actions require the configured moderation key.

## Database Model Groups

| Group               | Models                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Auth and profile    | `User`, `Profile`                                                                                                 |
| Provider and safety | `AppleOAuthCredential`, `AppleAccountEvent`, `NativeOAuthCode`, `UserPolicyConsent`, `UserBlock`, `ContentReport` |
| Media               | `MediaAsset`                                                                                                      |
| Character state     | `Character`, `UserPersona`                                                                                        |
| AI usage            | `AiDailyUsage`, `AiMonthlyUsage`                                                                                  |
| Public discovery    | `SharedCharacter`, `CharacterFollow`, `CharacterPostLike`                                                         |
| DM state            | `DmThread`, `SharedDmThread`                                                                                      |

## Verification

Current backend verification command:

```bash
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
```

The test count is intentionally not hard-coded here. Run the command against the current migration and dependency environment, and report the exact passed/failed/not-run result. If `backend/.venv/bin/pytest` is unavailable, do not treat backend verification as passed.
