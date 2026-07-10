---
title: 모노레포 및 프론트엔드 재구성 계획
author: Codex
created: 2026-07-03
updated: 2026-07-03
version: 0.1.33
status: draft
---

# 모노레포 및 프론트엔드 재구성 계획

## 목적

FastAPI 교체를 바로 진행하기 전에, 프로젝트 전체를 모노레포 구조로 재정렬하고 프론트엔드 코드를 guideline에 맞게 파악 가능한 단위로 나눈다. 현재 `src/hooks/useAliveAppController.jsx`가 약 4,658줄, `src/components/AppView.jsx`가 약 1,184줄이라 API 교체를 먼저 하면 변경 원인과 회귀 원인을 분리하기 어렵다.

이 계획의 1차 성공 기준은 기능 변화가 아니라 구조 안정화다. 즉, 기존 local mode 동작을 보존하면서 파일 위치, import 경계, 모듈 책임을 정리한다.

## 전제

- 이 계획은 `documents/plans/plan_refactor-continuation_2026-07-03.md`보다 먼저 실행한다.
- Supabase를 FastAPI로 교체하는 작업은 이 계획 이후로 미룬다.
- 백엔드 기능 구현은 건드리지 않는다. 모노레포 경로 정리 차원에서 `backend/` 위치를 어떻게 둘지만 결정한다.
- 앱 프로세스를 직접 새로 시작하지 않는다. 검증은 build/test 명령 또는 이미 실행 중인 프로세스 기준으로 한다.
- 프론트엔드 guideline의 핵심 원칙을 적용한다:
  - TypeScript 도입 준비
  - `@/` path alias 사용
  - API 호출은 component에서 직접 하지 않고 API client 경유
  - component는 200줄 이하를 목표로 분리
  - business logic은 custom hook 또는 domain utility로 추출
  - 함수는 짧고 명시적으로 유지

## 현재 문제

```text
현재 구조

.
├── src/                         # 프론트엔드 소스가 루트에 있음
│   ├── App.jsx
│   ├── hooks/useAliveAppController.jsx   # 약 4,658줄
│   ├── components/AppView.jsx            # 약 1,184줄
│   ├── appStyles.js                      # 약 990줄
│   └── *.js utilities
├── backend/                     # FastAPI backend
├── api/generate.js              # Vercel/serverless AI endpoint
├── public/
├── tests/e2e/
├── vite.config.js
├── playwright.config.js
├── capacitor.config.json        # webDir: "dist"
├── android/
└── ios/
```

문제:

- frontend, backend, mobile shell, serverless API가 루트에 섞여 있다.
- 프론트엔드 앱의 진입점, feature, domain logic, persistence, UI state가 한 hook에 뭉쳐 있다.
- `AppView.jsx`가 거대한 `ctx` 객체를 구조분해해서 실제 화면 책임을 파악하기 어렵다.
- guideline은 TypeScript, `@/` alias, `packages/api-client`, `packages/contracts`를 전제로 하지만 현재는 JavaScript 단일 Vite 앱이다.
- `capacitor.config.json`은 루트 `dist`를 바라보므로 프론트 폴더 이동 시 mobile sync 경로 조정이 필요하다.

## 추천 목표 구조

`npm workspaces` 기반의 보수적인 모노레포를 추천한다. 이미 `package-lock.json`이 있으므로 pnpm/turborepo 같은 도구를 새로 도입하지 않는다. 먼저 boring한 npm workspace로 충분하다.

```text
.
├── apps/
│   └── frontend/
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── public/
│       ├── tests/
│       │   └── e2e/
│       └── src/
│           ├── App.tsx
│           ├── main.tsx
│           ├── app/
│           │   ├── AliveApp.tsx
│           │   ├── app-state.ts
│           │   └── routes.ts
│           ├── api/
│           │   ├── ai.ts
│           │   ├── auth.ts
│           │   ├── client.ts
│           │   ├── profile.ts
│           │   ├── shared-characters.ts
│           │   └── dm-threads.ts
│           ├── components/
│           │   └── ui/
│           ├── features/
│           │   ├── auth/
│           │   ├── onboarding/
│           │   ├── home/
│           │   ├── character-setup/
│           │   ├── feed/
│           │   ├── discover/
│           │   ├── dm/
│           │   ├── memory/
│           │   └── relationships/
│           ├── hooks/
│           ├── domain/
│           │   ├── characters/
│           │   ├── feed/
│           │   ├── dm/
│           │   ├── relationships/
│           │   └── persistence/
│           ├── styles/
│           │   └── index.css
│           ├── types/
│           │   ├── alive.ts
│           │   └── env.d.ts
│           └── utils/
├── packages/
│   ├── contracts/               # 이후 OpenAPI/DTO contract 생성 위치
│   ├── api-client/              # 이후 typed API client 위치
│   └── shared/                  # 프론트/백엔드 공통이 아니라 프론트 패키지 공통부터 제한적으로 사용
├── backend/
├── documents/
├── android/
├── ios/
├── capacitor.config.json
├── package.json                 # workspace orchestration
└── package-lock.json
```

### 구조 선택 이유

- `apps/frontend`는 Vite 앱의 소유권을 명확히 한다.
- `backend/`는 일단 유지한다. 백엔드 이동까지 동시에 하면 import, Docker, Alembic, compose 변경이 커진다.
- `packages/contracts`, `packages/api-client`는 guideline과 맞추기 위해 자리만 먼저 만든다. 실제 생성 파이프라인은 FastAPI 교체 단계에서 붙인다.
- `features/`는 화면과 사용자 흐름 중심 코드를 담는다.
- `domain/`은 React와 무관한 순수 로직을 담는다.
- `components/ui/`는 재사용 가능한 작은 UI만 담고, feature 전용 component는 해당 feature 아래 둔다.

## 범위에서 제외

- Supabase 제거 또는 FastAPI 연동 교체: 이 계획 이후에 한다.
- AI generate endpoint FastAPI 이전: 이 계획 이후에 한다.
- Tailwind 도입: guideline에는 Tailwind가 있지만 현재 CSS가 `appStyles.js`에 크게 들어 있다. 이번 단계에서 Tailwind까지 도입하면 구조 이동과 스타일 변경이 섞인다.
- Zustand 도입: guideline에는 global state로 Zustand를 권장하지만, 먼저 hook과 domain을 분리해 state shape를 파악해야 한다.
- 전체 TypeScript 완성: `.tsx/.ts`로 가는 발판은 만들되, 한 번에 전체 타입 완성은 하지 않는다.
- `backend/`를 `services/backend/`로 이동: 가능하지만 첫 모노레포 slice에서는 보류한다.

## 구현 단계

### Phase 0. 기준선 고정 완료

목표: 이동 전 현재 동작과 파일 상태를 기준선으로 잡는다.

작업:

- 현재 주요 파일 line count 기록:
  - `src/hooks/useAliveAppController.jsx`
  - `src/components/AppView.jsx`
  - `src/appStyles.js`
- 현재 import graph에서 Supabase, `/api/generate`, localStorage, navigation 관련 영역을 표시한다.
- 기존 E2E가 local mode 중심이라는 점을 문서화한다.

검증:

- 코드 변경 없음.
- 기준선 기록을 작업 PR 설명이나 별도 문서에 남긴다.

결과:

- 완료 문서: `documents/reports/report_monorepo-frontend-phase0-baseline_2026-07-03.md`

### Phase 1. npm workspaces와 `apps/frontend` 골격 생성 완료

목표: 프론트 앱이 독립 폴더에서 build될 수 있는 구조를 만든다.

작업:

- root `package.json`을 workspace orchestrator로 바꾼다.
- `apps/frontend/package.json`을 만든다.
- root scripts는 wrapper로 유지한다:
  - `npm run build` -> `npm run build -w apps/frontend`
  - `npm run test:e2e` -> frontend workspace test
  - `npm run app:sync` -> frontend build 후 Capacitor sync
- `src/`, `public/`, `index.html`, `vite.config.js`, `playwright.config.js`, frontend 관련 env typing을 `apps/frontend/`로 이동한다.
- `vite.config.js`는 `vite.config.ts`로 바꿀 준비를 하되, 필요하면 첫 slice에서는 `.js` 유지도 가능하다.
- `tests/e2e/`는 `apps/frontend/tests/e2e/`로 이동한다.

검증:

- `npm run build`.
- Playwright config가 dev server를 직접 시작하는 점은 유지하되, 실제 E2E 실행은 저장소 규칙에 맞게 이미 실행 중인 프로세스가 있을 때만 한다.

결과:

- 완료 문서: `documents/reports/report_monorepo-frontend-phase1-review_2026-07-03.md`
- `npm run build` 성공.

### Phase 2. Capacitor와 mobile shell 경로 정리 완료

목표: 프론트 build output 위치 변경으로 iOS/Android sync가 깨지지 않게 한다.

작업:

- `capacitor.config.json`의 `webDir`를 `apps/frontend/dist`로 변경한다.
- root `app:sync`, `app:open:ios`, `app:open:android` script가 기존 사용성을 유지하게 한다.
- Android/iOS 프로젝트는 루트에 유지한다. mobile native project까지 `apps/mobile-*`로 옮기는 것은 별도 작업으로 둔다.

검증:

- `npm run build` 후 `webDir`가 존재하는지 확인한다.
- `npm run app:sync`는 사용자가 요청하거나 이미 승인된 상황에서만 실행한다.

결과:

- 완료 문서: `documents/reports/report_monorepo-frontend-phase2-review_2026-07-03.md`
- `npm run build` 성공.
- `apps/frontend/dist/index.html` 존재 확인.

### Phase 3. TypeScript와 alias 발판 추가 완료

목표: guideline을 만족할 수 있는 TypeScript/alias 기반을 만든다.

작업:

- `apps/frontend/tsconfig.json` 추가.
- `@/` alias를 `apps/frontend/src`로 설정한다.
- `vite.config.ts`에서 alias를 동일하게 설정한다.
- `src/types/env.d.ts`를 추가한다.
- 아직 전체 변환이 어려우면 `allowJs`를 임시로 켠다.
- 새로 만드는 파일은 `.ts` 또는 `.tsx`로 작성한다.

검증:

- `npm run build`.
- 신규 import는 긴 상대경로 대신 `@/`를 사용한다.

결과:

- 완료 문서: `documents/reports/report_monorepo-frontend-phase3-review_2026-07-03.md`
- `npm run build` 성공.
- `@/App.jsx` alias import build 검증.

### Phase 4. 기존 controller를 기능별 폴더로 물리 이동 완료

목표: 큰 로직을 바로 쪼개기 전에, 파일 소유권과 위치를 먼저 정리한다.

작업:

- 기존 component를 feature 폴더로 이동한다:
  - `AuthScreens.jsx` -> `features/auth/`
  - `SetupScreens.jsx` -> `features/character-setup/`
  - `HomeScreen.jsx` -> `features/home/`
  - `DiscoverScreen.jsx` -> `features/discover/`
  - `DmListScreen.jsx` -> `features/dm/`
  - `RelationshipModals.jsx` -> `features/relationships/`
  - `LorePeerSelect.jsx`, `WorldChip.jsx`는 사용처에 따라 feature 또는 shared component로 둔다.
- 기존 utility를 `domain/` 아래로 이동한다:
  - `aliveCore.js` -> `domain/app/` 또는 `app/`
  - `discoverUtils.js` -> `domain/discover/`
  - `feedUtils.js` -> `domain/feed/`
  - `relationshipFollowUtils.js` -> `domain/relationships/`
- import만 조정하고 동작은 바꾸지 않는다.

검증:

- `npm run build`.
- 변경 diff에서 함수 body 수정이 거의 없어야 한다.

결과:

- 완료 문서: `documents/reports/report_monorepo-frontend-phase4-review_2026-07-03.md`
- `npm run build` 성공.
- 이동 대상 12개 파일의 기존 blob hash와 새 파일 hash 일치 확인.

### Phase 5. `AppView.jsx`를 화면 단위로 분리 완료

목표: 1,184줄 `AppView.jsx`를 route/view 조합 계층으로 줄인다.

작업:

- `AppView`는 화면 선택과 top-level gating만 담당하게 한다.
- 각 화면은 feature의 `views/` 또는 `components/`로 이동한다.
- 거대한 `ctx` 구조분해를 한 파일에서 하지 않는다.
- 화면별 props를 명시적으로 넘긴다.
- 한 component는 200줄 이하를 목표로 한다.

권장 분리:

```text
AppView
  ├── AuthGate
  ├── MainShell
  ├── HomeView
  ├── CharacterSetupView
  ├── FeedView
  ├── DiscoverView
  ├── DmListView
  └── DmThreadView
```

검증:

- `wc -l apps/frontend/src/components/AppView.*`가 크게 줄어야 한다.
- `npm run build`.
- local mode 핵심 흐름 수동 검증 또는 이미 실행 중인 앱에서 확인.

결과:

- 완료 문서: `documents/reports/report_monorepo-frontend-phase5-review_2026-07-03.md`
- `AppView.jsx`를 `apps/frontend/src/app/AppView.jsx`로 이동.
- `AppView.jsx` 라인 수 1,184줄에서 20줄로 감소.
- `npm run build` 성공.

### Phase 6. `useAliveAppController`를 domain hook으로 분리 진행 중

목표: 4,658줄 hook을 기능별 hook과 순수 domain utility로 줄인다.

분리 순서:

1. `useAliveNavigation`: URL path, history, back/forward, `step` guard.
2. `useLocalPersistence`: localStorage snapshot, save debounce, restore.
3. `useCharacterAccounts`: account CRUD, active account, profile image.
4. `useFeed`: post 생성/수정/삭제, comments, timeline merge.
5. `useDiscover`: discover pool, shared characters, follow panel state.
6. `useDm`: DM thread state, send guard, world preference, duplicate click 방지.
7. `useMemory`: memory CRUD, filters, room memory.
8. `useRelationships`: affinity, relation proposal, follow-back 판단.
9. `useAiGeneration`: `/api/generate` request wrapper와 response parsing.

주의:

- Supabase 호출은 아직 유지하되 API 경계 후보로 표시만 한다.
- hook 분리 중 FastAPI 교체를 섞지 않는다.
- 각 hook의 반환값은 화면별로 필요한 props만 주도록 줄인다.

검증:

- 각 domain utility에는 unit test를 우선 추가한다.
- hook 분리 slice마다 `npm run build`.
- `useAliveAppController` line count가 단계적으로 줄어야 한다.

진행 결과:

- 완료 slice 문서: `documents/reports/report_monorepo-frontend-phase6-navigation-persistence_2026-07-03.md`
- `useAliveNavigation`으로 history/popstate effect 분리.
- `useAliveLocalPersistence`로 localStorage snapshot helper 분리.
- 완료 slice 문서: `documents/reports/report_monorepo-frontend-phase6-ai-generation_2026-07-03.md`
- `useAliveAiGeneration`으로 AI response parsing helper 분리.
- `useAliveAppController.jsx` 라인 수 4,658줄에서 4,516줄로 감소.
- `npm run build` 성공.
- 완료 slice 문서: `documents/reports/report_monorepo-frontend-phase6-domain-hooks_2026-07-03.md`
- `useCharacterAccounts`, `useAliveFeed`, `useAliveDm`, `useAliveDiscover`, `useAliveMemory`, `useAliveRelationships` 도메인 훅 생성.
- memory CRUD/room memory/prompt memory helper, feed 댓글/편집/좋아요/정렬 helper, DM 이미지/방 제목 helper, character image/factory helper, discover follower count/helper와 Supabase 조회 helper를 도메인 훅으로 분리.
- relationship affinity 조회/room affinity helper, profile panel helper, DM key 순수 helper, app text/prompt/async helper를 domain utility와 도메인 훅으로 분리.
- DM 현재 방 파생값, 대화 목록 helper, persona 삭제 helper를 `useAliveDm`으로 분리.
- discover 공유/팔로우 Supabase 저장 helper와 follower follow-back 저장 helper를 `useAliveDiscover`로 분리.
- 구조화 테이블 저장/복원/삭제 helper를 `useAliveStructuredPersistence`로 분리.
- auth submit/magic link/password recovery/sign-out/onboarding/recovery action을 `useAliveAuthActions`로 분리.
- app state snapshot/apply/reset/save helper를 `useAliveAppStatePersistence`로 분리.
- autosave/pagehide 저장 effect를 `useAliveAutosave`로 분리.
- session/OAuth bootstrap과 auth watchdog effect를 `useAliveSessionBootstrap`으로 분리.
- profile/cache/structured-state bootstrap effect를 `useAliveProfileBootstrap`으로 분리.
- discover shared-character sync/deep-link/follow-back effect를 `useAliveDiscoverSync`로 분리.
- relationship auto-follow normalization effect를 `useAliveRelationshipSync`로 분리.
- DM room lifecycle/settings/delete/migration effect를 `useAliveDmLifecycle`로 분리.
- character account lifecycle/switch/edit/delete/start/wake helper를 `useAliveCharacterLifecycle`로 분리.
- relationship label/affinity/proposal mutation helper를 `useAliveRelationshipMutations`로 분리.
- session affinity/memory analysis helper를 `useAliveSessionAnalysis`로 분리.
- feed post/comment/auto-post generation helper를 `useAliveFeedGeneration`으로 분리.
- DM send/auto-chat generation helper를 `useAliveDmGeneration`으로 분리.
- character correction prompt helper를 `useAliveCorrections`로 분리.
- character setup analysis helper를 `useAliveCharacterAnalysis`로 분리.
- discover share/follow action wrapper를 `useAliveDiscoverActions`로 분리.
- peer lookup helper를 `useAlivePeerLookup`으로 분리.
- relationship auto-follow/toggle-follow helper를 `useAliveFollowActions`로 분리.
- share status flash timer를 `useAliveDiscover` 내부로 이동.
- `useAliveRelationships`에서 `relationBaseFor`를 명시 반환해 런타임 참조 누락 가능성을 정리.
- `useAliveAppController.jsx` 라인 수 4,516줄에서 1,498줄로 감소.
- `npm run build` 성공.

### Phase 7. 상태 관리 방향 결정

목표: 분리 후 실제로 필요한 global state만 선택한다.

선택지:

- A. React hook composition 유지.
- B. Zustand 도입.
- C. Context + reducer 도입.

추천:

- 처음에는 A를 유지한다.
- prop drilling이 2단계를 넘어 반복되고, 여러 feature가 같은 state를 동시에 갱신하는 지점이 명확해지면 Zustand를 도입한다.
- 지금 Zustand를 먼저 넣으면 store 설계가 현재 god hook 구조를 그대로 복제할 위험이 있다.

검증:

- store 도입 전후로 render 흐름과 테스트가 명확해야 한다.

### Phase 8. TypeScript 점진 전환

목표: 구조 분리 후 타입을 얹는다.

순서:

1. `domain/` 순수 함수.
2. `api/` client와 DTO mapper.
3. `hooks/`.
4. feature components.
5. app shell.

규칙:

- 모든 함수 parameter와 return value에 type을 명시한다.
- `any` 금지. 알 수 없는 외부 응답은 `unknown`으로 받고 mapper에서 좁힌다.
- 함수는 20줄 이하를 목표로 유지한다.
- type/interface 이름은 PascalCase, 파일명은 kebab-case를 사용한다.

검증:

- `npm run build`.
- typecheck script를 추가한 뒤 `npm run typecheck`.

## 테스트 계획

```text
CODE PATHS                                      USER FLOWS
[+] Monorepo move                               [+] Local app boot
  ├── [GAP] root npm scripts                      ├── [GAP] / -> app loads
  ├── [GAP] frontend workspace build              ├── [GAP] create character
  ├── [GAP] Vite alias resolution                 ├── [GAP] navigate feed/discover/dm
  └── [GAP] Capacitor webDir                      └── [GAP] reload restores local state

[+] AppView split                                [+] Screen rendering
  ├── [GAP] auth/loading gate                     ├── [GAP] auth screen
  ├── [GAP] home route                            ├── [GAP] setup flow
  ├── [GAP] feed route                            ├── [GAP] feed interactions
  ├── [GAP] discover route                        ├── [GAP] follow/unfollow local mode
  └── [GAP] dm route                              └── [GAP] DM duplicate send guard

[+] Controller split                             [+] Persistence
  ├── [COVERED] navigation hook                   ├── [COVERED] back/forward modal state
  ├── [COVERED] local persistence hook            ├── [COVERED] page reload
  ├── [COVERED] feed domain functions             ├── [GAP] edit/delete post
  ├── [COVERED] DM domain functions               ├── [COVERED] send DM once
  └── [COVERED] relationship domain functions     └── [GAP] relationship modal outcome
```

필수 검증:

- `npm run build`
- backend는 구조 이동 영향을 받지 않아야 하지만 root script 변경 후 backend 관련 명령 경로가 깨지지 않았는지 확인한다.
- E2E는 새 프로세스를 시작하지 않는 방식으로만 실행한다. 필요하면 Playwright webServer 자동 실행을 끄는 별도 config를 만든다.

## 실패 모드와 대응

| 영역 | 실패 모드 | 대응 |
|---|---|---|
| workspace script | root `npm run build`가 frontend build를 못 찾음 | root script는 workspace wrapper로 유지한다. |
| Vite path | `@/` alias와 실제 src 경로가 불일치 | `tsconfig.json`과 `vite.config.ts` alias를 같이 수정한다. |
| Capacitor | `webDir` 변경 후 mobile sync가 빈 dist를 복사 | `capacitor.config.json`을 `apps/frontend/dist`로 바꾸고 build output을 확인한다. |
| Playwright | config 이동 후 testDir/baseURL 경로가 깨짐 | frontend workspace 기준 config로 재작성한다. |
| AppView split | 거대한 `ctx`를 그대로 하위로 전달해 분리 효과가 없음 | 화면별 props를 명시하고 feature view 단위로 좁힌다. |
| hook split | Supabase 교체와 구조 분리를 섞어 회귀 원인이 불명확 | 이 계획에서는 Supabase 호출 유지, 위치와 책임만 정리한다. |
| TypeScript | 한 번에 타입을 붙이다가 기능 수정과 섞임 | `allowJs`로 시작하고 새 파일부터 TS로 작성한다. |

## 병렬화 전략

초기 모노레포 이동은 충돌 가능성이 커서 순차 진행이 맞다. 병렬화는 Phase 4 이후부터 가능하다.

| Lane | 작업 | 병렬 가능 여부 |
|---|---|---|
| Lane A | workspace, 경로 이동, Capacitor, Playwright 정리 | 순차 |
| Lane B | feature component 물리 이동 | Phase 3 이후 일부 병렬 가능 |
| Lane C | domain utility 이동과 unit test | Phase 3 이후 일부 병렬 가능 |
| Lane D | AppView split | feature 이동 후 순차 권장 |
| Lane E | controller hook split | AppView split 후 domain별 병렬 가능 |

권장 순서:

```text
Phase 0
  -> Phase 1
  -> Phase 2
  -> Phase 3
  -> Phase 4
  -> Phase 5
  -> Phase 6
  -> Phase 7
  -> Phase 8
```

## 구현 작업 목록

- [x] **T0 (P0, human: ~30min / CC: ~10min)** — Baseline — 이동 전 파일 규모와 주요 접점을 기록한다.
  - 파일: `documents/reports/report_monorepo-frontend-phase0-baseline_2026-07-03.md`.
  - 검증: 코드 변경 없음, 기준선 문서 작성.
- [x] **T1 (P1, human: ~2h / CC: ~25min)** — Monorepo Skeleton — `apps/frontend`와 npm workspace 구조를 만든다.
  - 파일: `package.json`, `package-lock.json`, `apps/frontend/*`.
  - 검증: `npm run build`.
- [x] **T2 (P1, human: ~1h / CC: ~15min)** — Mobile Path — `capacitor.config.json`과 app sync script를 새 dist 경로에 맞춘다.
  - 파일: `capacitor.config.json`, root `package.json`.
  - 검증: frontend build output 경로 확인.
- [x] **T3 (P1, human: ~1h / CC: ~20min)** — TS/Alias Base — `tsconfig`, Vite alias, env typing을 추가한다.
  - 파일: `apps/frontend/tsconfig.json`, `apps/frontend/vite.config.ts`, `apps/frontend/src/types/env.d.ts`.
  - 검증: `npm run build`.
- [x] **T4 (P1, human: ~2h / CC: ~30min)** — Feature Folders — 기존 components와 utilities를 feature/domain 폴더로 이동한다.
  - 파일: `apps/frontend/src/features/*`, `apps/frontend/src/domain/*`.
  - 검증: body 변경 없이 import 수정 중심, `npm run build`.
- [x] **T5 (P1, human: ~4h / CC: ~1h)** — AppView Split — `AppView`를 screen/view 단위로 나눈다.
  - 파일: `apps/frontend/src/app/*`, `apps/frontend/src/features/*`.
  - 검증: line count 감소, build, local mode 수동 확인.
- [x] **T6 (P1, human: ~1-2 days / CC: ~2h)** — Controller Split — `useAliveAppController`를 domain hook으로 나눈다.
  - 파일: `apps/frontend/src/hooks/*`, `apps/frontend/src/domain/*`, `apps/frontend/src/features/*`.
  - 검증: 각 slice build, 최종 `npm run build`, `git diff --check`. unit/domain test 하네스는 T7에서 준비.
  - 진행: navigation/local persistence slice, AI generation helper slice, domain state hook slice, discover persistence slice, structured persistence slice, auth action slice, app state persistence slice, autosave slice, session/profile bootstrap slice, discover sync slice, relationship sync slice, DM lifecycle slice, character lifecycle slice, relationship mutation slice, session analysis slice, feed generation slice, DM generation slice, correction helper slice, character analysis slice, discover action wrapper slice, peer lookup slice, follow action slice 완료. `deletePersona`는 DM persona와 feed comment identity를 잇는 의도적 브릿지로 유지.
- [x] **T7 (P2, human: ~4h / CC: ~1h)** — Test Harness — pure domain tests와 no-webServer E2E config를 준비한다.
  - 파일: `apps/frontend/tests/*`, `apps/frontend/playwright.config.*`, test setup.
  - 검증: `npm run test:domain`, `npm run test:e2e -- --list`, `npm run build`, `git diff --check`.
  - 진행: Node 내장 test runner 기반 domain tests 추가, Playwright webServer 자동 실행 제거, `ALIVE_E2E_BASE_URL` 기반 no-webServer E2E 설정 완료.
- [ ] **T8 (P2, human: ~1-2 days / CC: ~2h)** — Gradual TypeScript — domain과 API boundary부터 `.ts/.tsx`로 전환한다.
  - 파일: `apps/frontend/src/domain/*`, `apps/frontend/src/api/*`, `apps/frontend/src/hooks/*`.
  - 검증: typecheck script 추가 후 실행.
  - 진행: TypeScript devDependency와 `npm run typecheck` 추가. `asyncUtils`, `textUtils`, `dmKeyUtils`, `feedUtils`, `affinityUtils`, `relationshipFollowUtils`, `discoverUtils`를 `.ts`로 전환. `aliveCore`를 `.ts`로 전환. `/api/generate` 호출과 응답 mapper를 `src/api/generate.ts` 경계로 분리. leaf hooks와 `useCharacterAccounts`, `useAliveFeed`, `useAliveDm`, follow/sync/autosave/navigation/analysis hooks, profile/app-state persistence hooks, auth/session bootstrap hooks, character lifecycle hook, relationship hooks, discover hook, structured persistence hook을 `.ts`로 전환. `npm run typecheck`, `npm run test:domain`, `npm run test:e2e -- --list`, `npm run build` 성공.

## 이전 계획과의 관계

이 계획이 먼저다.

```text
1. 모노레포 및 프론트엔드 재구성
   -> 2. Supabase 호출을 API client 경계로 모으기
   -> 3. FastAPI 교체
   -> 4. Supabase dependency 제거
   -> 5. AI generate FastAPI 이전
```

이 순서를 지키면 API 교체 시 변경 지점이 `features/*`, `domain/*`, `api/*` 경계에 묶인다. 반대로 지금 상태에서 API 교체를 먼저 하면 5천 줄 hook 안에서 네트워크 변경과 UI state 변경이 섞일 가능성이 크다.

## 열린 결정

1. 프론트 앱 폴더 이름을 `apps/frontend`로 할지 `front`로 할지?
   - 추천: `apps/frontend`. 모노레포에서 가장 명확하고, 이후 `apps/admin` 같은 확장도 자연스럽다.
2. backend를 이번에 `services/backend`로 옮길지?
   - 추천: 보류. backend 이동은 Docker, Alembic, import, compose 경로 변경까지 동반한다.
3. Tailwind를 이번 구조 개편에 포함할지?
   - 추천: 제외. 현재 CSS가 크므로 스타일 체계 전환은 구조 안정화 후 별도 계획으로 진행한다.
4. Zustand를 바로 도입할지?
   - 추천: 제외. 먼저 hook을 분리해서 실제 공유 state 경계를 확인한다.

## 완료 기준

- root가 npm workspace orchestrator로 동작한다.
- 프론트 앱이 `apps/frontend` 아래에서 build된다.
- `capacitor.config.json`이 새 frontend build output을 바라본다.
- `@/` alias와 TypeScript 도입 기반이 준비된다.
- `AppView.jsx`와 `useAliveAppController.jsx`가 기능 단위로 분리되기 시작한다.
- Supabase/FastAPI 동작 변경 없이 local mode 핵심 흐름이 유지된다.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | DRAFT | FastAPI 교체보다 모노레포/프론트 구조 안정화를 먼저 수행하는 방향으로 계획을 재정렬했다. |

- **UNRESOLVED:** 열린 결정 4개.
- **VERDICT:** 구현 전 사용자 검토 준비 완료.
