---
title: 운영 데이터베이스 dump 및 무결성 감사
author: black (black@ashwoodfriends.com)
created: 2026-08-26
updated: 2026-08-26
version: 1.0.0
status: ready
---

# 운영 데이터베이스 dump 및 무결성 감사

## 결과

운영 PostgreSQL cluster에서 `alive` 데이터베이스만 plain SQL로 dump하여 로컬에 복사하고 SHA-256을 대조했다. 운영 revision은 코드의 최신 Alembic head인 `20260825_0033`과 일치했다. 애플리케이션 테이블 31개, 컬럼 275개, 데이터 1,753 rows를 검사했으며 PK·UNIQUE 중복, FK orphan, 주요 CHECK 위반, JSON 손상, 크레딧 원장 불일치, 공개 피드 projection 누락은 발견되지 않았다.

dump에는 사용자 식별자, OAuth subject, DM, 캐릭터 콘텐츠 및 결제 이력이 포함될 수 있으므로 저장소 밖에 권한 `0600`으로 보관했다. 본 보고서에는 개인정보 원문을 기록하지 않는다.

## Dump 증거

| 항목 | 값 |
|---|---|
| 대상 | PostgreSQL의 `alive` 데이터베이스만 포함 |
| 형식 | `pg_dump --format=plain`, schema + data |
| 로컬 파일 | `/Users/ukdong/alive-db-dumps/alive-prod-20260826-646cadc9.sql` |
| 파일 크기 | 14,934,405 bytes |
| SHA-256 | `646cadc93b89683a171b4eb11158c427103092c16f2361806ccd008dc60c30df` |
| 파일 권한 | `0600` |
| 원격 임시 파일 | 로컬 checksum 대조 후 삭제 완료 |

## 스키마 대조

| 검사 | 결과 |
|---|---|
| Alembic revision | `20260825_0033` 일치 |
| 애플리케이션 테이블 | 기대 31개, 실제 31개 |
| 컬럼 집합 | 31개 테이블 모두 ORM과 일치 |
| 컬럼 순서 | 9개 테이블은 migration 추가 순서 때문에 ORM 선언 순서와 다르지만 누락·추가 컬럼은 없음 |
| 명시적 constraint | ORM에 이름이 있는 constraint 모두 dump에 존재 |
| 보조 index | ORM에 이름이 있는 index 모두 dump에 존재 |
| 공개 피드 동기화 trigger | `sync_public_feed_posts` 존재 |

컬럼 순서만 다른 테이블은 `ai_daily_usage`, `ai_monthly_usage`, `apple_oauth_credentials`, `character_post_likes`, `characters`, `credit_accounts`, `credit_purchases`, `credit_usages`, `users`다. PostgreSQL 동작이나 ORM mapping에는 문제가 없으며 schema drift로 판단하지 않는다.

## 테이블별 row 수

`alembic_version` 1 row는 애플리케이션 데이터 합계에서 제외했다.

| 테이블 | Rows |
|---|---:|
| `account_deletion_identities` | 1 |
| `ai_daily_usage` | 105 |
| `ai_monthly_usage` | 2 |
| `app_store_accounts` | 2 |
| `app_store_notification_events` | 5 |
| `apple_account_events` | 0 |
| `apple_oauth_credentials` | 2 |
| `character_follows` | 0 |
| `character_post_likes` | 0 |
| `characters` | 21 |
| `content_reports` | 0 |
| `credit_accounts` | 18 |
| `credit_ledger_entries` | 379 |
| `credit_purchases` | 12 |
| `credit_usages` | 588 |
| `dm_threads` | 13 |
| `energy_accounts` | 18 |
| `feed_request_limits` | 8 |
| `google_play_accounts` | 3 |
| `google_play_rtdn_events` | 0 |
| `media_assets` | 0 |
| `native_oauth_codes` | 47 |
| `personas` | 0 |
| `profiles` | 26 |
| `public_feed_posts` | 399 |
| `reward_grants` | 37 |
| `shared_characters` | 16 |
| `shared_dm_threads` | 0 |
| `user_blocks` | 0 |
| `user_policy_consents` | 25 |
| `users` | 26 |
| **합계** | **1,753** |

## 무결성 검사

| 검사 | 결과 |
|---|---|
| PK·UNIQUE 중복 | 0건 |
| FK orphan | 0건 |
| 캐릭터 handle 형식·예약어 위반 | 0건 |
| 크레딧·에너지·구매·사용량 수치/상태 제약 위반 | 0건 |
| JSONB decode 오류 | 0건 |
| `credit_accounts`와 `credit_ledger_entries` 잔액 불일치 | 0건 |
| 공개 캐릭터 게시글 대비 `public_feed_posts` 누락 | 0건 |
| `public_feed_posts` 불필요한 추가 row | 0건 |
| 원본 없는 `shared_characters` snapshot | 0건 |
| 원본·공유 캐릭터 handle 불일치 | 0건 |
| 처리 중·실패·검토 상태 구매 | 0건 |
| 미소비 Google Play 지급 구매 | 0건 |
| 보존 기한 없는 탈퇴 사용자 구매 | 0건 |

## 비식별 운영 집계

- 사용자 26명: Google 9, Apple 2, Toss 15
- 사용자 26명 모두 `active`, moderation 상태도 모두 `active`
- 캐릭터 21개 모두 공개 상태
- 자동 게시 활성 캐릭터 4개, 현재 due 0개, stale claim 0개
- 과거 자동 게시 실패 횟수가 남은 캐릭터 8개가 있으나 활성 캐릭터에는 없고 각 row의 최대 실패 횟수는 1회
- 구매 12건 모두 `granted`: Apps in Toss sandbox 3, Apps in Toss 1, App Store 5, Google Play 3
- App Store notification 5건 모두 `granted`
- AI credit usage 588건: committed 526, refunded 62, 10분 이상 reserved 0

## 개선 필요 사항

### P2 — 만료 native OAuth code 정리

`native_oauth_codes` 47건이 모두 만료됐고 44건은 사용 완료, 3건은 만료 미사용 상태다. 인증 검증에는 문제가 없지만 cleanup 경로가 없어 row가 계속 누적된다.

권장 조치:

1. `expires_at` index를 추가한다.
2. account deletion scheduler 또는 별도 maintenance job에서 만료 row를 batch 삭제한다.
3. 보존 기간을 정하고 만료 후 일정 유예 기간이 지난 row만 삭제한다.

### P2 — Legacy AI 비용 metadata

`usage_metadata_complete=false`는 76건이다. 이 중 63건은 `legacy` prompt이며 committed 상태에서 `provider_cost_usd=0`인 63건과 정확히 일치한다. 현재 `ai-prompt-2026-08-v1`에는 metadata 누락과 0원 committed row가 없으므로 현재 생성 경로의 회귀로 보이지 않는다. `ai-prompt-2026-08-v2`의 미완전 13건은 committed 0원 row가 아니며 실패·환불 계열로 해석된다.

권장 조치:

- legacy 비용을 소급 보정하지 않는다면 운영 지표에서 `usage_metadata_complete=false`를 별도 집계한다.
- 최신 prompt version에서 committed metadata 누락이 다시 발생할 때만 경보를 발생시킨다.

## 검증 한계

- dump snapshot을 대상으로 검사했으므로 dump 이후 발생한 write는 포함하지 않는다.
- 실제 query 성능, index 사용률, table bloat, connection 수와 lock 대기는 검사하지 않았다.
- plain SQL의 복원 가능성은 문법·구조 기준으로 확인했으며 별도 PostgreSQL에 실제 restore하지 않았다.
- 개인정보 원문, DM 내용, OAuth token, 결제 식별자는 출력하거나 보고서에 기록하지 않았다.

## 다음 추천 작업

1. `native_oauth_codes` cleanup migration과 batch 삭제 job을 추가한다.
2. 내부 readiness 검사에서 기대 Alembic head와 운영 `alembic_version`을 비교한다.
3. staging PostgreSQL에 이 dump를 복원해 migration rehearsal과 query plan 검증을 수행한다.
