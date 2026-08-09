---
title: ALIVE 계정 삭제 라이프사이클 구현 계획
author: black (black@ashwoodfriends.com)
created: 2026-08-09
updated: 2026-08-09
version: 1.0.0
status: in_progress
---

# ALIVE 계정 삭제 라이프사이클 구현 계획

## 목표

회원탈퇴를 즉시 하드 삭제가 아닌 7일 유예형 삭제 예약으로 전환한다. 탈퇴 직후 계정과 세션을 잠그고, 유예기간 안에는 동일 로그인으로 재인증해 기존 계정·캐릭터·피드·DM을 복구할 수 있게 한다. 유예기간이 끝나면 사용자 소유 DB 데이터와 S3 미디어를 정리한다.

## 범위

- `active`와 `pending_deletion` 계정 상태 및 삭제 예정 시각 저장
- 탈퇴 요청 시 세션 무효화, 접근 차단, 삭제 예정 응답
- 동일 provider 재로그인 시 pending 계정 복구
- 7일 경과 계정의 DB·Apple credential·S3 미디어 정리
- fingerprint 보존기간이 끝난 부정 이용 방지 fingerprint 자동 파기
- S3 또는 외부 revoke 실패 시 DB를 보존하고 다음 주기에 재시도
- provider subject의 HMAC fingerprint 보존으로 향후 가입 보너스 중복 방지 기반 마련
- 탈퇴 API, 저장소, scheduler, 프론트 문구, 법적 안내, 테스트 업데이트

## 비범위

- 크레딧 wallet/ledger와 실제 결제 연동
- `RewardGrant` 보너스 원장 구현
- 유예 중 복구/영구 삭제 선택 화면의 별도 UX
- 실제 PostgreSQL/S3 운영 환경의 배포와 마이그레이션 실행

## 정책 가정

| 항목 | 현재 구현 기준 |
| --- | --- |
| 유예기간 | 탈퇴 요청 시각부터 7일 |
| 탈퇴 직후 | 계정 잠금, 세션 무효화, AI·결제·보너스 접근 차단 |
| 복구 | 유예기간 내 동일 provider 재인증 시 기존 계정 복구 |
| 유예 만료 | DB 사용자 row 삭제, Apple credential revoke, S3 미디어 삭제 |
| 식별 fingerprint | HMAC 기반, `account_identity_hash_secret` 사용; 미설정 시 auth secret fallback |
| fingerprint 보존 | purge 예정일 이후 기본 365일; 법무 확정 필요 |

## 구현 단계

### 1. 데이터와 상태

- `User.account_status`, `deletion_requested_at`, `purge_at` 추가
- `account_deletion_identities` 테이블과 provider·fingerprint unique 제약 추가
- Alembic migration `20260809_0012_account_deletion_lifecycle.py` 작성

### 2. 탈퇴·복구 API

- `DELETE /api/auth/account`가 삭제 예정일을 반환
- 기존 세션 쿠키 삭제 및 `auth_revoked_at` 기록
- pending 계정은 인증 의존성에서 차단
- 유예기간 내 동일 provider 로그인 시 pending 상태 해제
- 만료 직전 또는 만료 후 로그인은 복구하지 않고 삭제 작업 대상 유지

### 3. 만료 정리

- 주기적 scheduler가 `purge_at <= now` 계정을 batch 조회
- 사용자 소유 미디어를 S3에서 먼저 삭제
- Apple 계정이면 저장 credential revoke
- 외부 정리 실패 시 DB 삭제를 진행하지 않고 다음 주기 재시도
- 모든 외부 정리 후 DB 사용자 삭제 및 commit

### 4. 문구와 검증

- 탈퇴 확인·완료 문구를 “삭제 예약/7일 후 영구 삭제”로 통일
- 개인정보처리방침·이용약관·계정 삭제 안내 업데이트
- 서비스 단위 테스트와 프론트 domain 테스트 실행
- backend 의존성 설치 환경에서 pytest와 실제 migration/integration test 실행

## 성공 기준

- [x] 탈퇴 요청이 pending 상태와 `purge_at`을 저장한다.
- [x] 탈퇴 직후 쿠키가 삭제되고 pending 계정의 보호 API 접근이 차단된다.
- [x] 유예기간 내 동일 provider 재로그인으로 기존 계정이 복구된다.
- [x] 만료 계정은 S3 정리 후 Apple revoke와 DB 삭제를 수행한다.
- [x] fingerprint retention 만료 row를 scheduler가 파기한다.
- [x] 미디어 또는 revoke 실패 시 사용자 row가 남아 재시도할 수 있다.
- [x] fingerprint가 provider별로 안정적으로 생성된다.
- [x] 프론트 타입 검사와 domain 테스트가 통과한다.
- [ ] PostgreSQL migration 적용과 backend pytest가 통과한다.
- [ ] 실제 S3·OAuth 환경의 만료 정리 E2E가 통과한다.

## 결정 필요 사항

- fingerprint 보존 목적·기간의 법무 승인
- 구매 크레딧과 보너스의 탈퇴·복구·환불 처리
- pending 계정의 로그인 UX와 “복구” 안내 화면
- 공유 DM·신고·분쟁 자료의 보존 정책
- scheduler 운영 환경, 실패 알림, 수동 재처리 명령

## 검증 명령

```bash
python3 -m compileall -q backend/app backend/migrations backend/tests
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run test:domain
npm --prefix apps/frontend run build
```

backend pytest와 PostgreSQL/S3 통합 검증은 backend 의존성과 실행 환경이 준비된 뒤 수행한다.
