---
title: 모노레포 프론트엔드 재구성 Phase 2 검토
author: black (black@ashwoodfriends.com)
created: 2026-07-03
updated: 2026-07-03
version: 0.1.0
status: draft
---

# 모노레포 프론트엔드 재구성 Phase 2 검토

## 목적

`plan_monorepo-frontend-restructure_2026-07-03.md`의 Phase 2 결과를 기록한다. 이번 단계의 목표는 frontend build output 위치가 `apps/frontend/dist`로 바뀐 뒤에도 Capacitor sync가 빈 root `dist`를 복사하지 않도록 mobile shell 경로를 정리하는 것이다.

## 변경 요약

- `capacitor.config.json`의 `webDir`를 `dist`에서 `apps/frontend/dist`로 변경했다.
- root `app:sync`, `app:open:ios`, `app:open:android` script는 기존 사용성을 유지한다.
- Android/iOS native project는 루트에 그대로 유지했다.

## 검증

실행한 검증:

```bash
npm run build
node -e "const fs=require('fs'); const config=JSON.parse(fs.readFileSync('capacitor.config.json','utf8')); if (config.webDir !== 'apps/frontend/dist') throw new Error(config.webDir); if (!fs.existsSync(config.webDir)) throw new Error('missing webDir'); if (!fs.existsSync(config.webDir + '/index.html')) throw new Error('missing index.html'); console.log(config.webDir)"
```

결과:

- root `npm run build`가 frontend workspace build를 호출하고 성공했다.
- `capacitor.config.json`의 `webDir` 값이 `apps/frontend/dist`임을 확인했다.
- `apps/frontend/dist/index.html` 존재를 확인했다.

관찰된 경고:

- Vite가 minified chunk 608.46 kB에 대해 500 kB 초과 경고를 냈다.
- 이는 Phase 1과 동일한 기존 bundle size 문제이며 Phase 2 범위에서는 수정하지 않았다.

## 미실행 검증

- `npm run app:sync`는 실행하지 않았다.
- 이유: `cap sync`는 앱 프로세스를 시작하지는 않지만 `ios/`, `android/` native project 파일을 갱신할 수 있다. 이번 검토에서는 새 `webDir`가 존재하고 build output이 준비되는지까지 확인했다.

## 수동 검토 가이드

native sync가 필요할 때 루트에서 다음 순서로 확인한다.

```bash
npm run app:sync
npm run app:open:ios
npm run app:open:android
```

`npm run app:sync`는 root script를 통해 frontend workspace를 build한 뒤, `capacitor.config.json`의 `apps/frontend/dist`를 native shell로 복사한다.

## 다음 Phase로 넘긴 항목

- TypeScript config와 `@/` alias 발판은 Phase 3 범위다.
- `vite.config.js`는 아직 `.js`로 유지했다.
- root `dist`는 기존 ignored build artifact로 남아 있을 수 있으나, Capacitor와 Vercel 설정은 더 이상 root `dist`를 참조하지 않는다.

## Phase 2 검토 체크리스트

- [x] `capacitor.config.json` `webDir`를 `apps/frontend/dist`로 변경
- [x] root `app:sync`, `app:open:ios`, `app:open:android` 사용성 유지
- [x] Android/iOS project는 루트에 유지
- [x] `npm run build` 성공
- [x] `webDir`와 `index.html` 존재 확인
- [x] app process 직접 시작 없음
