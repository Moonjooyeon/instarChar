---
title: Supabase to FastAPI Backend Plan
author: black (black@ashwoodfriends.com)
created: 2026-06-26
updated: 2026-06-26
version: 0.1.0
status: draft
---

# Supabase to FastAPI Backend Plan

## 목적

현재 프론트엔드가 Supabase Auth/DB 클라이언트로 처리하던 기능을 Python + FastAPI + PostgreSQL 백엔드로 이관한다. 1차 목표는 기존 앱 동작 보존이다. 캐릭터, 피드, DM, 페르소나, 공개 탐색, 팔로우, 온보딩, 로그인 흐름을 유지하면서 Supabase 클라이언트와 Supabase 스키마 의존성을 제거한다.

## 전제

- 백엔드 디렉터리는 아직 없다. `docker-compose.local.yaml`에는 `./backend` 서비스가 선언되어 있지만 실제 `backend/` 폴더는 존재하지 않는다.
- `supabase-schema.sql`과 `db/instarchat-schema.sql`은 모두 Supabase 전용 `auth.users`, `auth.uid()`, RLS 정책에 의존한다.
- FastAPI 전환 시 RLS 대신 API 계층에서 인증된 사용자 ID를 검증하고, 쿼리 조건으로 소유권을 강제해야 한다.
- 초기 이관에서는 JSONB 저장 구조를 유지한다. 캐릭터 포스트/댓글/기억/DM 메시지를 전부 정규화하는 작업은 후속 단계로 둔다.

## Supabase 사용 현황

### 근거 파일

| 근거 | 내용 |
|------|------|
| `src/supabaseClient.js:1` | `@supabase/supabase-js` 클라이언트 생성 |
| `src/supabaseClient.js:3` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 의존 |
| `src/App.jsx:310` | 앱 상태 저장 시 `alive_profiles` 우선 upsert |
| `src/App.jsx:444` | 현재 남아 있는 이메일/비밀번호 signup/signin. 백엔드 이관 대상에서 제외 |
| `src/App.jsx:472` | 현재 남아 있는 magic link 로그인. 백엔드 이관 대상에서 제외 |
| `src/App.jsx:489` | 현재 남아 있는 비밀번호 재설정. 백엔드 이관 대상에서 제외 |
| `src/App.jsx:501` | 현재 Google/Kakao/X OAuth 버튼. 백엔드 이관 시 Google ID와 Apple ID만 허용 |
| `src/App.jsx:542` | 온보딩 프로필 저장 |
| `src/App.jsx:767` | 팔로워 수 계산 |
| `src/App.jsx:827` | 탐색용 공개 캐릭터 목록 로드 |
| `src/App.jsx:884` | 현재 캐릭터 공유 upsert |
| `src/App.jsx:936` | 팔로우 row 스냅샷 동기화 |
| `src/App.jsx:954` | follow/unfollow 저장 |
| `src/App.jsx:990` | 관계 기반 맞팔 RPC 호출 |
| `src/App.jsx:1006` | 캐릭터 삭제 시 구조화 테이블 정리 |
| `src/App.jsx:1039` | 캐릭터/페르소나/DM 구조화 저장 |
| `src/App.jsx:1181` | 구조화 테이블 기반 상태 복원 fallback |
| `src/App.jsx:1365` | Supabase session restore/OAuth callback 처리 |
| `src/App.jsx:1494` | 프로필과 앱 상태 로드 |
| `src/App.jsx:1595` | 앱 상태 변경 debounce 저장 |
| `supabase-schema.sql:1` | `alive_profiles` 정의 |
| `supabase-schema.sql:45` | `alive_shared_characters` 정의 |
| `supabase-schema.sql:96` | `alive_character_follows` 정의 |
| `supabase-schema.sql:136` | `alive_relationship_follow_back` RPC 정의 |
| `supabase-schema.sql:226` | `alive_characters` 정의 |
| `supabase-schema.sql:278` | `alive_personas` 정의 |
| `supabase-schema.sql:321` | `alive_dm_threads` 정의 |
| `supabase-schema.sql:364` | `alive_shared_dm_threads` 정의 |

### 1. 클라이언트 초기화

| 위치 | 역할 |
|------|------|
| `src/supabaseClient.js` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`로 Supabase 클라이언트 생성 |
| `src/App.jsx` | `hasSupabaseConfig` 여부에 따라 로그인/DB 모드와 로컬 저장 모드 분기 |

현재 Supabase 설정이 없으면 앱은 `localStorage`에만 저장된다. 백엔드 전환 후에는 이 분기를 `BACKEND_API_URL` 또는 동일 출처 API 사용 여부로 바꿔야 한다.

### 2. 인증

| 현재 함수 | Supabase 기능 | 백엔드 대체 |
|-----------|---------------|-------------|
| `submitAuth` | 이메일/비밀번호 회원가입, 로그인 | 제거. Google/Apple 로그인만 허용 |
| `sendMagicLoginLink` | 이메일 OTP 로그인 링크 | 제거. Magic link는 지원하지 않음 |
| `sendPasswordReset` | 비밀번호 재설정 메일 | 제거. 자체 비밀번호가 없으므로 불필요 |
| `signInWithProvider` | Google/Kakao/X OAuth | Google ID, Apple ID만 유지. Kakao/Naver/X는 제외 |
| `updateRecoveredPassword` | 복구 세션에서 비밀번호 변경 | 제거. 자체 비밀번호가 없으므로 불필요 |
| `signOut`, `recoverAuthScreen` | 세션 종료와 로컬 Supabase 저장값 삭제 | `POST /api/auth/logout`, 앱 로컬 auth cache 삭제 |
| auth `useEffect` | OAuth callback, session restore, auth state subscription | `GET /api/auth/me` + 쿠키/JWT 세션 확인 |

추천: 1차 백엔드는 Google ID와 Apple ID OAuth만 구현한다. 이메일/비밀번호, magic link, 비밀번호 재설정, Kakao, Naver, X 로그인은 범위에서 제외한다.

### 3. 프로필과 전체 앱 상태 저장

| 현재 테이블 | 현재 용도 | 백엔드 대체 |
|-------------|-----------|-------------|
| `alive_profiles` | 사용자 메타, 온보딩 여부, `app_state` 백업 JSON | `profiles` |

`saveAppStateSnapshot`은 먼저 `alive_profiles.app_state`에 축약된 전체 앱 상태를 저장하고, 실패하면 구조화 테이블 저장으로 전환한다. 이 구조는 백엔드에도 유지하되, FastAPI는 `profile` 저장과 `structured sync`를 한 요청 또는 명시적 두 요청으로 처리해야 한다.

### 4. 구조화 저장

| 현재 테이블 | 현재 용도 | 주요 필드 |
|-------------|-----------|-----------|
| `alive_characters` | 사용자 캐릭터별 핵심 데이터 | `owner_id`, `source_account_id`, `character`, `gallery`, `posts`, `following` |
| `alive_personas` | 사용자 페르소나 | `owner_id`, `persona_id`, `persona` |
| `alive_dm_threads` | 개인/로컬 DM 스레드 | `owner_id`, `thread_key`, `messages`, `world_pref` |
| `alive_shared_dm_threads` | 다른 사용자와 공유되는 DM 스레드 | `thread_key`, `participant_user_ids`, `messages`, `world_pref` |

`syncStructuredState`는 앱 상태를 잘라서 네 테이블에 upsert한다. `loadStructuredStateFallback`은 프로필 백업 JSON을 기본값으로 두고 구조화 테이블 데이터를 덮어쓴다.

### 5. 공개 캐릭터와 탐색

| 현재 함수 | Supabase 기능 | 백엔드 대체 |
|-----------|---------------|-------------|
| `loadSharedCharacters` | `alive_characters`, `alive_shared_characters` 병합 조회 | `GET /api/discover/characters` |
| `loadSharedCharacterById` | 공유 링크 캐릭터 단건 조회 | `GET /api/shared-characters/{id}` |
| `shareCurrentCharacter` | 현재 캐릭터 공개 upsert 후 링크 복사 | `PUT /api/shared-characters/by-source/{source_account_id}` |
| `syncActiveSharedCharacter` | 공개 캐릭터 스냅샷 갱신 | `PATCH /api/shared-characters/by-source/{source_account_id}` |
| active share effect | 내 현재 캐릭터의 공유 ID 조회 | `GET /api/characters/{source_account_id}/share` |

탐색은 현재 공개 테이블과 일반 캐릭터 테이블을 병합한다. 1차 백엔드에서는 프론트 병합 로직을 줄이기 위해 API가 이미 병합된 discover DTO를 반환하는 편이 낫다.

### 6. 팔로우와 맞팔

| 현재 함수 | Supabase 기능 | 백엔드 대체 |
|-----------|---------------|-------------|
| `loadFollowerCountsFor` | 대상 공유 캐릭터별 팔로워 수 계산 | `GET /api/shared-characters/follower-counts?ids=...` |
| `loadSharedFollowers` | 팔로워 목록 조회 | `GET /api/shared-characters/{id}/followers` |
| `recordFollowChange` | follow upsert/delete | `PUT /api/shared-characters/{id}/follow`, `DELETE /api/shared-characters/{id}/follow` |
| `syncOwnFollowRows` | 내 팔로우 row의 캐릭터 스냅샷 갱신 | `POST /api/follows/sync-owned-snapshot` |
| `recordRelationshipFollowBack` | `alive_relationship_follow_back` RPC 호출 | `POST /api/shared-characters/{id}/relationship-follow-back` |

Supabase RPC `alive_relationship_follow_back`는 백엔드 서비스 함수로 옮긴다. 조건은 기존과 동일하게 유지한다: 호출자는 대상 캐릭터의 owner여야 하고, 대상이 이미 상대를 팔로우 중이며, 양쪽 관계 텍스트가 연인/애인/부부/약혼/반려 계열을 포함해야 한다.

### 7. 삭제

| 현재 함수 | 삭제 대상 |
|-----------|-----------|
| `deleteStructuredCharacterAccount` | 내 캐릭터 row, 공개 캐릭터 row, 팔로우 row, 해당 캐릭터 owner DM |
| `deleteDmThread` | 개인 DM 또는 공유 DM 단건 삭제 후 구조화 상태 재동기화 |

FastAPI에서는 삭제를 트랜잭션으로 묶어야 한다. 현재 프론트는 `Promise.allSettled`라 일부 삭제 실패가 가능하다.

## 제안 백엔드 구조

```text
backend/
├── Dockerfile
├── requirements.txt
├── alembic.ini
├── migrations/
│   ├── env.py
│   └── versions/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── deps.py
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── profiles.py
│   │       ├── characters.py
│   │       ├── shared_characters.py
│   │       ├── follows.py
│   │       ├── dm_threads.py
│   │       └── ai.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── errors.py
│   ├── db/
│   │   ├── base.py
│   │   └── session.py
│   ├── models/
│   ├── repositories/
│   ├── schemas/
│   ├── services/
│   └── tests/
```

## 데이터 모델 초안

| 모델 | 핵심 컬럼 | 비고 |
|------|-----------|------|
| `users` | `id`, `email`, `provider`, `provider_subject`, `created_at`, `updated_at` | Supabase `auth.users` 대체. `provider`는 `google` 또는 `apple`만 허용 |
| `profiles` | `user_id`, `display_name`, `onboarded`, `app_state` | `alive_profiles` 대체 |
| `characters` | `owner_id`, `source_account_id`, `name`, `handle`, `character`, `gallery`, `posts`, `following` | JSONB 유지 |
| `personas` | `owner_id`, `persona_id`, `name`, `persona` | JSONB 유지 |
| `shared_characters` | `owner_id`, `owner_name`, `source_account_id`, `name`, `handle`, `persona`, `tags`, `character` | 공개 탐색 대상 |
| `character_follows` | `follower_id`, `follower_name`, `follower_account_id`, `follower_character`, `target_shared_character_id` | 유니크 제약 유지 |
| `dm_threads` | `owner_id`, `thread_key`, `messages`, `world_pref` | 개인/로컬 DM |
| `shared_dm_threads` | `thread_key`, `participant_user_ids`, `participant_labels`, `messages`, `world_pref`, `created_by` | 참여자 검증 필요 |

초기 구현에서는 기존 JSON shape를 그대로 받는다. API 경계에서 Pydantic은 최상위 필드만 엄격히 검증하고, `character`, `posts`, `messages`, `world_pref` 내부는 `dict[str, object]`와 `list[object]`로 받는다.

## API 초안

| Method | Path | 기능 |
|--------|------|------|
| `GET` | `/api/auth/google/start` | Google OAuth 시작 |
| `GET` | `/api/auth/google/callback` | Google OAuth callback 처리 후 HttpOnly 세션 쿠키 발급 |
| `GET` | `/api/auth/apple/start` | Apple OAuth 시작 |
| `POST` | `/api/auth/apple/callback` | Apple OAuth callback 처리 후 HttpOnly 세션 쿠키 발급 |
| `POST` | `/api/auth/logout` | 세션 종료 |
| `GET` | `/api/auth/me` | 현재 사용자와 프로필 요약 |
| `GET` | `/api/profile/state` | 프로필 백업 + 구조화 상태 병합 조회 |
| `PUT` | `/api/profile/state` | `app_state` 백업 저장 |
| `POST` | `/api/profile/structured-state` | 캐릭터/페르소나/DM 구조화 upsert |
| `POST` | `/api/profile/onboarding` | display name과 onboarded 저장 |
| `DELETE` | `/api/characters/{source_account_id}` | 캐릭터 관련 구조화 데이터 삭제 |
| `GET` | `/api/discover/characters` | 공개 탐색 목록 |
| `GET` | `/api/shared-characters/{shared_character_id}` | 공유 캐릭터 단건 조회 |
| `PUT` | `/api/shared-characters/by-source/{source_account_id}` | 내 캐릭터 공개 upsert |
| `PATCH` | `/api/shared-characters/by-source/{source_account_id}` | 공개 스냅샷 갱신 |
| `GET` | `/api/characters/{source_account_id}/share` | 현재 캐릭터 공유 ID 조회 |
| `GET` | `/api/shared-characters/follower-counts` | 공유 캐릭터별 팔로워 수 |
| `GET` | `/api/shared-characters/{shared_character_id}/followers` | 팔로워 목록 |
| `PUT` | `/api/shared-characters/{shared_character_id}/follow` | 팔로우 저장 |
| `DELETE` | `/api/shared-characters/{shared_character_id}/follow` | 언팔로우 |
| `POST` | `/api/shared-characters/{shared_character_id}/relationship-follow-back` | 연인 관계 맞팔 자동 처리 |
| `DELETE` | `/api/dm-threads/{thread_key}` | 개인/공유 DM 삭제 |
| `POST` | `/api/ai/generate` | 기존 `/api/generate` FastAPI 이관 |

## 데이터 흐름

```text
React App
  |
  | login / session restore
  v
FastAPI Auth
  |
  | current_user dependency
  v
Service Layer
  |
  | owner_id / participant check
  v
PostgreSQL

State save:
React exportAppState()
  -> PUT /api/profile/state
  -> POST /api/profile/structured-state
  -> profiles + characters + personas + dm tables

Discover:
React discover screen
  -> GET /api/discover/characters
  -> shared_characters + characters + character_follows counts
  -> merged DTO
```

## 구현 단계

### Phase 0. 스키마 결정

- [x] `auth.users`, `auth.uid()`, RLS 제거 버전의 Alembic migration 설계
- [x] `users` 테이블과 세션 전략 결정: signed JWT HttpOnly cookie
- [x] 기존 `db/instarchat-schema.sql`은 Supabase 전용이므로 FastAPI용 초기 스키마로 교체

검증: 마이그레이션 SQL이 빈 PostgreSQL 16 DB에 적용되는지 확인한다.

### Phase 1. FastAPI 골격

- [x] `backend/` 디렉터리 생성
- [x] FastAPI 앱, async SQLAlchemy, Alembic, settings, error handler 구성
- [x] Dockerfile과 `docker-compose.local.yaml`의 실제 빌드 경로 정합성 확인
- [x] `/health` 추가

검증: 기존 실행 중인 프로세스가 있으면 `/health`만 호출한다. 없으면 사용자가 실행할 수 있는 명령 가이드를 제공한다.

### Phase 2. 인증 1차

- [x] Google ID OAuth 시작/callback, 로그아웃, 현재 사용자 조회
- [x] Apple ID OAuth 시작/callback, 로그아웃, 현재 사용자 조회
- [x] provider가 `google` 또는 `apple`이 아닌 요청은 거부
- [x] 세션 쿠키, CORS, CSRF 정책 정의
- [ ] 프론트의 Supabase session 객체 의존을 백엔드 user DTO로 대체
- [ ] 이메일/비밀번호, magic link, 비밀번호 재설정 UI 제거
- [ ] Kakao/Naver/X 로그인 UI와 provider 처리 제거

검증: pytest로 Google callback, Apple callback, provider 중복 계정 처리, 허용되지 않은 provider 거부, 로그아웃 후 보호 API 차단을 확인한다.

검증 기록:

- [x] 2026-06-26: `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests` 통과. 결과: 11 passed.
- [x] 2026-06-26: 프론트 변경사항 롤백 후 `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests` 재실행 통과.

### Phase 3. 프로필과 앱 상태

- [x] `GET /api/profile/state`에서 `profiles.app_state` + 구조화 테이블 fallback 동작 재현
- [x] `PUT /api/profile/state`에서 compact profile backup 저장
- [x] `POST /api/profile/structured-state`에서 캐릭터/페르소나/DM upsert
- [ ] 프론트 저장 debounce는 유지하되 Supabase 호출을 API client로 교체

검증: 기존 로컬 앱 상태 fixture를 저장 후 다시 불러와 동일한 `accounts`, `personas`, `dmThreads`가 복원되는지 확인한다.

검증 기록:

- [x] 2026-06-26: 백엔드 profile API 테스트 추가 후 `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests` 통과. 결과: 15 passed.

### Phase 4. 공개 캐릭터와 탐색

- [x] 공유 캐릭터 upsert/patch/delete 구현
- [x] 공유 링크 단건 조회 구현
- [x] 탐색 API에서 공개 캐릭터와 캐릭터 요약 병합 반환
- [x] 팔로워 수 batch 조회 지원

검증: 서로 다른 두 사용자 fixture로 내 캐릭터 제외, 공개 캐릭터 조회, 공유 링크 조회를 테스트한다.

검증 기록:

- [x] 2026-06-26: 백엔드 shared character API 테스트 추가 후 `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests` 통과. 결과: 19 passed.

### Phase 5. 팔로우와 관계 맞팔

- [x] follow/unfollow API 구현
- [x] 팔로워 목록 조회 구현
- [x] `alive_relationship_follow_back` 로직을 Python service로 이관
- [x] follow row의 `follower_character` snapshot 갱신 API 구현

검증: 이미 팔로우한 row 중복 방지, 언팔 후 count 감소, 상호 연인 관계일 때만 자동 맞팔 되는지 테스트한다.

검증 기록:

- [x] 2026-06-26: 백엔드 follow API와 relationship follow-back 테스트 추가 후 `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests` 통과. 결과: 25 passed.

### Phase 6. DM

- [x] owner DM과 shared DM 저장/조회/삭제 API 구현
- [x] `thread_key` 기반 삭제를 URL-safe 방식으로 처리한다. 필요하면 path 대신 query/body로 받는다.
- [x] shared DM은 `participant_user_ids`에 현재 사용자가 포함될 때만 조회/수정/삭제 가능하게 한다.

검증: 참여자가 아닌 사용자의 shared DM 접근이 403인지 테스트한다.

검증 기록:

- [x] 2026-06-26: 백엔드 DM API와 shared DM participant 403 테스트 추가 후 `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests` 통과. 결과: 32 passed.

### Phase 7. AI generate 이관

- [ ] 기존 `api/generate.js`를 FastAPI `/api/ai/generate`로 이관
- [ ] 일일/월간 사용량 제한을 메모리 기반에서 DB 기반으로 변경
- [ ] 프론트 fetch 경로를 새 API로 통일하거나 Vite proxy를 추가

검증: Playwright에서 `/api/generate` route mock을 새 경로로 바꾸고 기존 E2E가 유지되는지 확인한다.

### Phase 8. Supabase 제거

- [ ] `src/supabaseClient.js` 삭제
- [ ] `@supabase/supabase-js` 제거
- [ ] `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 제거
- [ ] Supabase 전용 README/스키마 문구 갱신

검증: `rg "supabase|VITE_SUPABASE|auth.uid|auth.users"`가 의도한 마이그레이션 참고 문서 외에는 남지 않아야 한다.

## 테스트 계획

| 범위 | 테스트 |
|------|--------|
| Auth | Google callback, Apple callback, logout/me, duplicate provider account, disallowed provider, expired session |
| Profile state | empty profile, local backup import, structured fallback, profile save failure |
| Characters | character upsert, delete cascade-like cleanup, active share lookup |
| Discover | public list, shared link missing, follower counts, current user filtering |
| Follow | follow, unfollow, duplicate follow, snapshot sync |
| Relationship follow-back | mutual love success, one-sided relation fail, caller not owner fail |
| DM | owner thread CRUD, shared participant access, non-participant 403, deleted tombstone |
| AI | valid response, empty response retry, rate limit exceeded |
| Frontend E2E | login gate, create character, save/reload, share/follow, DM delete |

## 주요 위험

| 위험 | 영향 | 대응 |
|------|------|------|
| OAuth provider별 요구사항이 다르다 | Google과 Apple callback 검증 방식 차이로 인증 버그 가능 | 1차 provider를 Google/Apple로만 제한하고 provider별 테스트 작성 |
| RLS 제거 | 소유권 검증 누락 시 타 사용자 데이터 노출 | 모든 repository 메서드에 `owner_id` 또는 participant 조건 필수 |
| JSONB shape 불명확 | Pydantic을 과하게 엄격히 만들면 기존 상태 복원 실패 | 1차는 최상위 계약만 검증 |
| shared DM thread key | path parameter로 쓰기 어려운 문자가 포함될 수 있음 | body 또는 query 기반 삭제 API 사용 |
| 현재 삭제가 부분 성공 가능 | FastAPI 이관 후 데이터 불일치 가능 | 삭제 서비스는 트랜잭션 처리 |
| DB 스키마가 Supabase 전용 | 로컬 PostgreSQL에서 `auth.users`가 없음 | `users` 기준 새 migration 작성 |

## NOT in scope

- 캐릭터 포스트/댓글/기억을 완전 정규화하는 작업: 기존 UI 상태 shape 보존이 먼저다.
- 이메일/비밀번호, magic link, password reset 메일: Google ID와 Apple ID만 허용하므로 구현하지 않는다.
- Kakao, Naver, X 로그인: 명시적으로 제외한다.
- 기존 React 단일 파일 구조 리팩터링: 백엔드 이관과 별도 작업이다.
- 모바일 native 인증 SDK 연동: Capacitor 앱 shell은 유지하되 웹 기반 API 인증부터 완성한다.

## 완료 기준

- Supabase 환경변수 없이 Google ID 또는 Apple ID로 로그인하고, 저장, 복원, 공유, 탐색, 팔로우, DM 삭제가 동작한다.
- `@supabase/supabase-js`와 `src/supabaseClient.js`를 제거해도 앱이 빌드된다.
- FastAPI 테스트가 인증/소유권/공개 탐색/DM participant 경계를 검증한다.
- 기존 Playwright 핵심 플로우가 새 API mock 또는 테스트 백엔드 기준으로 통과한다.
