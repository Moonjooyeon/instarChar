---
title: 모노레포 프론트엔드 재구성 Phase 6 Navigation/Persistence 검토
author: black (black@ashwoodfriends.com)
created: 2026-07-03
updated: 2026-07-03
version: 0.1.0
status: draft
---

# 모노레포 프론트엔드 재구성 Phase 6 Navigation/Persistence 검토

## 목적

`plan_monorepo-frontend-restructure_2026-07-03.md`의 Phase 6 첫 번째 slice 결과를 기록한다. 이번 작업은 4,658줄 `useAliveAppController.jsx`에서 navigation과 local persistence 경계를 먼저 분리해, 이후 DM/feed/memory/relationship hook 분리의 기준을 만든다.

## 변경 요약

- `apps/frontend/src/hooks/useAliveNavigation.js`를 추가했다.
- URL path, history state, back/forward, `popstate` 처리 effect를 controller에서 navigation hook으로 이동했다.
- `apps/frontend/src/hooks/useAliveLocalPersistence.js`를 추가했다.
- localStorage snapshot 저장/복원 helper와 usable saved state 판정을 local persistence hook으로 이동했다.
- `useAliveAppController.jsx`는 새 hook을 호출해 기존 ctx shape를 유지한다.
- 초기 local mode restore는 `readLocalSnapshot()` helper를 사용하도록 정리했다.

## 검증

실행한 검증:

```bash
wc -l apps/frontend/src/hooks/useAliveAppController.jsx apps/frontend/src/hooks/useAliveNavigation.js apps/frontend/src/hooks/useAliveLocalPersistence.js
rg -n "normalizeSavedStep|pathForStep|stepFromPath|function navStateForHistory|function navKey|function navUrlForState|function persistLocalSnapshot|function readLocalSnapshot|function hasUsableSavedState" apps/frontend/src/hooks/useAliveAppController.jsx apps/frontend/src/hooks/useAliveNavigation.js apps/frontend/src/hooks/useAliveLocalPersistence.js
npm run build
```

결과:

- `useAliveAppController.jsx` 라인 수가 4,658줄에서 4,551줄로 감소했다.
- navigation helper/effect는 `useAliveNavigation.js`에만 남았다.
- local persistence helper는 `useAliveLocalPersistence.js`에만 남았다.
- root `npm run build` 성공.

관찰된 경고:

- Vite가 minified chunk 606.86 kB에 대해 500 kB 초과 경고를 냈다.
- 이는 기존 bundle size 문제이며 이번 slice 범위에서는 수정하지 않았다.

## 미실행 검증

- E2E는 실행하지 않았다.
- 이유: Playwright config가 dev server를 직접 시작하므로 저장소 규칙상 이미 실행 중인 프로세스가 있을 때만 실행한다.

## 남은 Phase 6 작업

- `useCharacterAccounts`
- `useFeed`
- `useDiscover`
- `useDm`
- `useMemory`
- `useRelationships`
- `useAiGeneration`

## Phase 6 Slice 검토 체크리스트

- [x] `useAliveNavigation` 추가
- [x] history/popstate effect 이동
- [x] `useAliveLocalPersistence` 추가
- [x] localStorage snapshot helper 이동
- [x] controller line count 감소 확인
- [x] `npm run build` 성공
- [x] app process 직접 시작 없음
