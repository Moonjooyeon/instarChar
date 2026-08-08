---
title: 모노레포 프론트엔드 재구성 Phase 0 기준선
author: black (black@ashwoodfriends.com)
created: 2026-07-03
updated: 2026-07-03
version: 0.1.0
status: draft
---

# 모노레포 프론트엔드 재구성 Phase 0 기준선

## 목적

`plan_monorepo-frontend-restructure_2026-07-03.md`의 Phase 0 결과를 기록한다. 이 문서는 이동 전 파일 규모, 외부 접점, local mode E2E 기준을 고정해 이후 `apps/frontend` 이동과 controller 분해 중 회귀 원인을 분리하기 위한 기준선이다.

## 전제와 성공 기준

- 코드 변경은 하지 않는다.
- 기준선은 2026-07-03 현재 워크트리의 frontend 루트 구조 기준이다.
- 앱 프로세스는 새로 시작하지 않는다.
- 검증은 파일 상태와 정적 검색 결과로 한다.

## 주요 파일 규모

| 파일 | 라인 수 | 현재 책임 |
|------|---------|-----------|
| `src/hooks/useAliveAppController.jsx` | 4,658 | 앱 상태, 인증, 저장, 라우팅, 생성 API 호출, DM/feed/relationship 로직 |
| `src/components/AppView.jsx` | 1,184 | 최상위 화면 composition, controller context 구조분해, 화면별 props 연결 |
| `src/appStyles.js` | 990 | 앱 전역 CSS 문자열 |

확인 명령:

```bash
wc -l src/hooks/useAliveAppController.jsx src/components/AppView.jsx src/appStyles.js
```

## import graph 기준선

`src/hooks/useAliveAppController.jsx`가 현재 대부분의 dependency를 직접 소유한다.

| 영역 | 현재 위치 | 관찰 내용 |
|------|-----------|-----------|
| Supabase client | `src/hooks/useAliveAppController.jsx:2`, `src/supabaseClient.js` | controller가 `hasSupabaseConfig`, `supabase`를 직접 import하고 auth/profile/shared character/DM persistence를 호출한다. |
| Style dependency | `src/hooks/useAliveAppController.jsx:3` | controller가 `css`를 직접 import한다. 구조 이동 시 UI/style 경계가 섞여 있음을 주의한다. |
| Domain utilities | `src/hooks/useAliveAppController.jsx:4-36` | discover/feed/relationship/alive core utility가 controller로 직접 모인다. |
| Feature screens | `src/hooks/useAliveAppController.jsx:9-16` | auth, discover, DM, home, setup, relationship components가 controller에서 직접 import된다. |
| Supabase package | `package.json` | `@supabase/supabase-js`가 runtime dependency로 남아 있다. 제거는 이번 계획 범위가 아니다. |

Supabase 관련 검색 기준:

```bash
rg -c "supabase|hasSupabaseConfig" src api tests vite.config.js package.json
```

검색 결과 요약:

| 파일 | 매치 수 |
|------|---------|
| `src/hooks/useAliveAppController.jsx` | 86 |
| `src/supabaseClient.js` | 6 |
| `src/components/AppView.jsx` | 4 |
| `src/components/DiscoverScreen.jsx` | 3 |
| `src/components/HomeScreen.jsx` | 3 |
| `package.json` | 1 |

## `/api/generate` 접점

현재 AI 생성 호출은 Vercel/serverless endpoint와 Vite middleware를 통한다.

| 파일 | 역할 |
|------|------|
| `api/generate.js` | `/api/generate` serverless handler |
| `vite.config.js` | local dev에서 `/api/generate` middleware 연결 |
| `src/hooks/useAliveAppController.jsx` | `fetch("/api/generate", ...)` 호출을 여러 flow에서 직접 수행 |
| `tests/e2e/alive-flow.spec.js` | Playwright route로 `**/api/generate` mock 응답 제공 |

검색 결과:

```bash
rg -c 'fetch\("/api/generate"|/api/generate' src api tests vite.config.js
```

| 파일 | 매치 수 |
|------|---------|
| `src/hooks/useAliveAppController.jsx` | 11 |
| `vite.config.js` | 2 |
| `api/generate.js` | 1 |
| `tests/e2e/alive-flow.spec.js` | 1 |

## localStorage 접점

local mode persistence는 `alive_app_state_v1`를 중심으로 동작한다.

| 파일 | 역할 |
|------|------|
| `src/aliveCore.js` | `LOCAL_STATE_KEY` 정의 |
| `src/hooks/useAliveAppController.jsx` | local snapshot migration, load/save, Supabase logout cleanup |
| `tests/e2e/alive-flow.spec.js` | reload 전 `localStorage.getItem("alive_app_state_v1")`로 저장 완료 확인 |

검색 결과:

```bash
rg -c "localStorage|LOCAL_STATE_KEY" src tests
```

| 파일 | 매치 수 |
|------|---------|
| `src/hooks/useAliveAppController.jsx` | 8 |
| `src/aliveCore.js` | 1 |
| `tests/e2e/alive-flow.spec.js` | 1 |

## navigation 접점

라우팅은 React Router 없이 `window.history`와 `window.location`을 controller에서 직접 다룬다.

| 영역 | 현재 위치 | 관찰 내용 |
|------|-----------|-----------|
| route helpers | `src/aliveCore.js` | `pathForStep`, `stepFromPath`가 core utility에 있다. |
| history sync | `src/hooks/useAliveAppController.jsx:1689-1745` | `replaceState`, `pushState`, `popstate`를 controller effect에서 직접 관리한다. |
| OAuth/shared query handling | `src/hooks/useAliveAppController.jsx` | `window.location.href`, `search`, `hash`, `history.replaceState`가 auth/shared flow와 섞여 있다. |

검색 결과:

```bash
rg -c "window\.history|window\.location|location\.hash|location\.search|pushState|replaceState|popstate|stepFromPath|pathForStep" src tests
```

| 파일 | 매치 수 |
|------|---------|
| `src/hooks/useAliveAppController.jsx` | 26 |
| `src/aliveCore.js` | 2 |

## E2E local mode 기준선

현재 E2E는 `tests/e2e/alive-flow.spec.js` 단일 파일이다.

- Playwright config의 `baseURL`은 `http://127.0.0.1:5179`이다.
- `webServer.command`는 `npm run dev -- --host 127.0.0.1 --port 5179`이다.
- `webServer.env`에서 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 빈 문자열로 둔다.
- 테스트는 `page.route("**/api/generate", ...)`로 생성 API를 mock한다.
- reload 유지 검증은 `alive_app_state_v1` localStorage snapshot을 기준으로 한다.

주의: 저장소 규칙상 Codex가 앱 프로세스를 직접 새로 시작하지 않는다. 따라서 Phase 0에서는 E2E를 실행하지 않고, local mode 중심이라는 사실만 기준선으로 문서화한다.

## Phase 0 검토

- [x] 주요 파일 line count 기록
- [x] Supabase 접점 기록
- [x] `/api/generate` 접점 기록
- [x] localStorage 접점 기록
- [x] navigation 접점 기록
- [x] 기존 E2E가 local mode 중심임을 문서화
- [x] 코드 변경 없음
