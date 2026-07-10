# Supabase API Client Boundary Report

## 개요

FastAPI 교체 전에 hook/app/feature 계층에서 Supabase 직접 호출을 제거하고, Supabase 구현을 `apps/frontend/src/api/*` 경계로 모았다.

## 변경 내용

- `api/client.ts`: 원격 API 설정/클라이언트 사용 가능 여부와 공통 result helper 추가.
- `api/auth.ts`: Supabase auth sign-in, sign-up, OAuth, session bootstrap, subscription wrapper 추가.
- `api/profiles.ts`: `alive_profiles` load/upsert wrapper 추가.
- `api/discover.ts`: 공유 캐릭터, 팔로워, follow-back RPC wrapper 추가.
- `api/structured.ts`: 구조화 테이블 delete/upsert/load wrapper 추가.
- `api/dm.ts`: DM thread 삭제 wrapper 추가.

## Hook 정리

- `useAliveAuthActions`, `useAliveSessionBootstrap`, `useAliveProfileBootstrap`는 auth/profile API만 호출하도록 변경.
- `useAliveDiscover`, `useAliveDiscoverSync`는 discover API만 호출하도록 변경.
- `useAliveStructuredPersistence`, `useAliveDmLifecycle`는 structured/dm API만 호출하도록 변경.
- `useAliveAutosave`, `useAliveAppStatePersistence`는 profile 저장 API를 사용하도록 변경.
- `useAliveAppController`는 Supabase client import 대신 API config flag를 사용하도록 변경.

## 검증

- `npm run typecheck` 성공
- `npm run test:domain` 성공, 15개 통과
- `npm run test:e2e -- --list` 성공, 3개 테스트 확인
- `npm run build` 성공
- `git diff --check` 성공
- hook/app/feature 계층에서 `supabaseClient`, `.from(`, `.rpc(`, `.auth.` 직접 호출 없음 확인

## 다음 단계

- `src/api/*` 내부 Supabase 구현을 FastAPI client 구현으로 교체.
- `supabaseClient.js`, Supabase env, `@supabase/supabase-js` dependency 제거.
- `useAliveAppController.tsx`의 compatibility shell 타입을 API client DTO 기준으로 좁히기.
