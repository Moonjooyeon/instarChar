---
title: Supabase to FastAPI Frontend Integration Plan
author: Codex
created: 2026-07-10
updated: 2026-07-10
version: 0.1.0
status: draft
branch: supabase-to-fastapi
---

# Supabase to FastAPI Frontend Integration Plan

## 목적

Supabase client 구현을 FastAPI HTTP API 구현으로 교체하고, 프론트에서 Supabase dependency를 제거한다. 기존 앱 동작은 보존한다: 로그인 상태 복원, 프로필/앱 상태 저장과 복원, 공개 캐릭터 탐색, 공유, 팔로우, 관계 맞팔, DM 삭제, AI generate.

## 현재 상태

- 백엔드 `backend/`는 이미 FastAPI, async SQLAlchemy, Alembic, auth/profile/shared character/DM API를 갖고 있다.
- 프론트 직접 Supabase 호출은 `apps/frontend/src/api/*` 경계 내부로 모여 있다.
- `apps/frontend/src` 아래 남은 JavaScript 파일은 `supabaseClient.js`뿐이다.
- 제거 대상 dependency는 `apps/frontend/package.json`의 `@supabase/supabase-js`다.
- 남은 큰 전환 지점은 `apps/frontend/src/api/auth.ts`, `profiles.ts`, `discover.ts`, `structured.ts`, `dm.ts`, `client.ts`, `generate.ts`다.

## 권장 전략

Big bang으로 `supabaseClient.js`부터 삭제하지 않는다. 먼저 FastAPI fetch client를 넣고 API별로 같은 함수 이름과 반환 shape를 최대한 유지한다. 이렇게 하면 hook/app 계층 변경량을 줄이고, 마지막 단계에서 Supabase 파일과 dependency를 안전하게 제거할 수 있다.

```text
React hooks/app
  |
  | existing function names
  v
apps/frontend/src/api/*
  |
  | fetch + credentials: "include"
  v
FastAPI /api/*
  |
  | current_user dependency
  v
PostgreSQL
```

## Phase 1. 공통 HTTP client 만들기

작업:

- [x] `apps/frontend/src/api/client.ts`를 Supabase adapter에서 fetch 기반 client로 전환한다.
- [x] `VITE_API_BASE_URL`이 있으면 그 값을 쓰고, 없으면 same-origin `/api`를 사용한다.
- [x] 모든 요청은 `credentials: "include"`를 기본값으로 둔다.
- [x] JSON 응답, 빈 204 응답, FastAPI `{ detail }` 에러를 현재 `ApiResult`/`ApiError` 형태로 변환한다.
- [x] `hasRemoteApiConfig`, `hasRemoteApiClient`는 FastAPI 기준으로 재정의한다. FastAPI 미동작 시 앱 접근 불가 결정에 따라 remote API는 항상 필수로 간주한다.

검증:

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] 새 client 유닛 테스트를 추가한다면 204, JSON, 401/403 detail 변환을 포함한다.

## Phase 2. Auth 전환

작업:

- [x] `apps/frontend/src/api/auth.ts`에서 `@supabase/supabase-js` 타입 import를 제거한다.
- [x] Google/Apple OAuth start는 `window.location.assign(apiUrl("/auth/google/start"))` 또는 호출자가 URL을 열 수 있는 함수로 제공한다.
- [x] `GET /api/auth/me`를 `getAuthSession` 대체 경로로 사용한다.
- [x] `POST /api/auth/logout`을 `signOutAuthSession`에 연결한다.
- [x] 이메일/비밀번호, magic link, password reset, password recovery 함수는 제거하거나 호출부 UI와 함께 정리한다.
- [x] `AuthChangeEvent`, `Session` 중심 흐름을 backend user DTO 중심으로 바꾼다.
- [x] `useAliveSessionBootstrap`, `useAliveAuthActions`, `AuthScreens`에서 Supabase callback/hash/session 복원 의존을 걷어낸다.

검증:

- [x] 백엔드 auth 테스트: `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests`
- [x] 프론트 typecheck: `npm run typecheck`
- [x] 프론트 domain tests: `npm run test:domain`
- [x] E2E 목록: `npm run test:e2e -- --list`
- [x] 프론트 build: `npm run build`

주의:

- FastAPI는 HttpOnly cookie 세션을 쓰므로 프론트는 access token을 직접 읽지 않는다.
- 기존 `session.user.id`, `session.user.email`, `session.user.user_metadata.display_name` 접근부를 backend `MeResponse` shape로 맞춰야 한다.

## Phase 3. Profile/state 저장과 복원 전환

작업:

- [x] `profiles.ts`
  - [x] `upsertProfile` -> `PUT /api/profile/state` 또는 `POST /api/profile/onboarding`으로 분기한다.
  - [x] `loadProfileRow` -> `GET /api/profile/state`를 호출하고, 기존 `ProfileRow` shape로 adapter한다.
  - [x] `createProfileShell`은 onboarding/profile state API로 연결한다.
- [x] `structured.ts`
  - [x] `syncStructuredRows` -> `POST /api/profile/structured-state`
  - [x] `loadStructuredRows` -> `GET /api/profile/state` 결과를 기존 settled query 결과 형태로 adapter하거나, 호출 hook을 새 응답 shape에 맞게 단순화한다.
  - [x] `deleteStructuredCharacterData` -> `DELETE /api/characters/{source_account_id}`로 전환한다. 이 endpoint는 프론트 전환 전에 먼저 추가하고, 캐릭터 row, 공개 row, follow row, owner DM row를 트랜잭션 안에서 정리한다.

검증:

- [x] 저장 후 복원 domain fixture 테스트 추가 또는 기존 hook 경로 최소 테스트.
- [x] `npm run typecheck`
- [x] `npm run test:domain`
- [x] `npm run build`
- [x] `npm run test:e2e -- --list`
- [x] `PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache backend/.venv/bin/python -m compileall -q backend/app backend/tests backend/migrations`
- [x] `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests`

## Phase 4. Discover/share/follow 전환

작업:

- `discover.ts` 함수들을 FastAPI 라우터에 매핑한다.
- `sharedCharacterResults()`는 `GET /api/discover/characters` 단일 응답으로 단순화한다.
- `listFollowerTargetRows(ids)`는 가능하면 `GET /api/shared-characters/follower-counts?ids=...`로 대체한다.
- `listSharedFollowers(sharedId)` -> `GET /api/shared-characters/{id}/followers`
- `loadSharedCharacterRow(sharedId)` -> `GET /api/shared-characters/{id}`
- `upsertSharedCharacter(payload)` -> `PUT /api/shared-characters/by-source/{source_account_id}`. payload에서 `source_account_id`를 꺼내는 adapter가 필요하다.
- `updateSharedCharacter(ownerId, sourceAccountId, payload)` -> `PATCH /api/shared-characters/by-source/{sourceAccountId}`. `ownerId`는 프론트에서 넘기지 않도록 점진 정리한다.
- `deleteFollowRow` -> `DELETE /api/shared-characters/{id}/follow?follower_account_id=...`
- `upsertFollowRow` -> `PUT /api/shared-characters/{id}/follow`
- `saveRelationshipFollowBack(poolSharedId, activeSharedId)` -> `POST /api/shared-characters/{activeSharedId}/relationship-follow-back`
- `loadActiveSharedCharacterId` -> `GET /api/characters/{source_account_id}/share`
- `upsertOwnFollowRows` -> `POST /api/follows/sync-owned-snapshot`

검증:

- backend shared character/follow tests.
- frontend typecheck/domain tests.
- discover/follow E2E는 현재 mock 기반이면 route mock을 FastAPI shape로 갱신한다.

## Phase 5. DM API 전환

작업:

- `dm.ts`의 `deleteDmThreadRow`를 FastAPI query endpoint로 전환한다.
- `thread_key`가 `dm::`이면 `DELETE /api/shared-dm-threads?thread_key=...`
- 아니면 `DELETE /api/dm-threads?thread_key=...`
- `ownerId` 인자는 API 계층 내부에서 무시하고, 후속 정리에서 호출부 인자를 제거한다.

검증:

- backend DM tests.
- DM 삭제 관련 frontend typecheck와 E2E 목록.

## Phase 6. AI generate 이관

작업:

- `backend/app/api/v1/ai.py`를 추가해 `/api/ai/generate`를 구현한다.
- 기존 `api/generate.js`의 request/response/error shape를 유지한다.
- provider key, model, limit 설정은 backend settings로 옮긴다.
- 프론트 `generate.ts`의 기본 경로를 `/api/ai/generate`로 바꾼다.
- Vercel/serverless용 `api/generate.js`는 FastAPI 전환이 검증되면 제거한다.

검증:

- backend AI route 테스트: 성공, 빈 응답, provider error, limit exceeded.
- frontend generate parser 테스트가 있으면 경로만 교체.
- `npm run build`

## Phase 7. Supabase 제거

작업:

- `apps/frontend/src/supabaseClient.js` 삭제.
- `apps/frontend/package.json`에서 `@supabase/supabase-js` 제거.
- `package-lock.json` 갱신.
- `apps/frontend/src/types/env.d.ts`에서 `VITE_SUPABASE_*` 제거, 필요한 경우 `VITE_API_BASE_URL` 추가.
- `rg "supabase|VITE_SUPABASE|@supabase|auth.uid|auth.users"`로 남은 참조를 점검한다.
- `supabase-schema.sql`은 역사/참고 자료로 둘지 삭제할지 결정한다. 삭제하지 않는다면 문서에서 legacy reference로 명확히 표시한다.

검증:

- `npm run typecheck`
- `npm run test:domain`
- `npm run test:e2e -- --list`
- `npm run build`
- `PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache backend/.venv/bin/python -m compileall -q backend/app backend/tests backend/migrations`
- `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests`

## 누락 항목 결정사항

1. 캐릭터 삭제 정리 endpoint는 추가한다. `DELETE /api/characters/{source_account_id}`가 캐릭터 row, 공개 row, follow row, owner DM row를 트랜잭션 안에서 정리한다.
2. `sharedCharacterResults()`는 작업하면서 확인한다. 기존에는 공개 캐릭터와 일반 캐릭터 row를 프론트에서 병합했으므로, discover 전환 중 백엔드 `DiscoverResponse`가 현재 UI 기대 필드를 모두 담는지 schema를 대조한다.
3. Auth UI는 Google/Apple만 남긴다. 이메일/비밀번호, magic link, password reset 화면과 상태값은 제거한다.
4. Local-only fallback은 제거한다. FastAPI가 동작하지 않으면 앱 접근은 불가능한 상태로 간주한다.
5. 모바일 Capacitor cookie session은 확인한다. 웹 same-origin보다 까다로울 수 있으므로 전환 완료 후 실제 shell에서 수동 검증한다.

## 커밋 단위 제안

1. `refactor(frontend): add fastapi http client`
2. `refactor(frontend): switch auth to backend session`
3. `refactor(frontend): switch profile state api to fastapi`
4. `refactor(frontend): switch discover follow api to fastapi`
5. `refactor(frontend): switch dm api to fastapi`
6. `feat(backend): add ai generate endpoint`
7. `refactor(frontend): remove supabase dependency`

## 완료 기준

- Supabase 환경변수 없이 앱이 빌드된다.
- `@supabase/supabase-js` 없이 typecheck/build가 통과한다.
- FastAPI 세션으로 저장, 복원, 공유, 탐색, 팔로우, 관계 맞팔, DM 삭제가 동작한다.
- Supabase 참조는 legacy 문서 또는 마이그레이션 참고 파일에만 남는다.
