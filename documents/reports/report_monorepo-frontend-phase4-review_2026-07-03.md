---
title: 모노레포 프론트엔드 재구성 Phase 4 검토
author: black (black@ashwoodfriends.com)
created: 2026-07-03
updated: 2026-07-03
version: 0.1.0
status: draft
---

# 모노레포 프론트엔드 재구성 Phase 4 검토

## 목적

`plan_monorepo-frontend-restructure_2026-07-03.md`의 Phase 4 결과를 기록한다. 이번 단계의 목표는 큰 controller와 AppView를 아직 분해하지 않고, 기존 화면 component와 순수 utility의 소유권을 `features/*`, `domain/*`, `components/ui/*` 구조로 먼저 정리하는 것이다.

## 변경 요약

화면 component를 feature 폴더로 이동했다.

| 이전 경로 | 새 경로 |
|-----------|---------|
| `src/components/AuthScreens.jsx` | `apps/frontend/src/features/auth/AuthScreens.jsx` |
| `src/components/SetupScreens.jsx` | `apps/frontend/src/features/character-setup/SetupScreens.jsx` |
| `src/components/HomeScreen.jsx` | `apps/frontend/src/features/home/HomeScreen.jsx` |
| `src/components/DiscoverScreen.jsx` | `apps/frontend/src/features/discover/DiscoverScreen.jsx` |
| `src/components/DmListScreen.jsx` | `apps/frontend/src/features/dm/DmListScreen.jsx` |
| `src/components/RelationshipModals.jsx` | `apps/frontend/src/features/relationships/RelationshipModals.jsx` |

작은 재사용 UI를 `components/ui`로 이동했다.

| 이전 경로 | 새 경로 |
|-----------|---------|
| `src/components/LorePeerSelect.jsx` | `apps/frontend/src/components/ui/LorePeerSelect.jsx` |
| `src/components/WorldChip.jsx` | `apps/frontend/src/components/ui/WorldChip.jsx` |

순수 utility를 domain 폴더로 이동했다.

| 이전 경로 | 새 경로 |
|-----------|---------|
| `src/aliveCore.js` | `apps/frontend/src/domain/app/aliveCore.js` |
| `src/discoverUtils.js` | `apps/frontend/src/domain/discover/discoverUtils.js` |
| `src/feedUtils.js` | `apps/frontend/src/domain/feed/feedUtils.js` |
| `src/relationshipFollowUtils.js` | `apps/frontend/src/domain/relationships/relationshipFollowUtils.js` |

import 경로를 `@/` alias 기준으로 조정했다.

- `apps/frontend/src/App.jsx`
- `apps/frontend/src/hooks/useAliveAppController.jsx`

## 검증

실행한 검증:

```bash
rg -n "old relative import patterns" apps/frontend/src
npm run build
git rev-parse HEAD:<old-path>
git hash-object <new-path>
```

결과:

- 이전 `../components`, `../aliveCore`, `../discoverUtils`, `../feedUtils`, `../relationshipFollowUtils` import 참조가 남지 않았다.
- root `npm run build` 성공.
- 이동 대상 12개 파일의 기존 HEAD blob hash와 새 파일 hash가 모두 일치했다.
- 함수 body 변경 없이 물리 이동과 import 경로 변경만 수행했다.

관찰된 경고:

- Vite가 minified chunk 608.47 kB에 대해 500 kB 초과 경고를 냈다.
- 이는 기존 bundle size 문제이며 Phase 4 범위에서는 수정하지 않았다.

## 미실행 검증

- E2E는 실행하지 않았다.
- 이유: Playwright config가 dev server를 직접 시작하므로 저장소 규칙상 이미 실행 중인 프로세스가 있을 때만 실행한다.

## 다음 Phase로 넘긴 항목

- `AppView.jsx` 자체 분해는 Phase 5 범위다.
- `useAliveAppController.jsx` 분해는 Phase 6 범위다.
- `appStyles.js`와 `supabaseClient.js`의 소유권 재배치는 별도 API/style 경계 정리 단계에서 다룬다.

## Phase 4 검토 체크리스트

- [x] 기존 화면 component를 feature 폴더로 이동
- [x] 작은 재사용 UI를 `components/ui`로 이동
- [x] 기존 utility를 `domain/*` 폴더로 이동
- [x] import만 조정하고 동작 변경 없음
- [x] 이동 대상 파일 hash 동일성 확인
- [x] `npm run build` 성공
- [x] app process 직접 시작 없음
