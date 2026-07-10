# 큰 화면 파일 추가 분해 보고서

## 개요

API 교체 전에 UI route/component 병목을 줄이기 위해 `FeedRoute`, `AppModals`, `ExploreDmRoutes`, `SetupScreens`를 작은 route shell과 하위 컴포넌트로 분해했다.

## 분해 결과

| 영역 | 기존 병목 | 분해 후 주요 파일 | 라인 수 |
| --- | --- | --- | --- |
| Feed | `FeedRoute.tsx` | `FeedRoute.tsx`, `app/feed/*` | 19, 77, 149, 169, 200 |
| Modals | `AppModals.tsx` | `AppModals.tsx`, `app/modals/*` | 16, 89, 97, 101, 101 |
| DM | `ExploreDmRoutes.tsx` | `ExploreDmRoutes.tsx`, `app/dm/*` | 15, 35-102 |
| Setup | `SetupScreens.tsx` | `SetupScreens.tsx`, `ConfirmScreen.tsx`, `DumpScreen.tsx` | 2, 119, 64 |

## 검증

- `npm run typecheck` 성공
- `npm run test:domain` 성공, 15개 통과
- `npm run test:e2e -- --list` 성공, 3개 테스트 확인
- `npm run build` 성공
- `git diff --check` 성공

## 메모

- 새 프론트엔드/백엔드 프로세스는 시작하지 않았다.
- Vite build에서 500 kB 초과 chunk 경고가 표시되지만, 빌드는 성공했다.
