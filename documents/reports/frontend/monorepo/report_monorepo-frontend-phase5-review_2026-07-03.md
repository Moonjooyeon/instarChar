---
title: 모노레포 프론트엔드 재구성 Phase 5 검토
author: black (black@ashwoodfriends.com)
created: 2026-07-03
updated: 2026-07-03
version: 0.1.0
status: draft
---

# 모노레포 프론트엔드 재구성 Phase 5 검토

## 목적

`plan_monorepo-frontend-restructure_2026-07-03.md`의 Phase 5 결과를 기록한다. 이번 단계의 목표는 1,184줄 `AppView.jsx`가 화면 선택과 top-level composition만 담당하게 만들고, 실제 화면 JSX를 route/view 단위 파일로 분리하는 것이다.

## 변경 요약

- `apps/frontend/src/components/AppView.jsx`를 `apps/frontend/src/app/AppView.jsx`로 이동했다.
- `apps/frontend/src/App.jsx`의 import를 `@/app/AppView`로 변경했다.
- 기존 `AppView`의 top-level 화면 블록을 다음 파일로 분리했다.

| 파일 | 역할 | 라인 수 |
|------|------|---------|
| `apps/frontend/src/app/AppView.jsx` | top-level composition, style/footer | 20 |
| `apps/frontend/src/app/AuthRoutes.jsx` | auth loading/sign-in routes | 60 |
| `apps/frontend/src/app/SetupRoutes.jsx` | home/dump/confirm setup routes | 97 |
| `apps/frontend/src/app/FeedRoute.jsx` | feed/profile/timeline route | 558 |
| `apps/frontend/src/app/ExploreDmRoutes.jsx` | discover, DM list, DM thread routes | 409 |
| `apps/frontend/src/app/AppModals.jsx` | shared modal overlays | 418 |

## 검증

실행한 검증:

```bash
npm run build
rg -n "components/AppView|from \"@/components/AppView|from \"./components/AppView|AppView" apps/frontend/src
wc -l apps/frontend/src/app/*.jsx
```

결과:

- root `npm run build` 성공.
- `AppView` import는 `apps/frontend/src/App.jsx`의 `@/app/AppView`만 남았다.
- 기존 `components/AppView.jsx`는 제거되고 app composition으로 이동했다.
- `AppView.jsx` 라인 수가 1,184줄에서 20줄로 감소했다.

관찰된 경고:

- Vite가 minified chunk 606.11 kB에 대해 500 kB 초과 경고를 냈다.
- 이는 기존 bundle size 문제이며 Phase 5 범위에서는 수정하지 않았다.

## 미실행 검증

- E2E는 실행하지 않았다.
- 이유: Playwright config가 dev server를 직접 시작하므로 저장소 규칙상 이미 실행 중인 프로세스가 있을 때만 실행한다.

## 남은 리스크

- `FeedRoute.jsx`, `ExploreDmRoutes.jsx`, `AppModals.jsx`는 여전히 큰 route component다.
- 이번 단계에서는 안전한 화면 단위 이동을 우선했고, 각 화면의 세부 component 분해와 명시적 props 축소는 후속 controller/hook 분리와 함께 진행한다.
- `ctx` 전달은 아직 남아 있다. 다만 거대한 `ctx` 구조분해는 한 파일에 집중되지 않고 route 단위로 분산됐다.

## 다음 Phase로 넘긴 항목

- `useAliveAppController.jsx` 기능별 hook 분리는 Phase 6 범위다.
- Feed/DM/modal 내부 subcomponent 분해는 controller state 경계가 정리된 뒤 안전하게 진행한다.

## Phase 5 검토 체크리스트

- [x] `AppView.jsx`를 app composition 계층으로 이동
- [x] auth/setup/feed/discover-dm/modal route 단위 파일 생성
- [x] `AppView.jsx` 라인 수 대폭 감소
- [x] old `components/AppView` import 제거
- [x] `npm run build` 성공
- [x] app process 직접 시작 없음
