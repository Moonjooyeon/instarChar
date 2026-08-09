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

이번 검토에서는 application code를 수정하지 않았다. 아래 항목은 보안·정합성 수정 backlog로 관리한다.

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

### P0-1. fingerprint가 저장만 되고 신규 가입·보너스 지급에서 검사되지 않음

`AccountDeletionService`는 탈퇴 시 fingerprint를 upsert하지만, `UserRepository.create_provider_user`는 삭제 fingerprint를 조회하지 않고 새 사용자를 생성한다. 현재 `RewardGrant`, wallet, credit ledger가 없으므로 실제 보너스 무한 지급은 아직 활성화되지 않았다. 그러나 보너스를 `user_id`만으로 지급하면 다음 우회가 가능하다.

```text
가입 → 가입/온보딩 보너스 수령 → 탈퇴 → 7일 후 purge
→ 동일 provider 로그인으로 새 user_id 생성 → 보너스 재수령
```

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:72`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/account_deletion.py:13`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:32`

대응:

- 신규 provider identity 생성 전에 fingerprint를 조회한다.
- `RewardGrant`를 `user_id`와 분리하고 `claim_key` unique 제약을 둔다.
- 가입·캐릭터 생성·첫 DM·첫 결제 보너스를 모두 원장 이벤트로 기록한다.
- 탈퇴·복구·환불 시 grant 상태를 서버에서 재계산한다.
- Google·Apple·Toss 간 provider 변경을 별도 abuse 정책으로 다룬다.

### P0-2. 배포 secret은 조건부 확인 필요

저장소에는 `.env` 파일이 추적되지 않지만, 설정에 알려진 기본 인증키와 `AUTH_COOKIE_SECURE=false` 기본값이 존재한다. 배포 환경에 secret이 주입되지 않으면 누구나 세션 서명을 위조할 수 있고, HTTPS 환경에서도 세션 쿠키가 Secure 없이 전송될 수 있다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/core/config.py:16`
- `/Users/deemo/Desktop/instarChar/backend/app/core/security.py:43`

현재 배포 플랫폼이 별도 Secret 환경변수를 주입한다면 이 위험은 발생하지 않는다. 배포 환경에서 `AUTH_SECRET_KEY`가 랜덤값인지, `ACCOUNT_IDENTITY_HASH_SECRET`가 별도 랜덤값인지, `AUTH_COOKIE_SECURE=true`인지 확인해야 한다. 로컬 또는 CI에 실제처럼 보이는 S3 자격증명이 있었다면 값 자체를 문서·로그에 남기지 말고 유효 여부를 확인한 뒤 필요 시 즉시 교체한다.

## P1 — 삭제·인증 정합성 위험

### P1-1. 만료 purge와 재로그인 복구의 race condition

만료 계정을 조회하는 `list_due_deletions`에 row lock이나 claim 상태가 없다. scheduler가 계정을 조회한 직후 사용자가 재로그인해 `active`로 복구되면, scheduler가 이전 객체를 기준으로 삭제를 계속할 수 있다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:50`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:39`
- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:41`

대응:

- `SELECT ... FOR UPDATE SKIP LOCKED`로 purge 대상을 claim한다.
- claim과 상태 재확인을 같은 transaction에서 수행한다.
- `purging` 상태 또는 deletion request version을 둔다.
- 복구는 `pending_deletion`과 `purge_at > now` 조건부 update로만 허용한다.

### P1-2. 다중 backend worker가 같은 계정을 중복 purge할 수 있음

삭제 scheduler가 FastAPI lifespan마다 시작된다. 서버 replica나 worker가 여러 개면 여러 scheduler가 같은 pending 계정을 동시에 조회할 수 있다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/main.py:29`
- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion_scheduler.py:29`

중복 S3 삭제와 Apple revoke가 발생할 수 있고, 한 worker가 DB를 삭제한 뒤 다른 worker가 stale row를 commit하는 상황도 생길 수 있다. 단일 외부 worker로 분리하거나 DB claim/lock을 반드시 적용해야 한다.

### P1-3. 복구 후 탈퇴 전 JWT가 다시 활성화될 수 있음

현재 session payload에는 `user_id`와 `exp`만 있고 발급 시각이나 세션 버전이 없다. 탈퇴 시 `auth_revoked_at`을 설정하지만 복구 시 이를 지우므로, 탈취된 기존 JWT가 만료 전이면 복구 후 다시 통과할 수 있다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/core/security.py:43`
- `/Users/deemo/Desktop/instarChar/backend/app/api/deps.py:44`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:45`

대응:

- `session_version` 또는 `revoked_before`를 User에 추가한다.
- 탈퇴와 복구 시 세션 세대를 증가시킨다.
- JWT에 version 또는 `iat`를 포함하고 매 요청 DB 상태와 비교한다.
- `auth_revoked_at`을 Apple provider 상태와 일반 세션 무효화 용도로 분리한다.

### P1-4. 삭제 요청이 idempotent하지 않고 동시 upsert 충돌 가능

탈퇴 요청마다 `purge_at`을 현재 시각 기준으로 다시 계산한다. 동시 요청이나 재시도에 따라 삭제 예정일이 뒤로 밀릴 수 있다. fingerprint repository도 “조회 후 없으면 insert” 구조라 같은 fingerprint의 동시 요청에서 unique violation이 발생할 수 있다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:30`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/account_deletion.py:13`

대응:

- 이미 pending이면 기존 `purge_at`을 반환한다.
- fingerprint 저장은 PostgreSQL `ON CONFLICT DO UPDATE`로 바꾼다.
- 탈퇴 상태 변경에 optimistic version 또는 row lock을 적용한다.

### P1-5. 공유 DM·미디어 삭제 정책이 완전히 일치하지 않음

다른 사용자가 참여한 공유 DM thread는 유지되지만, 탈퇴 사용자 메시지·이름·메시지 JSON은 남을 수 있다. 반대로 사용자 소유 MediaAsset의 S3 object는 삭제되므로 공유 DM이 미디어 ID를 계속 참조하면 깨진 attachment가 남을 수 있다.

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py:55`
- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:60`
- `/Users/deemo/Desktop/instarChar/backend/app/legal/account-deletion.html:43`

대응:

- 공유 DM의 탈퇴 사용자 메시지를 익명화·삭제·placeholder 처리 중 하나로 확정한다.
- 공유 attachment를 계속 제공할지, 참조를 제거할지 정책화한다.
- 개인정보처리방침과 실제 DB/S3 동작을 일치시킨다.

### P1-6. fingerprint secret 변경 시 중복 방지 정책이 흔들림

전용 `ACCOUNT_IDENTITY_HASH_SECRET`이 없으면 `AUTH_SECRET_KEY`를 fallback으로 사용한다. 인증키를 교체하면 동일 provider subject의 fingerprint가 달라져 과거 보너스 차단이 실패할 수 있다.

근거: `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py:77`

대응:

- fingerprint 전용 secret을 필수화한다.
- fingerprint version을 저장하고 secret rotation 시 이전 버전도 검증한다.
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
