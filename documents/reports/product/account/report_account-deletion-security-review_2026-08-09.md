---
title: ALIVE 계정 삭제 라이프사이클 보안·우회 검토
author: black (black@ashwoodfriends.com)
created: 2026-08-09
updated: 2026-08-09
version: 1.0.0
status: draft
---

# ALIVE 계정 삭제 라이프사이클 보안·우회 검토

## 결과

7일 유예형 계정 삭제 구현은 `3d1c294 feat: add account deletion grace lifecycle`로 커밋되었다. 정적 코드 검토 결과, 현재 즉시 악용되는 크레딧 지급 기능은 없지만 크레딧·보너스 연결 전에 반드시 해결해야 할 구조적 위험이 확인되었다. 특히 fingerprint가 신규 가입·보너스 지급을 실제로 차단하지 않는 점, 삭제 scheduler와 계정 복구의 동시성, 복구 후 기존 JWT 세션 재활성화, 운영 secret 기본값을 우선 조치해야 한다.

검토 시점에는 application code를 수정하지 않았으며, 이후 후속 변경에서 일부 항목을 반영했다. 남은 항목은 보안·정합성 backlog로 관리한다.

## 후속 적용 상태

이 문서 작성 후 다음 항목을 코드에 반영했다.

- 보존기간 중 동일 provider 신규 계정 생성 차단
- 탈퇴 요청 idempotency와 fingerprint upsert race 완화
- purge 대상 `FOR UPDATE SKIP LOCKED` claim 및 계정별 실패 격리
- 탈퇴·복구 시 session version 증가와 기존 JWT 거부
- 공유 DM participant ID와 label 배열 정합성 보정
- Toss CORS origin 정규식의 전체 문자열 일치

아직 남은 항목:

- `RewardGrant`·wallet·ledger 구현과 실제 보너스 지급 연동
- 공유 DM 본문·첨부파일의 최종 익명화/보존 정책
- 배포 플랫폼의 secret 주입과 운영 cookie 설정 확인
- CSRF, rate limit, scheduler metric/alert, 실제 PostgreSQL·S3·OAuth 통합 검증

## 검토 범위

- 탈퇴 예약·복구·만료 purge 경로
- OAuth/Toss 재가입과 provider subject fingerprint
- 세션 무효화와 pending 계정 접근 차단
- DB·S3·Apple credential 삭제 순서와 재시도
- 다중 backend worker 동시성
- 배포 secret·쿠키·CORS 설정
- 크레딧 가입 보너스와 첫 결제 보너스 연결 시 우회 가능성

## 심각도 기준

| 등급 | 의미 |
| --- | --- |
| P0 | 크레딧 연결 또는 운영 배포 전에 차단해야 하는 위험 |
| P1 | 데이터 삭제·인증·운영 정합성에 영향을 주는 높은 위험 |
| P2 | 출시 전 보완해야 하는 방어·관측성 개선 |

## P0 — 크레딧 연결 전 차단 필요

### P0-1. fingerprint enforcement는 적용됐지만 RewardGrant가 아직 없음

`AccountDeletionService`는 탈퇴 시 fingerprint를 upsert하고, 현재는 `UserRepository.get_or_create_provider_user`에서 보존기간 중 fingerprint를 조회해 신규 계정 생성을 차단한다. 다만 `RewardGrant`, wallet, credit ledger가 없으므로 실제 보너스 지급의 중복 방지는 아직 별도 구현이 필요하다.

현재 동일 provider 계정은 retention 기간 중 fingerprint 차단으로 새 `user_id`를 만들 수 없다. 다만 다른 provider로 가입하거나 retention 만료 후 새 계정이 만들어진 뒤, 보너스를 `user_id`만으로 지급하면 중복 지급이 가능하다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:72`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/account_deletion.py:13`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:32`

남은 대응:

- `RewardGrant`를 `user_id`와 분리하고 `claim_key` unique 제약을 둔다.
- 가입·캐릭터 생성·첫 DM·첫 결제 보너스를 모두 원장 이벤트로 기록한다.
- 탈퇴·복구·환불 시 grant 상태를 서버에서 재계산한다.
- Google·Apple·Toss 간 provider 변경을 별도 abuse 정책으로 다룬다.

### P0-2. 배포 secret은 조건부 확인 필요

저장소에는 `.env` 파일이 추적되지 않지만, 설정에 알려진 기본 인증키와 `AUTH_COOKIE_SECURE=false` 기본값이 존재한다. 배포 환경에 secret이 주입되지 않으면 누구나 세션 서명을 위조할 수 있고, HTTPS 환경에서도 세션 쿠키가 Secure 없이 전송될 수 있다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/core/config.py:16`
- `/Users/deemo/Desktop/instarChar/backend/app/core/security.py:43`

현재 배포 플랫폼이 별도 Secret 환경변수를 주입한다면 이 위험은 발생하지 않는다. 배포 환경에서 `AUTH_SECRET_KEY`가 랜덤값인지, `AUTH_COOKIE_SECURE=true`인지 확인해야 한다. 로컬 또는 CI에 실제처럼 보이는 S3 자격증명이 있었다면 값 자체를 문서·로그에 남기지 말고 유효 여부를 확인한 뒤 필요 시 즉시 교체한다.

## P1 — 삭제·인증 정합성 위험

### P1-1. 만료 purge와 재로그인 복구의 race condition

만료 계정은 현재 `FOR UPDATE SKIP LOCKED`로 한 건씩 claim하도록 수정했다. 실제 PostgreSQL에서 복구 요청과 purge가 경합할 때 한쪽 transaction만 상태를 확정하는 통합 테스트가 아직 필요하다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:50`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:39`
- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:41`

추가 검증·보완:

- `SELECT ... FOR UPDATE SKIP LOCKED`로 purge 대상을 claim한다.
- claim과 상태 재확인을 같은 transaction에서 수행한다.
- 실제 PostgreSQL에서 `purge_at` 경계 시각 복구 경합 테스트를 수행한다.

### P1-2. 다중 backend worker가 같은 계정을 중복 purge할 수 있음

삭제 scheduler는 여전히 FastAPI lifespan마다 시작되지만, purge query가 `FOR UPDATE SKIP LOCKED`로 계정별 claim을 수행하도록 수정했다. 별도 worker 분리와 운영 lock/metric은 후속 검토 대상이다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/main.py:29`
- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion_scheduler.py:29`

DB claim으로 동일 계정 중복 purge 가능성은 줄였지만, scheduler가 replica마다 실행되는 구조와 운영 metric/alert는 남아 있다. 장기적으로 단일 외부 worker 분리를 검토한다.

### P1-3. 복구 후 탈퇴 전 JWT가 다시 활성화될 수 있음

현재 session payload에는 `session_version`이 포함된다. 탈퇴·복구 시 세대가 증가하므로 탈취된 기존 JWT는 복구 후에도 통과하지 않는다. 기존 세션 토큰은 새 payload 형식에서 거부된다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/core/security.py:43`
- `/Users/deemo/Desktop/instarChar/backend/app/api/deps.py:44`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:45`

추가 검증:

- 실제 데이터베이스 migration 후 기존 토큰·탈퇴·복구 흐름을 E2E로 검증한다.
- `auth_revoked_at`의 Apple provider 상태와 일반 세션 무효화 역할 분리는 별도 정리한다.

### P1-4. 삭제 요청이 idempotent하지 않고 동시 upsert 충돌 가능

이미 pending인 계정의 탈퇴 재요청은 기존 `purge_at`을 반환한다. fingerprint 저장은 PostgreSQL upsert로 변경해 같은 fingerprint 동시 요청의 unique violation 가능성을 줄였다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:30`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/account_deletion.py:13`

추가 검증:

- PostgreSQL에서 동시 탈퇴 요청과 fingerprint upsert 통합 테스트를 수행한다.

### P1-5. 공유 DM·미디어 삭제 정책이 완전히 일치하지 않음

다른 사용자가 참여한 공유 DM thread는 유지되며, 탈퇴 사용자 메시지 본문은 보존될 수 있다. participant ID와 label 배열은 탈퇴 사용자 제거 시 함께 정리하도록 수정했지만, 공유 DM 본문·첨부파일의 최종 익명화/보존 정책은 아직 결정되지 않았다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:55`
- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:60`
- `/Users/deemo/Desktop/instarChar/backend/app/legal/account-deletion.html:43`

대응:

- 공유 DM의 탈퇴 사용자 메시지를 익명화·삭제·placeholder 처리 중 하나로 확정한다.
- 공유 attachment를 계속 제공할지, 참조를 제거할지 정책화한다.
- 개인정보처리방침과 실제 DB/S3 동작을 일치시킨다.

### P1-6. AUTH_SECRET_KEY 변경 시 fingerprint 중복 방지 정책이 흔들림

fingerprint는 별도 환경변수 없이 기존 `AUTH_SECRET_KEY`로 생성하도록 단순화했다. 다만 인증키를 교체하면 동일 provider subject의 fingerprint가 달라져 과거 보너스 차단이 실패할 수 있다.

근거: `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:77`

남은 대응:

- `AUTH_SECRET_KEY` rotation 전 fingerprint 재생성 또는 versioned hash 전략을 적용한다.
- retention 기간과 목적을 법무 정책으로 확정한다.

## P2 — 출시 전 보완 권장

### P2-1. rate limit·CSRF·관측성 부족

탈퇴 API와 재로그인 흐름에 별도 rate limit이 없고, cookie 인증 destructive endpoint에 CSRF token도 없다. 현재 `SameSite=Lax`와 CORS 설정이 완화 요인이지만, `SameSite=None`을 사용하거나 origin 설정이 바뀌면 위험이 커진다.

또한 scheduler 실패가 로그에만 남고 pending 계정 수·실패 횟수·지연 시간이 외부 모니터링되지 않는다.

대응:

- provider login, 탈퇴 요청, 보너스 claim에 rate limit을 추가한다.
- cookie 인증에는 CSRF token 또는 double-submit 방어를 추가한다.
- pending 계정 수와 purge 실패를 metric/alert로 노출한다.

### P2-2. Toss origin 정규식과 orphan media 점검

Toss origin 정규식은 끝 앵커가 없어 CORS 구현의 prefix match 동작에 의존한다. `^...$` 형태로 정확히 제한하는 편이 안전하다. 또한 현재 purge는 DB에 등록된 MediaAsset만 삭제하므로 과거 orphan S3 object는 별도 scanner가 필요하다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/core/config.py:82`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/media_assets.py:23`

## 우회 시나리오 요약

| 시나리오 | 현재 상태 | 방어 필요 지점 |
| --- | --- | --- |
| 탈퇴 후 7일 뒤 재가입해 가입 보너스 재수령 | 크레딧 원장 미구현, 향후 우회 가능 | fingerprint + RewardGrant |
| 동시 로그인·purge로 복구 계정 삭제 | race 가능 | row lock/claim/recheck |
| 탈퇴 전 탈취 JWT를 복구 후 재사용 | JWT 세션 세대 없음 | session version/revoked_before |
| 여러 worker가 같은 계정 purge | 중복 처리 가능 | `SKIP LOCKED` 또는 단일 worker |
| 여러 provider로 보너스 반복 수령 | provider별 fingerprint만 존재 | 계정 연계·risk policy |
| S3 object 잔존 | 등록된 asset만 정리 | orphan scanner와 retry metric |

## 검증 결과

- `python3 -m compileall -q backend/app backend/migrations backend/tests`: passed
- `npm --prefix apps/frontend run typecheck`: passed
- `npm --prefix apps/frontend run test:domain`: passed — 128/128
- `npm --prefix apps/frontend run build`: passed
- `git diff --check`: passed
- backend pytest: not run — 현재 환경에 backend 의존성과 `pytest`가 설치되지 않음
- PostgreSQL migration 적용: not run — 실행 중인 DB와 rollback/backup 검증 필요
- 다중 worker purge/복구 race test: not run — 통합 테스트 환경 필요
- 실제 S3·Apple OAuth 삭제 E2E: not run — 운영과 분리된 staging credential 필요

## 다음 추천 작업

1. 크레딧 개발 전에 `RewardGrant`와 fingerprint enforcement를 구현한다.
2. purge/복구에 DB claim lock과 session version을 추가한다.
3. 운영 Secret 환경변수와 cookie 설정을 배포 플랫폼에서 확인한다.
4. 공유 DM 익명화·미디어 참조 정책을 확정하고 통합 테스트를 추가한다.

## 출시 판단

현재 구현은 7일 삭제 예약의 기능 초안으로는 사용 가능하지만, 크레딧 보너스와 실결제를 연결하기 전에는 P0·P1 항목을 해결해야 한다. 특히 fingerprint 저장만으로는 재가입 보너스 악용을 막을 수 없다.
