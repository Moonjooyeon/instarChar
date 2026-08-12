---
title: ALIVE QA 인덱스
author: black (black@ashwoodfriends.com)
created: 2026-08-06
updated: 2026-08-12
version: 1.2.0
status: approved
---

# QA 문서

QA 문서는 실제 확인 절차, 실행 결과, 원본 증거를 분리한다.

| 디렉터리 | 내용 |
|---|---|
| [`guides/`](guides/) | 실행 중인 앱이나 기기에서 따라 할 검토 절차 |
| [`reports/`](reports/) | Android/iOS/스토어/브랜치 검증 결과 |
| [`evidence/`](evidence/) | PNG, XML 등 원본 캡처·도구 산출물 |

## QA 작성 규칙

- 실행 환경, 브랜치/빌드, 대상 URL 또는 기기, 테스트 범위, 결과를 기록한다.
- `passed`, `failed`, `partial`, `not run`을 구분한다.
- 스크린샷·XML은 보고서에서 상대 경로로 연결하고 `evidence/`에 저장한다.
- 시각 검토 절차는 `guide_`, 실행 결과는 `report_` prefix를 사용한다.

## 현재 문서

- [Entry Flow 시각 검토 가이드](guides/guide_entry-flow-visual-review_2026-08-05.md)
- [앱인토스 인앱결제 샌드박스 검증 가이드](guides/guide_apps-in-toss-iap-sandbox_2026-08-11.md)
- [추천 피드 개인화 수동 검토 가이드](guides/guide_feed-personalization-review_2026-08-12.md)
- [추천 피드 개인화 로컬 QA](reports/report_feed-personalization-local-qa_2026-08-12.md)
- [앱인토스 최종 출시 감사](reports/report_apps-in-toss-final-release-audit_2026-08-12.md)
- [앱인토스 최종 하드닝 및 재검증](reports/report_apps-in-toss-final-hardening_2026-08-12.md)
- [QA 보고서 폴더](reports/)
- [QA 증거 폴더](evidence/)
