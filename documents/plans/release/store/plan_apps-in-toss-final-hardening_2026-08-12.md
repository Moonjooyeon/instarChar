---
title: 앱인토스 최종 출시 하드닝 계획
author: black (black@ashwoodfriends.com)
created: 2026-08-12
updated: 2026-08-12
version: 1.0.0
status: complete
---

# 앱인토스 최종 출시 하드닝 계획

## 목표

결제 실기기 검증을 제외한 최종 출시 감사 항목을 최소 변경으로 수정하고, 현재 소스와 migration 및 앱인토스 번들이 같은 기준에서 검증되도록 한다.

## 가정

- 앱인토스 결제 시나리오는 사용자가 실기기에서 확인했으며 상품·가격·지급 정책은 변경하지 않는다. SDK 3.x 계약 확인 중 발견한 환불 내역 페이지 키 전달 오류만 공식 계약에 맞게 수정한다.
- 운영 API 호스트는 미니앱 HTML 번들을 제공하지 않으므로 API·법적 문서에 강한 보안 헤더를 적용할 수 있다.
- 로그아웃은 현재 사용자의 모든 기존 세션을 폐기하는 동작으로 정의한다.
- Apps in Toss SDK는 최신 안정 버전 `3.0.3`으로 올리고 기존 공개 API 호환성은 타입 검사와 Toss 빌드로 판정한다.

## 범위

- DM 캐릭터 나이 프롬프트 누락 및 한국어 조사 오류
- AI 요청·응답 안전 검사와 Gemini 안전 설정
- 로그아웃 시 서버 세션 버전 증가
- 운영 보안 헤더와 API 문서 기본 비공개
- ORM·Alembic schema 드리프트 정리
- Apps in Toss SDK 업그레이드와 npm 취약점 감사
- 환불 내역 페이지네이션의 공식 `{ key }` 브리지 계약 적용
- Python 의존성 감사 도구와 전체 릴리스 검증

## 제외 범위

- 결제 상품·가격·지급 정책 변경
- OAuth 공급자나 앱인토스 로그인 식별 방식 변경
- 새로운 외부 유료 moderation 공급자 도입
- 새 프론트엔드·백엔드 프로세스 기동

## 단계와 성공 조건

1. AI·UI 회귀 수정 → 나이 설정과 자연스러운 조사가 도메인 테스트로 고정되고 유해 입력·출력이 공급자 호출 또는 사용자 노출 전에 차단된다.
2. 인증·HTTP 하드닝 → 로그아웃 전 토큰이 버전 증가 후 거부되고 모든 응답에 승인된 보안 헤더가 있으며 API 문서는 기본 404다.
3. DB 정합성 → 새 migration 적용 후 `alembic check`가 clean이고 downgrade·upgrade 경로가 검증된다.
4. SDK 업그레이드 → typecheck, domain tests, production build와 `build:toss`가 통과하고 npm audit의 Critical·High가 제거된다.
5. 전체 검증 → backend compile·pytest, PostgreSQL 통합 테스트, Android lint, iOS unsigned Release build를 통과한다.

## 검증 명령

```bash
npm run typecheck
npm run test:domain
npm run build
npm run build:toss -w apps/frontend
npm audit --omit=dev --audit-level=moderate
PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache backend/.venv/bin/python -m compileall -q backend/app backend/tests backend/migrations
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
cd backend && PYTHONPATH=. .venv/bin/alembic check
```

## 위험과 롤백

- SDK 3.x가 기존 IAP API 타입과 호환되지 않으면 패키지 변경을 되돌리고 취약 의존성의 공급사 수정 버전을 확인한다.
- 세션 버전 증가는 로그아웃한 사용자의 모든 기기 세션을 종료한다. 이 동작을 원하지 않으면 기기별 세션 테이블이 필요하지만 이번 범위에는 포함하지 않는다.
- CSP가 법적 문서 자원을 막으면 테스트에서 허용 대상을 최소한으로 조정하고 임의의 광범위 허용은 추가하지 않는다.
- migration은 기존 행의 NULL 시간을 먼저 채운 뒤 NOT NULL을 적용하며 downgrade는 nullable만 복원한다.
