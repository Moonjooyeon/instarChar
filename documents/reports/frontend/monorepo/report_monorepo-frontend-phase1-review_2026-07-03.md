---
title: 모노레포 프론트엔드 재구성 Phase 1 검토
author: black (black@ashwoodfriends.com)
created: 2026-07-03
updated: 2026-07-03
version: 0.1.0
status: draft
---

# 모노레포 프론트엔드 재구성 Phase 1 검토

## 목적

`plan_monorepo-frontend-restructure_2026-07-03.md`의 Phase 1 결과를 기록한다. 이번 단계의 목표는 프론트엔드 앱이 `apps/frontend` workspace에서 독립적으로 build될 수 있게 만드는 것이다.

## 변경 요약

- root `package.json`에 npm workspace `apps/frontend`를 추가했다.
- root scripts를 frontend workspace wrapper로 변경했다.
- `apps/frontend/package.json`을 추가하고 기존 frontend runtime/dev dependency를 옮겼다.
- 다음 frontend 파일과 폴더를 `apps/frontend/` 아래로 이동했다.
  - `index.html`
  - `src/`
  - `public/`
  - `tests/`
  - `vite.config.js`
  - `playwright.config.js`
- `apps/frontend/vite.config.js`의 local API handler import를 `../../api/generate.js`로 조정했다.
- 기존 root `.env.local` 사용성을 보존하기 위해 Vite `envDir`와 `loadEnv` 기준을 repo root로 명시했다.
- root `vercel.json`의 `outputDirectory`를 `apps/frontend/dist`로 변경했다.
- `package-lock.json`을 workspace 구조에 맞게 갱신했다.

## 검증

실행한 검증:

```bash
node -e "for (const file of ['package.json','apps/frontend/package.json','vercel.json']) JSON.parse(require('fs').readFileSync(file,'utf8')); console.log('json ok')"
npm install --package-lock-only --ignore-scripts
npm run build
```

결과:

- JSON parse 검증 통과.
- lockfile 갱신 성공.
- root `npm run build`가 `npm run build -w apps/frontend`를 호출하고 Vite production build 성공.
- build output은 `apps/frontend/dist`에 생성됨.

관찰된 경고:

- Vite가 minified chunk 608.46 kB에 대해 500 kB 초과 경고를 냈다.
- 이는 구조 이동 전 큰 controller/AppView 구조에서 이어지는 기존 bundle size 문제이며 Phase 1 범위에서는 수정하지 않았다.

## 미실행 검증

- E2E는 실행하지 않았다.
- 이유: 현재 `apps/frontend/playwright.config.js`의 `webServer.command`가 dev server를 직접 시작한다. 저장소 규칙상 Codex는 frontend/backend app process를 직접 새로 시작하지 않는다.

## 다음 Phase로 넘긴 항목

- `capacitor.config.json`의 `webDir`는 아직 기존 `dist`이다.
- root `app:sync` script는 frontend workspace build를 호출하도록 바뀌었지만, 실제 Capacitor sync 검증은 Phase 2에서 `webDir: "apps/frontend/dist"` 변경 후 수행해야 한다.
- `vite.config.js`는 아직 `.js`로 유지했다. TypeScript config와 alias 발판은 Phase 3 범위다.

## Phase 1 검토 체크리스트

- [x] root package를 workspace orchestrator로 변경
- [x] `apps/frontend/package.json` 추가
- [x] frontend source/static/test/config 파일을 `apps/frontend`로 이동
- [x] root scripts wrapper 유지
- [x] local `/api/generate` middleware import 경로 조정
- [x] root env 파일 사용성 보존
- [x] root `npm run build` 성공
- [x] app process 직접 시작 없음
