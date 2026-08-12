---
title: 앱인토스 최종 하드닝 및 재검증
author: black (black@ashwoodfriends.com)
created: 2026-08-12
updated: 2026-08-12
version: 1.0.0
status: ready
---

# 앱인토스 최종 하드닝 및 재검증

## 판정

- 소스·로컬 릴리스 후보: **GO**
- 운영 배포·앱인토스 제출: **새 번들 실기기 스모크 후 GO**
- 결제 상품, 가격, 지급량 및 서버 권한 지급 정책은 변경하지 않았다.
- SDK 3.0.3 전환과 환불 내역 페이지 키 전달 수정이 포함되므로, 이전 번들에서 통과한 결제 결과와 별도로 새 `.ait`에서 구매 1건·미결 복원·환불 내역 조회를 확인해야 한다.

## 수정 완료 항목

| 영역 | 수정 | 검증 |
| --- | --- | --- |
| AI 정체성 | DM 자기 설정에 저장된 캐릭터 나이를 최우선으로 포함 | 도메인 테스트 및 실제 Gemini DM에서 `21세` → `스물한 살, 21살` 확인 |
| AI 안전 | 요청·응답 유해 콘텐츠 및 자격증명 패턴 차단, Gemini safety settings 적용, 차단 응답 크레딧 환급 | 백엔드 안전·AI 테스트 포함 전체 397건 통과 |
| 인증 | 로그아웃 시 `session_version`을 증가시켜 기존 bearer·cookie 세션 폐기, 기본 TTL 30일 → 7일 | 인증 API 회귀 테스트 통과 |
| HTTP 보안 | CSP, HSTS, nosniff, frame, referrer, permissions 헤더 적용; API 문서 기본 비공개 | 모든 테스트 응답 헤더와 `/docs`·`/redoc`·`/openapi.json` 404 확인 |
| 프런트 보안 | 앱 셸 CSP 적용, 실행 스크립트는 `self`만 허용 | 보안 구성 테스트 통과 |
| DB 정합성 | ORM 인덱스와 migration 정렬, 구매 시간 컬럼 NOT NULL 보정 | `20260812_0025 (head)`, `alembic check` clean, DB 통합 테스트 통과 |
| 의존성 | Apps in Toss 3.0.3, Vite 8.2.1 및 취약 Python 패키지 업그레이드 | `npm audit` 및 `pip-audit` 알려진 취약점 0건 |
| IAP 환불 조회 | 공식 문서의 `{ key }`를 SDK 저수준 브리지로 전달해 50건 초과 이력 페이지네이션 보장 | 페이지 키·환불 필터 도메인 테스트와 타입 검사 통과 |
| 한국어 UI | 캐릭터 이름 뒤 `과/와` 조사 자동 선택 | 도메인 테스트 통과 |

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| TypeScript | passed |
| 프런트 도메인 테스트 | 168 passed |
| Playwright 시나리오 수집 | 21 tests discovered; 실행 중인 프런트 프로세스가 없어 실행하지 않음 |
| Vite production build | passed |
| Apps in Toss build | passed |
| npm audit | 0 vulnerabilities |
| Python compile | passed |
| 백엔드 전체 테스트 | 397 passed, 1 skipped |
| PostgreSQL 구매 통합 테스트 | 1 passed |
| pip check | passed |
| pip-audit | no known vulnerabilities |
| Alembic current/check | `20260812_0025 (head)`, clean |
| Android release | `lintRelease` 및 `assembleRelease` passed, lint issue 0 |
| iOS release | 서명 제외 simulator Release build passed |

## 실제 AI 스모크

- flow: `direct_dm_basic`
- 입력 설정: 리안, 21세, 짧은 반말
- 질문: 나이를 숫자와 한국어 표현으로 답하도록 요청
- 결과: HTTP 200, `나 스물한 살, 21살이야.`
- provider/model: Gemini flash 계열, 1회 호출, 총 211 tokens
- 비밀키와 전체 프롬프트는 증거에 저장하지 않았다.

## 최종 앱인토스 번들

| 항목 | 값 |
| --- | --- |
| 파일 | `apps/frontend/ashwoodfriends-alive.ait` |
| SDK | `@apps-in-toss/web-framework` 3.0.3 |
| deployment ID | `019ff455-8008-7e12-a12f-f7afdafa8c61` |
| SHA-256 | `0a7d5ab446f3f769c308fe77c5c0bfadb89cad2be5397827f88d64fbab554fd2` |
| 크기 | 3,486,935 bytes |

## 제출 전 남은 외부 확인

1. migration `20260812_0025`와 백엔드를 먼저 배포하고 운영 `/docs` 404 및 보안 헤더를 확인한다.
2. 위 SHA-256의 새 `.ait`를 앱인토스 테스트에 올린다.
3. 같은 사용자로 신규 구매 1건, 앱 재진입 미결 복원, 환불 내역 조회를 확인한다.
4. 앱인토스에서 로그인, 캐릭터 생성, 피드, DM, 크레딧 화면 핵심 스모크를 실행한다.

## 비차단 경고

- Vite는 단일 메인 청크가 약 504 kB라 500 kB 경고를 낸다. 빌드·실행 실패는 아니며 후속 성능 최적화 대상이다.
- FastAPI 최신 `TestClient`가 현 `httpx`에 대해 향후 `httpx2` 전환 경고를 낸다. 397개 테스트와 런타임 동작에는 영향이 없었다.
- 프로젝트 규칙에 따라 새 프런트·백엔드 프로세스를 시작하지 않았으므로 Playwright 21개는 수집까지만 확인했다.
