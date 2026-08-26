---
title: 로컬 PostgreSQL migration rehearsal 결과
author: black (black@ashwoodfriends.com)
created: 2026-08-26
updated: 2026-08-26
version: 1.1
status: implemented-local
---

# 로컬 PostgreSQL migration rehearsal 결과

## 결과

기존 `instarchat-local-db`의 `instarchat` 데이터베이스를 custom-format으로 백업한 뒤 Alembic revision `20260724_0004`에서 `20260825_0033`까지 upgrade했다. 마지막 revision은 데이터 손실 가능성이 없음을 확인하고 `0033 → 0032 → 0033`으로 왕복 검증했다. 별도 빈 DB의 최초 revision → latest head와 ORM drift 검사도 통과했다. 운영 `alive` dump도 별도 DB에 복원해 schema와 주요 row count를 확인했다. 운영 복사본의 마지막 revision downgrade는 App Store 데이터가 복구되지 않는 비가역 작업임을 확인했다.

## 대상과 백업

| 항목 | 결과 |
|---|---|
| PostgreSQL | 16.13, `instarchat-local-db` |
| 대상 DB | `instarchat` |
| 시작 revision | `20260724_0004` |
| 시작 크기 | 45MB |
| 백업 형식 | PostgreSQL custom format |
| 백업 파일 | `/private/tmp/instarchat-pre-rehearsal-20260826.dump` |
| 백업 권한 | `0600` |
| 백업 크기 | 16,858,888 bytes |
| SHA-256 | `68813962a2164a01c439066f6cf64fd5b5a2a7e45edf1415cf608907515ff821` |

백업은 저장소 밖 임시 경로에 있으며 Git artifact로 보관하지 않는다.

## Migration 결과

1. schema graph의 단일 head `20260825_0033`을 확인했다.
2. 기존 revision `20260724_0004`를 확인했다.
3. `alembic upgrade head`로 `0005`부터 `0033`까지 전체 upgrade를 완료했다.
4. `0033`이 만든 `app_store_accounts`, `app_store_notification_events`와 `credit_purchases` audit 컬럼에 데이터가 0건임을 확인했다.
5. `alembic downgrade 20260821_0032`를 완료했다.
6. revision이 `20260821_0032`인지 확인했다.
7. `alembic upgrade head`를 다시 실행해 `20260825_0033`으로 복구했다.

최종 상태:

| 검증 | 결과 |
|---|---:|
| Alembic revision | `20260825_0033 (head)` |
| public table | 32 |
| invalid constraint | 0 |
| invalid index | 0 |
| users | 2 |
| characters | 2 |
| profiles | 2 |
| personas | 1 |
| shared_characters | 1 |
| character_follows | 1 |
| character_post_likes | 3 |

## Fresh DB 결과

같은 PostgreSQL 컨테이너에 빈 `alive_schema_rehearsal_20260826` DB를 생성하고 최초 revision부터 `20260825_0033`까지 upgrade했다.

| 검증 | 결과 |
|---|---:|
| Alembic revision | `20260825_0033 (head)` |
| public table | 32 |
| invalid constraint | 0 |
| invalid index | 0 |
| `alembic check` | 통과 |

검증 후 사용자 데이터가 없는 임시 DB만 삭제했다. 기존 `instarchat` DB와 사전 백업은 유지했다.

## ORM drift

기존 `instarchat` DB의 `alembic check`는 다음 index가 ORM metadata에 선언되지 않아 실패했다.

- `character_follows_target_idx`
- `characters_owner_idx`
- `shared_characters_created_at_idx`
- `shared_dm_threads_participants_idx`

fresh DB의 `alembic check`는 통과했으므로 Alembic migration과 현재 ORM metadata의 latest schema는 일치한다. 위 4개는 기존 로컬 DB에만 남은 legacy index다. DB에서 index를 즉시 제거하지 않고 운영에도 존재하는지와 실제 사용량을 확인한 뒤 별도 정리 여부를 결정한다.

운영 dump 복원 DB에서도 `alembic check`가 통과했다. 따라서 위 legacy index 4개는 운영 schema에는 존재하지 않는다.

## 운영 dump restore 결과

`/Users/ukdong/alive-db-dumps/alive-prod-20260826-646cadc9.sql`의 SHA-256과 `0600` 권한을 다시 확인하고, 같은 PostgreSQL 컨테이너의 별도 `alive_prod_rehearsal_20260826` DB에 복원했다. 기존 `instarchat` DB는 덮어쓰지 않았다.

| 검증 | 결과 |
|---|---:|
| dump SHA-256 | `646cadc93b89683a171b4eb11158c427103092c16f2361806ccd008dc60c30df` |
| restore | 통과 |
| Alembic revision | `20260825_0033 (head)` |
| application table | 31 |
| invalid constraint | 0 |
| invalid index | 0 |
| `alembic check` | 통과 |
| users | 26 |
| characters | 21 |
| credit_ledger_entries | 379 |
| credit_usages | 588 |
| public_feed_posts | 399 |
| native_oauth_codes | 47 |

복원 직후 App Store 관련 row는 account 2건, notification 5건, purchase 5건이었으며 purchase 5건 모두 price audit 값을 보유했다.

### Downgrade 비가역성

운영 복사본에서 `0033 → 0032 → 0033` 왕복 후 schema revision과 constraint/index 유효성은 복구됐지만 다음 데이터는 복구되지 않았다.

| 데이터 | 왕복 전 | 왕복 후 |
|---|---:|---:|
| `app_store_accounts` | 2 | 0 |
| `app_store_notification_events` | 5 | 0 |
| price audit 보유 purchase | 5 | 0 |

`credit_purchases`의 App Store purchase row 5건 자체는 유지됐다. 운영에서 `0033` downgrade가 필요하면 DB downgrade만으로는 복구가 불가능하며 배포 전 backup에서 App Store account, notification, price audit 데이터를 복구해야 한다.

검증 후 민감한 운영 복사본 DB와 컨테이너 내부 임시 dump를 삭제했다. 저장소 밖 원본 dump는 기존 `0600` 권한으로 유지했다.

## 검증 결과

- `make backend-schema-gate`: passed
- `alembic upgrade head`: passed
- `alembic downgrade 20260821_0032`: passed
- `alembic upgrade head`: passed
- revision 및 invalid constraint/index 검사: passed
- `make backend-compile`: passed
- `make backend-test`: passed (`462 passed`, `1 skipped`, deprecation warning 1건)
- fresh DB `alembic upgrade head`: passed
- fresh DB `alembic check`: passed
- 운영 dump restore: passed
- 운영 복원 DB `alembic check`: passed
- 운영 복원 DB `0033 → 0032 → 0033`: passed (App Store 데이터 비가역성 확인)
- 기존 DB `alembic check`: failed (legacy index 4개)
- 임시 fresh DB와 운영 복사본 DB 폐기: passed

## 검증하지 못한 것

- 이 컨테이너는 로컬 Docker volume을 사용하므로 접근 제한 staging 환경과 동등하지 않다.
- 전체 테이블 row count 재합계, relation·TOAST 크기, 실제 index scan과 lock wait는 검증하지 않았다.
- 마지막 revision 외 전체 revision의 downgrade는 실행하지 않았다.

## 남은 위험

- `0033` downgrade는 운영 App Store account, notification과 price audit 데이터를 삭제하며 재업그레이드로 복구되지 않는다.
- 기존 로컬 DB의 legacy index 4개는 운영·fresh DB에는 없지만 로컬 query 성능에 차이를 만들 수 있다.
- `/private/tmp` 백업은 임시 파일이므로 장기 보관이나 운영 복구 자료로 사용할 수 없다.
- 운영 데이터 분포와 규모에서 동일한 migration 시간과 lock 특성이 보장되지는 않는다.

## 다음 추천 작업

1. `0033` 이후 운영 rollback은 단순 downgrade 대신 이전 image 호환성, forward fix 또는 backup 기반 App Store 데이터 복구 절차를 사용한다.
2. 기존 로컬 DB의 legacy index 4개는 별도 local reset 또는 정리 migration 필요 여부를 결정한다.
3. 다음 DB 변경 전에는 접근 제한 staging 환경에서 동일한 restore rehearsal과 lock 측정을 반복한다.
