---
title: 운영 데이터 기반 데이터베이스 컬럼 필요성 감사
author: black (black@ashwoodfriends.com)
created: 2026-08-26
updated: 2026-08-26
version: 1.0.0
status: ready
---

# 운영 데이터 기반 데이터베이스 컬럼 필요성 감사

## 결과

2026-08-26 운영 `alive` dump의 애플리케이션 테이블 31개, 컬럼 275개, 1,753 rows를 대상으로 컬럼별 NULL·빈 값·기본값·distinct·직렬화 크기를 집계하고, ORM·repository·service·API·프론트엔드 참조를 대조했다.

현재 코드와 운영 데이터만 기준으로 즉시 제거를 검토할 수 있는 강한 후보는 `apple_oauth_credentials.last_validated_at`, `credit_accounts.version` 2개다. `apple_oauth_credentials`의 access token 관련 2개 컬럼, `email_forwarding_enabled`, `characters.auto_post_legacy_credit_stop_recovered`, `apple_account_events.payload_hash`는 현재 소비 경로가 없거나 과거 migration에만 필요하지만 제품·감사·rollback 정책 확인이 필요한 조건부 후보다. 그 외 컬럼은 현재 기능, 무결성, 멱등성, 감사 또는 미래 상태를 표현하므로 제거 근거가 부족하다.

컬럼 제거보다 우선순위가 높은 저장 개선점도 발견했다. `credit_usages.response_body`는 현재 멱등 요청 재생에 필요하지만 plain dump의 COPY 직렬화 값만 약 13.34 MB로 dump 전체 14.93 MB의 약 89.4%다. 컬럼을 바로 없애기보다 재생 보장 기간을 정한 뒤 오래된 응답을 비우거나 최소 응답만 저장하는 정책이 필요하다.

> 본 감사는 개인정보·OAuth token·DM·콘텐츠 원문을 출력하지 않고 비식별 집계만 사용했다. 컬럼 삭제나 운영 데이터 변경은 수행하지 않았다.

## 판정 기준

| 판정 | 기준 |
|---|---|
| 제거 검토 | 운영 값이 전부 NULL·기본값이고 현재 application read/write 및 제약 의존성이 없음 |
| 조건부 제거 | write-only, migration-only 또는 계획된 기능 여부에 따라 필요성이 달라짐 |
| 유지 | 현재 read/write, API contract, FK·UNIQUE·CHECK·index, 멱등성, 감사 또는 lifecycle 상태에 필요 |
| 컬럼 유지·보존 개선 | 컬럼은 현재 기능에 필요하지만 payload 크기나 보존 기간을 줄일 가치가 큼 |

빈 테이블은 불필요 판정 근거로 사용하지 않았다. 운영 사용자가 아직 기능을 실행하지 않았더라도 repository, API와 테스트가 활성 상태이면 유지로 판정했다.

## 제거·개선 후보

### P1 — `credit_usages.response_body` 보존 기간과 payload 축소

- 운영: 588 rows 중 526 rows가 비어 있지 않으며 COPY 직렬화 기준 13,344,575 bytes다.
- 현재 필요성: committed 중복 요청에서 저장 응답을 그대로 재생한다. [credits.py](../../../backend/app/repositories/credits.py#L69)는 이를 읽고, 같은 파일의 commit 경로는 응답을 저장한다.
- 판정: **컬럼 유지·보존 개선**. 현재 컬럼 삭제는 멱등 응답 재생을 깨뜨린다.
- 권장: 실제 client retry 최대 기간을 측정해 replay TTL을 정하고, TTL 이후 `response_body`를 `{}`로 정리한다. 가능하면 provider 전체 응답이 아니라 API 재생에 필요한 최소 DTO만 저장한다.
- 완료 조건: TTL 안의 중복 요청은 동일 응답을 받고, TTL 밖의 row payload가 batch 정리되며, 환불·비용·token 집계 컬럼은 보존된다.

### P2 — `credit_accounts.version` 제거 검토

- 운영: 18/18 rows가 `0`이다.
- 코드: ORM과 CHECK 제약에는 존재하지만 [CreditAccount 모델](../../../backend/app/models/entities.py#L345) 외에 `CreditAccount.version` read/write가 없다. 현재 잔액 갱신은 row lock을 사용하며 optimistic version 비교를 하지 않는다.
- 판정: **제거 검토**. 현재 구현에서는 의미 없는 상태와 CHECK 제약만 유지한다.
- 주의: 향후 optimistic concurrency를 도입할 계획이면 제거 대신 갱신 로직에 실제 version 증가·비교를 구현해야 한다.

### P2 — `apple_oauth_credentials.last_validated_at` 제거 검토

- 운영: 2/2 rows가 NULL이다.
- 코드: ORM 선언 외 application 참조가 없다. credential 저장·갱신 코드도 이 값을 기록하지 않는다. [apple_credentials.py](../../../backend/app/repositories/apple_credentials.py#L17)
- 판정: **제거 검토**. 향후 주기적 credential validation 기능이 확정되지 않았다면 제거하는 편이 명확하다.

### P2 — Apple access token 저장 최소화

- 대상: `apple_oauth_credentials.access_token_encrypted`, `access_token_expires_at`
- 운영: 두 컬럼 모두 2/2 rows에 값이 있다.
- 코드: OAuth 완료 시 저장하지만 이후 read 경로가 없다. 계정 삭제 시 Apple token revoke는 `refresh_token_encrypted`만 사용한다. [apple_token_revocation.py](../../../backend/app/services/apple_token_revocation.py#L26)
- 판정: **조건부 제거**. 가까운 시일 내 access token 기반 Apple API 호출 계획이 없다면 secret 보유 범위를 줄이기 위해 제거가 유리하다.
- 주의: 제거 전 OAuth callback contract와 token 암호화 migration rollback을 함께 검토해야 한다.

### P3 — Apple 알림 상태·hash의 목적 확정

- `apple_oauth_credentials.email_forwarding_enabled`: 운영 2/2 rows가 NULL이며 email event 수신 시 write만 하고 현재 read는 하지 않는다. [apple_notifications.py](../../../backend/app/services/apple_notifications.py#L82)
- `apple_account_events.payload_hash`: 운영 테이블은 0 rows다. 알림 claim 시 hash를 저장하지만 중복 `event_id`의 payload 변경 여부를 비교하지 않는다. [apple_account_events.py](../../../backend/app/repositories/apple_account_events.py#L17)
- 판정: **조건부 제거**. 전자는 향후 현재 전달 상태 표시·운영 조회가 필요하면 유지하고, 후자는 감사 증거 또는 중복 payload 불일치 탐지를 구현할 경우 유지한다. 둘 다 목적이 없다면 제거한다.

### P3 — `characters.auto_post_legacy_credit_stop_recovered` rollback 경계 이후 제거

- 운영: 21 rows 중 8 rows가 `true`, 13 rows가 `false`다.
- 코드: 현재 application은 사용자가 자동 게시 설정을 변경할 때 `false`로 쓰지만 이 값을 읽지 않는다. [character_posts.py](../../../backend/app/repositories/character_posts.py#L37)
- 역사적 목적: migration `20260820_0030`이 과거 credit 부족으로 중단된 자동 게시를 복구하고, 해당 migration downgrade에서만 복구 대상을 되돌리는 표식이다. [20260820_0030_auto_post_claim_lease.py](../../../backend/migrations/versions/20260820_0030_auto_post_claim_lease.py#L17)
- 판정: **조건부 제거**. `20260820_0030` 이전으로 운영 rollback하지 않는다는 정책을 확정한 뒤 cleanup migration으로 제거한다. cleanup migration의 downgrade는 해당 컬럼을 재생성해야 과거 downgrade chain을 보존할 수 있다.

## 테이블별 판정

| 테이블 | 운영 Rows | 판정 | 근거·후보 |
|---|---:|---|---|
| `account_deletion_identities` | 1 | 유지 | 재가입 제한, 식별자 hash와 보존기한 cleanup에 모두 필요 |
| `ai_daily_usage` | 105 | 유지 | 일별 호출 한도와 예약·실비 비용 정산에 사용 |
| `ai_monthly_usage` | 2 | 유지 | 월 비용 한도와 예약·실비 비용 정산에 사용 |
| `app_store_accounts` | 2 | 유지 | 사용자와 App Store account token 연결·중복 방지에 필요 |
| `app_store_notification_events` | 5 | 유지 | 알림 멱등성, stale claim 재시도, 처리 결과 감사에 필요; 현재 `failure_reason`이 전부 빈 값인 것은 성공 상태뿐이기 때문 |
| `apple_account_events` | 0 | 조건부 제거 | `payload_hash`의 감사·불일치 탐지 목적을 확정; 나머지는 알림 멱등성과 처리 이력에 필요 |
| `apple_oauth_credentials` | 2 | 제거·조건부 제거 | `last_validated_at` 제거 검토; access token 2개와 `email_forwarding_enabled`는 제품 계획 확인 후 제거 |
| `character_follows` | 0 | 유지 | follow/unfollow, follower count, follow-back 경로와 FK·UNIQUE에 필요 |
| `character_post_likes` | 0 | 유지 | like API의 권한·중복 방지와 집계에 필요 |
| `characters` | 21 | 조건부 제거 | `auto_post_legacy_credit_stop_recovered`만 rollback 경계 이후 제거; `gallery`·`following`은 모두 빈 배열이지만 active API contract와 public snapshot 생성에 사용 |
| `content_reports` | 0 | 유지 | 신고 생성, moderation queue, 처리 결과 및 제재 감사에 필요 |
| `credit_accounts` | 18 | 제거 검토 | `version`은 18/18이 0이고 runtime read/write 없음; 잔액·debt는 결제와 chargeback에 필요 |
| `credit_ledger_entries` | 379 | 유지 | 잔액 재구성, 중복 방지, 구매·환불·chargeback 감사 원장 |
| `credit_purchases` | 12 | 유지 | 가격·storefront 일부가 provider별로 비어 있어도 reconciliation, 환불, 보존 정책과 운영 감사에 필요 |
| `credit_usages` | 588 | 컬럼 유지·보존 개선 | `response_body`가 현재 멱등 재생에 필요하나 13.34 MB로 과도하게 크므로 TTL·최소 DTO 적용 |
| `dm_threads` | 13 | 유지 | `messages`와 `world_pref` 모두 API contract이며 `world_pref`도 3 rows에서 사용 |
| `energy_accounts` | 18 | 유지 | 에너지 차감·회복과 회복 기준 시각에 필요 |
| `feed_request_limits` | 8 | 유지 | feed 요청 window rate limit 상태에 필요 |
| `google_play_accounts` | 3 | 유지 | obfuscated account ID와 사용자 연결·중복 방지에 필요 |
| `google_play_rtdn_events` | 0 | 유지 | RTDN 멱등성, stale claim retry, 처리 결과에 필요한 active 경로 |
| `media_assets` | 0 | 유지 | 업로드 완료 검증, 소유권, checksum, 크기·치수, soft-delete lifecycle에 필요한 active API contract |
| `native_oauth_codes` | 47 | 유지 | code hash, 만료, 1회 사용 검증에 모두 필요; 컬럼 삭제가 아니라 만료 row cleanup이 필요 |
| `personas` | 0 | 유지 | structured state 동기화와 profile 응답의 active contract |
| `profiles` | 26 | 유지 | `app_state` 19 rows가 사용 중이며 프론트엔드 bootstrap backup으로 실제 소비됨. [useAliveProfileBootstrap.ts](../../../apps/frontend/src/hooks/useAliveProfileBootstrap.ts#L174) |
| `public_feed_posts` | 399 | 유지 | 공개 feed pagination용 projection이며 캐릭터 JSON 전체 scan을 피함 |
| `reward_grants` | 37 | 유지 | 가입·첫 DM reward의 중복 지급 방지 및 지급 감사 |
| `shared_characters` | 16 | 유지 | discover/follower 공개 snapshot. `character` JSON이 359 KB로 중복은 있으나 현재 detail DTO와 관계 판단에 사용 |
| `shared_dm_threads` | 0 | 유지 | 참여자 권한, 공동 DM, moderation 삭제 경로의 active contract |
| `user_blocks` | 0 | 유지 | discover·DM·신고 영역의 양방향 차단 권한 검사에 필요 |
| `user_policy_consents` | 25 | 유지 | `accepted_at`은 application에서 읽지 않아도 약관 동의 시점 감사 증거이므로 유지 |
| `users` | 26 | 유지 | 현재 모두 active라 lifecycle 컬럼이 NULL·기본값이지만 탈퇴, session revoke, Apple 알림과 moderation 경로에 필요 |

## 큰 JSON projection 관찰

plain dump의 COPY 직렬화 값 기준이며 PostgreSQL의 실제 relation·TOAST 크기와는 다르다.

| 컬럼 | 직렬화 크기 | 판정 |
|---|---:|---|
| `credit_usages.response_body` | 13,344,575 bytes | replay TTL과 최소 DTO 필요 |
| `shared_characters.character` | 359,045 bytes | 현재 public detail snapshot에 필요; 장기적으로 posts 분리 검토 |
| `characters.posts` | 340,577 bytes | authoritative post 저장소로 유지 |
| `public_feed_posts.payload` | 339,771 bytes | feed pagination projection으로 유지 |
| `profiles.app_state` | 55,267 bytes | frontend bootstrap backup으로 유지; structured state 전환 완료 후 재평가 |

`characters.posts`, `shared_characters.character.posts`, `public_feed_posts.payload`는 같은 게시물 계열 데이터를 서로 다른 조회 경로에 projection한다. 현재 endpoint가 각각을 소비하므로 컬럼 단위 삭제는 안전하지 않다. 장기적으로 `shared_characters.character`에서 posts를 제외하고 detail 조회를 `public_feed_posts`로 통합하면 중복 payload를 줄일 수 있으나 API 응답·정렬·comment 동기화 설계가 먼저 필요하다.

## 검증 결과

- 운영 dump COPY parser: passed — 31개 애플리케이션 테이블, 275개 컬럼, 1,753 rows 집계
- ORM 대조: passed — 운영 컬럼 집합과 `backend/app/models/entities.py` 일치
- application 참조 검색: passed — backend model/repository/service/API와 frontend profile bootstrap 확인
- 민감 데이터 비출력 검사: passed — 보고서에는 원문 식별자, token, DM, 콘텐츠, 결제 ID 없음
- application process·테스트 실행: not run — 분석 작업이며 코드 변경이 없어 프로세스를 시작하지 않음

## 검증하지 못한 것

- dump 이후 운영 write는 포함하지 않는다.
- PostgreSQL `pg_stat_statements`, column-level query frequency, 실제 relation·TOAST 크기는 수집하지 않았다.
- 운영팀이 수동 SQL·BI·감사 도구로 조회하는 컬럼은 repository 검색만으로 확인할 수 없다.
- 컬럼 제거 migration과 staging restore는 아직 작성·실행하지 않았다.

## 권장 실행 순서

1. `credit_usages.response_body`의 실제 client retry 기간을 계측하고 보존 정책을 결정한다.
2. `credit_accounts.version`, `apple_oauth_credentials.last_validated_at` 제거 migration을 별도 계획한다.
3. Apple access token 보유 필요성과 email-forwarding 상태의 제품·운영 소비 여부를 결정한다.
4. `20260820_0030` 이전 rollback 지원 종료 시 legacy auto-post 표식 컬럼을 정리한다.
5. 각 제거는 staging dump restore → migration upgrade/downgrade → backend 테스트 → 운영 전 row 재집계 순서로 검증한다.
