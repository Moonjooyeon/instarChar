---
title: 모노레포 프론트엔드 재구성 Phase 3 검토
author: black (black@ashwoodfriends.com)
created: 2026-07-03
updated: 2026-07-03
version: 0.1.0
status: draft
---

# 모노레포 프론트엔드 재구성 Phase 3 검토

## 목적

`plan_monorepo-frontend-restructure_2026-07-03.md`의 Phase 3 결과를 기록한다. 이번 단계의 목표는 기존 JavaScript 앱 동작을 유지하면서 TypeScript와 `@/` path alias를 점진적으로 도입할 수 있는 기반을 만드는 것이다.

## 변경 요약

- `apps/frontend/tsconfig.json`을 추가했다.
- `allowJs: true`, `checkJs: false`, `noEmit: true`로 기존 JavaScript source를 유지하는 TS 전환 발판을 만들었다.
- `@/*` path alias를 `src/*`로 설정했다.
- `apps/frontend/vite.config.js`를 `apps/frontend/vite.config.ts`로 변경했다.
- Vite `resolve.alias`에서 `@`를 `apps/frontend/src`로 설정했다.
- `apps/frontend/src/types/env.d.ts`를 추가했다.
- `ImportMetaEnv`와 `__ALIVE_BUILD__` 전역 타입을 선언했다.
- alias 실제 해석을 검증하기 위해 `apps/frontend/src/main.jsx`의 `App` import를 `@/App.jsx`로 변경했다.

## 검증

실행한 검증:

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/frontend/tsconfig.json','utf8')); console.log('tsconfig json ok')"
npm run build
```

결과:

- `tsconfig.json` JSON parse 검증 통과.
- root `npm run build` 성공.
- Vite가 `apps/frontend/vite.config.ts`를 정상 로드했다.
- `@/App.jsx` alias import가 production build에서 정상 해석됐다.

관찰된 경고:

- Vite가 minified chunk 608.46 kB에 대해 500 kB 초과 경고를 냈다.
- 이는 기존 bundle size 문제이며 Phase 3 범위에서는 수정하지 않았다.

## 미실행 검증

- TypeScript typecheck는 실행하지 않았다.
- 이유: 이번 단계는 `allowJs` 기반 도입 발판이며, 아직 `typescript` dependency와 `typecheck` script를 추가하지 않았다. 점진적 `.ts/.tsx` 전환과 typecheck script 추가는 후속 Phase에서 다룬다.
- E2E는 실행하지 않았다. Playwright config가 dev server를 직접 시작하므로 저장소 규칙상 이미 실행 중인 프로세스가 있을 때만 실행한다.

## 다음 Phase로 넘긴 항목

- 기존 component와 utility의 feature/domain 폴더 이동은 Phase 4 범위다.
- 새로 추가하는 source import는 `@/` alias를 사용한다.
- 전체 `.tsx/.ts` 변환과 typecheck script 추가는 후속 TypeScript 전환 범위다.

## Phase 3 검토 체크리스트

- [x] `apps/frontend/tsconfig.json` 추가
- [x] `@/` alias를 `apps/frontend/src`로 설정
- [x] `apps/frontend/vite.config.ts`에서 alias 설정
- [x] `apps/frontend/src/types/env.d.ts` 추가
- [x] 기존 JavaScript source 유지를 위해 `allowJs` 적용
- [x] alias import build 검증
- [x] `npm run build` 성공
- [x] app process 직접 시작 없음
