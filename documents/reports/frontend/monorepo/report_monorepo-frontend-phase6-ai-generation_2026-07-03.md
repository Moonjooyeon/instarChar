---
title: 모노레포 프론트엔드 재구성 Phase 6 AI Generation 검토
author: black (black@ashwoodfriends.com)
created: 2026-07-03
updated: 2026-07-03
version: 0.1.0
status: draft
---

# 모노레포 프론트엔드 재구성 Phase 6 AI Generation 검토

## 목적

`plan_monorepo-frontend-restructure_2026-07-03.md`의 Phase 6 두 번째 slice 결과를 기록한다. 이번 작업은 `/api/generate` 호출부를 전부 재작성하지 않고, AI 응답 파싱과 오류 문구 정리 helper만 먼저 controller 밖으로 분리하는 것이다.

## 변경 요약

- `apps/frontend/src/hooks/useAliveAiGeneration.js`를 추가했다.
- 다음 helper를 `useAliveAppController.jsx`에서 `useAliveAiGeneration.js`로 이동했다.
  - `readApiJson`
  - `apiErrorText`
  - `apiContentText`
  - `cleanApiFailureMessage`
  - `readApiContent`
- 기존 fetch 호출 지점은 유지했다.
- controller는 새 hook을 호출해 기존 helper 이름을 그대로 사용한다.

## 검증

실행한 검증:

```bash
wc -l apps/frontend/src/hooks/useAliveAppController.jsx apps/frontend/src/hooks/useAliveAiGeneration.js
rg -n "function readApiJson|function apiErrorText|function apiContentText|function cleanApiFailureMessage|function readApiContent|useAliveAiGeneration" apps/frontend/src/hooks
npm run build
```

결과:

- `useAliveAppController.jsx` 라인 수가 4,551줄에서 4,516줄로 감소했다.
- AI response helper 정의는 `useAliveAiGeneration.js`에만 남았다.
- root `npm run build` 성공.

관찰된 경고:

- Vite가 minified chunk 607.06 kB에 대해 500 kB 초과 경고를 냈다.
- 이는 기존 bundle size 문제이며 이번 slice 범위에서는 수정하지 않았다.

## 미실행 검증

- E2E는 실행하지 않았다.
- 이유: Playwright config가 dev server를 직접 시작하므로 저장소 규칙상 이미 실행 중인 프로세스가 있을 때만 실행한다.

## 남은 Phase 6 작업

- fetch 요청 생성 자체를 API client 경계로 모으는 작업
- `useCharacterAccounts`
- `useFeed`
- `useDiscover`
- `useDm`
- `useMemory`
- `useRelationships`

## Phase 6 Slice 검토 체크리스트

- [x] `useAliveAiGeneration` 추가
- [x] AI response helper 이동
- [x] 기존 fetch 호출 동작 유지
- [x] controller line count 감소 확인
- [x] `npm run build` 성공
- [x] app process 직접 시작 없음
