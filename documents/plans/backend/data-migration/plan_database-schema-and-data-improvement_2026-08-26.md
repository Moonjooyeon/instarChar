---
title: 운영 데이터베이스 스키마·데이터 종합 개선 계획
author: black (black@ashwoodfriends.com)
created: 2026-08-26
updated: 2026-08-26
version: 1.1.0
status: ready
---

# 운영 데이터베이스 스키마·데이터 종합 개선 계획

## 목표

현재 운영 `alive` 데이터베이스와 코드의 schema contract를 일치시킨 상태에서, 신규 테이블·컬럼 변경이 안전하게 누적되는 관리 체계를 만들고 불필요한 컬럼, 만료 데이터, 과도한 JSON payload를 단계적으로 정리한다.

이 계획의 완료 상태는 다음과 같다.

1. SQLAlchemy ORM과 Alembic의 역할 및 신규 schema 변경 절차가 명확하다.
2. CI와 배포 전 단계에서 단일 Alembic head, fresh upgrade, 운영 revision, ORM drift를 자동 검증한다.
3. `native_oauth_codes`와 `credit_usages.response_body`에 명시적인 보존·정리 정책이 적용된다.
4. 현재 runtime에서 사용하지 않는 강한 제거 후보 2개가 안전한 migration으로 정리된다.
5. Apple credential 및 legacy auto-post 컬럼은 제품·보안·rollback 결정 후 별도 migration으로 정리한다.
6. 배포 전 백업, staging restore, upgrade·downgrade rehearsal, 배포 후 무결성 검사를 반복 가능한 release gate로 만든다.

## 근거 문서

- [현재 데이터베이스 스키마 카탈로그](../../../reports/backend/report_database-schema-catalog_2026-08-26.md)
- [운영 데이터베이스 dump 및 무결성 감사](../../../reports/backend/report_production-database-audit_2026-08-26.md)
- [운영 데이터 기반 데이터베이스 컬럼 필요성 감사](../../../reports/backend/report_database-column-necessity-audit_2026-08-26.md)

기준 snapshot은 Alembic `20260825_0033`, 애플리케이션 테이블 31개, 컬럼 275개, 데이터 1,753 rows다. 운영과 ORM의 테이블·컬럼·명시적 constraint·index는 일치하며 PK·UNIQUE·FK·CHECK·JSON·크레딧 원장·공개 feed projection 무결성 위반은 0건이다.

## 가정

- SQLAlchemy `Base.metadata`는 현재 application이 기대하는 schema contract다.
- Alembic migration은 이미 배포된 schema의 유일한 변경 이력이며, 적용된 migration 파일을 수정하지 않고 새 revision만 추가한다.
- 운영 배포는 `docker-compose.prod.yml`의 `migrate` service가 `alembic upgrade head`를 성공한 뒤 backend를 시작하는 현재 구조를 유지한다.
- 운영 rollback은 application image rollback만으로 끝나지 않으며 DB downgrade가 필요한 경우 별도 승인과 백업이 필요하다.
- 현재 운영 데이터 규모는 작지만 `credit_usages.response_body` 증가 속도는 row 수보다 payload 크기에 좌우되므로 지금 보존 정책을 도입한다.
- client idempotency retry 보장 기간은 아직 확정되지 않았다. 구현 전 실제 retry 관측을 거쳐 결정하되 초기 권장값은 72시간이다.
- `20260820_0030` 이전 revision으로 운영 DB를 되돌릴 필요가 있는지 배포 담당자가 결정한다.
- 운영 dump는 개인정보와 secret을 포함할 수 있으므로 제한된 staging에서만 복원하고 저장소·일반 CI artifact에 넣지 않는다.

## 범위

### Schema 관리 체계

- SQLAlchemy model, Alembic revision, migration test, schema catalog의 변경 책임 정의
- 신규 테이블·컬럼·constraint·index 추가 체크리스트
- 단일 head, fresh database upgrade, current revision, ORM drift 검사
- 운영 배포 전 backup·restore rehearsal 및 배포 후 schema verification

### 데이터 보존과 정리

- 만료 `native_oauth_codes` batch cleanup과 `expires_at` 조회 경로 최적화
- `credit_usages.response_body` replay TTL, 최소 payload, batch cleanup
- legacy AI 비용 metadata의 운영 지표 분리

### 컬럼 정리

- 강한 제거 후보: `credit_accounts.version`, `apple_oauth_credentials.last_validated_at`
- 조건부 후보: Apple access token 2개, `email_forwarding_enabled`, `apple_account_events.payload_hash`, `characters.auto_post_legacy_credit_stop_recovered`
- JSON projection 중복의 장기 개선 조건 정의

### 검증과 운영

- migration 단위 테스트와 repository/service 회귀 테스트
- 제한된 staging에서 운영 dump restore 후 upgrade·downgrade rehearsal
- 배포 전후 비식별 무결성 SQL과 rollback 기준
- 문서·스키마 카탈로그 갱신

## 제외 범위

- 이 계획 작성 단계에서 application code, migration 또는 운영 DB를 변경하지 않는다.
- 운영 dump를 저장소에 추가하거나 개인정보·OAuth token·DM·콘텐츠 원문을 문서화하지 않는다.
- 빈 테이블이라는 이유만으로 active API contract의 테이블·컬럼을 제거하지 않는다.
- `profiles.app_state`, `characters.posts`, `shared_characters.character`, `public_feed_posts.payload`를 이번 1·2차 배포에서 제거하지 않는다.
- 결제 원장, 약관 동의 시각, 신고 snapshot 등 감사·법적 증거 컬럼을 단순 runtime read 부재만으로 제거하지 않는다.
- PostgreSQL major version 변경, database 분리, sharding, ORM 교체는 포함하지 않는다.

## 현재 상태와 문제

### Schema 변경 흐름

현재 schema는 [entities.py](../../../../backend/app/models/entities.py)의 model과 [Alembic versions](../../../../backend/migrations/versions)로 관리된다. production compose는 migration 성공을 backend 기동 조건으로 사용하므로 기본 배포 순서는 적절하다. 다만 다음 검증은 release gate로 명시되어 있지 않다.

- Alembic head가 정확히 하나인지 확인
- 빈 PostgreSQL에서 최초 revision부터 최신 head까지 upgrade 가능한지 확인
- ORM metadata와 최신 migration 결과 사이의 drift 확인
- 운영 snapshot restore에서 다음 migration의 lock 시간과 data 변환 검증
- 배포 후 운영 `alembic_version`과 기대 head 자동 비교

### 데이터 증가

- `native_oauth_codes` 47 rows가 모두 만료됐으며 cleanup 경로가 없다.
- `credit_usages.response_body`는 588 rows 중 526 rows가 사용 중이고 plain dump 직렬화 기준 13,344,575 bytes다.
- `response_body`는 중복 요청 replay에 사용되므로 즉시 제거할 수 없지만 현재 무기한 보존은 필요 이상이다.
- legacy prompt의 비용 metadata 누락 63건은 현재 생성 경로의 회귀가 아니므로 소급 변경보다 지표 분리가 적절하다.

### 컬럼 정리

- `credit_accounts.version`: 18/18 rows가 `0`, runtime read/write 없음
- `apple_oauth_credentials.last_validated_at`: 2/2 rows가 NULL, ORM 외 application 참조 없음
- Apple access token 2개: 저장되지만 read하지 않으며 revoke는 refresh token만 사용
- `characters.auto_post_legacy_credit_stop_recovered`: runtime read 없이 과거 migration downgrade 표식으로만 필요
- 나머지 NULL·기본값 컬럼은 account lifecycle, 환불, moderation, retry 등 아직 발생하지 않은 상태를 표현하므로 유지해야 한다.

## Schema 관리 원칙

### Source of truth

| 대상 | 책임 |
|---|---|
| SQLAlchemy model | 최신 application schema contract와 runtime mapping |
| Alembic revision | 배포 가능한 순차 schema·data 변환과 downgrade shape |
| Migration test | revision chain, DDL·data 변환 의도, 제약·index 검증 |
| Schema catalog | 사람이 검토하는 테이블·컬럼 역할과 옵션 문서 |
| 운영 audit | 특정 시점의 실제 revision, 데이터 분포, 무결성 증거 |

ORM model만 수정하거나 migration만 추가하는 변경은 완료로 보지 않는다. 두 경계와 테스트·문서를 함께 갱신해야 한다.

### 신규 테이블·컬럼 체크리스트

1. 데이터 소유자, 생성·조회·수정·삭제 경로와 보존 기간을 먼저 정의한다.
2. ORM에 타입, NULL 여부, default, FK `ON DELETE`, UNIQUE, CHECK, index를 명시한다.
3. 구현 시점의 최신 단일 head를 parent로 새 Alembic revision을 만든다.
4. 기존 적용 revision은 수정하지 않는다.
5. nullable·default·backfill·constraint 적용을 같은 순간에 수행하기 위험하면 expand → backfill → contract migration으로 나눈다.
6. 대용량 table의 index, type 변경, `NOT NULL`, column drop은 lock·rewrite 여부를 staging에서 측정한다.
7. migration 단위 테스트와 repository/API 회귀 테스트를 추가한다.
8. fresh DB와 운영 snapshot restore DB에서 `upgrade head`를 검증한다.
9. schema catalog와 관련 운영 문서를 갱신한다.
10. 배포 전 backup과 rollback 조건을 승인하고, 배포 후 revision·무결성 검사를 실행한다.

### 금지 사항

- 운영 DB에서 migration 없이 수동 DDL 실행
- 기존 migration 파일 수정으로 history 재작성
- server default와 application default를 근거 없이 다르게 유지
- data loss가 있는 downgrade를 “완전 복구”라고 표현
- 운영 dump를 PR, CI artifact 또는 일반 개발 fixture로 사용
- 같은 배포에서 writer 제거와 column drop을 검증 없이 동시에 수행

## 영향 경로

### Schema 배포

```text
SQLAlchemy model 변경
→ 새 Alembic revision과 migration test
→ fresh DB upgrade + restricted staging restore rehearsal
→ backend 회귀 테스트
→ 운영 alive DB backup + checksum
→ production migrate service: alembic upgrade head
→ backend 기동
→ expected head/current 비교 + 비식별 무결성 검사
```

### AI 응답 보존

```text
AI API 요청 + idempotency key
→ CreditRepository.reserve
→ provider 호출
→ commit_usage가 최소 replay payload 저장
→ TTL 안 중복 요청은 동일 응답 replay
→ retention batch가 TTL 지난 response_body만 비움
→ 비용·token·원장·상태 metadata는 계속 보존
```

### 만료 OAuth code 정리

```text
native OAuth code 발급·교환
→ expires_at/used_at 기록
→ grace period 경과
→ data retention poll
→ expires_at 기준 제한된 batch 삭제
→ batch 수·오류만 비식별 로그 기록
```

## 구현 단계

### 1차 배포 — 관측·보존 정책·비파괴 정리

#### 1. Schema gate 자동화

1. `alembic heads` 결과가 정확히 하나인지 검사한다.
2. 빈 PostgreSQL에 최초 revision부터 `upgrade head`를 수행하는 migration integration test를 추가한다.
3. upgrade 결과를 `Base.metadata`와 비교해 table, column, PK, FK, UNIQUE, CHECK, index drift를 검사한다.
4. 기대 head를 application build 또는 운영 verification script가 읽을 수 있게 한 곳에서 계산한다. revision 문자열을 여러 파일에 수동 복제하지 않는다.
5. 배포 후 운영 `alembic current`가 기대 head와 다르면 backend rollout을 완료로 표시하지 않는다.

완료 조건:

- branch head 2개 이상, 누락 migration, ORM-only column 변경이 CI에서 실패한다.
- fresh database가 latest head까지 한 번에 생성된다.
- 현재 production compose의 migrate-before-backend 순서는 유지된다.

#### 2. Restricted staging restore rehearsal

1. 운영 `alive` DB만 새 custom-format dump로 생성하고 checksum·권한·보관 만료일을 기록한다.
2. 운영과 분리된 제한된 staging PostgreSQL에만 복원한다.
3. 복원 직후 revision, row count, PK·UNIQUE·FK·CHECK·JSON·원장·feed projection 무결성을 검사한다.
4. 다음 migration을 upgrade하고 소요 시간, lock wait, relation size 변화를 기록한다.
5. downgrade 후 shape 복구와 data loss 범위를 확인한 뒤 다시 upgrade한다.
6. rehearsal dump와 staging DB를 정해진 기간 뒤 안전하게 폐기한다.

완료 조건:

- 동일 dump에서 restore → upgrade → downgrade → upgrade가 반복 가능하다.
- 각 migration의 예상 lock과 비가역 데이터가 release record에 명시된다.

#### 3. `native_oauth_codes` retention

1. `expires_at` 기준 cleanup query와 제한된 batch 삭제 repository를 추가한다.
2. 즉시 만료 시각이 아니라 설정 가능한 grace period 이후에 삭제한다.
3. 현재 data-retention 성격의 account deletion poll에 포함하거나 별도 maintenance poll을 사용할지 결정한다. 두 scheduler를 중복 실행하지 않는다.
4. 현재 규모에서는 단순 `expires_at` btree index를 사용하고 불필요한 복합 index는 만들지 않는다.
5. 삭제 row 수와 실패 횟수만 로그로 남기고 code hash·사용자 ID는 남기지 않는다.

권장 초기값:

- grace period: 24시간
- batch size: 500
- poll 주기: 기존 retention scheduler 주기 재사용

완료 조건:

- 만료 후 grace period를 지난 row가 다음 poll에서 batch 삭제된다.
- 유효하거나 아직 grace period 안의 code는 교환 동작에 영향을 받지 않는다.
- 운영에서 오래된 만료 row 수가 0으로 수렴한다.

#### 4. `credit_usages.response_body` retention

1. 저장 중인 payload가 public API replay에 필요한 최소 DTO인지 확인하고 provider 내부 debug·중복 metadata를 제외한다.
2. payload byte 크기, replay 발생 시점, idempotency retry 최대 연령을 비식별 metric으로 관측한다.
3. 1주 관측 후 replay TTL을 확정한다. 데이터가 없으면 72시간을 보수적 기본값으로 사용한다.
4. TTL을 지난 committed/refunded row의 `response_body`만 `{}`로 바꾸는 batch cleanup을 추가한다.
5. status, 비용, token 수, prompt/model/policy version, idempotency key, 원장 데이터는 보존한다.
6. cleanup query는 작은 batch와 짧은 transaction으로 실행한다. 데이터 증가로 sequential scan이 문제가 될 때만 partial cleanup index를 추가한다.
7. TTL 이후 동일 idempotency key가 오면 새 provider 호출이나 재과금을 하지 않고 `REQUEST_ALREADY_PROCESSED`로 응답한다.

완료 조건:

- TTL 안의 committed 중복 요청은 기존과 동일한 response를 replay한다.
- TTL 밖의 요청은 재과금·provider 재호출 없이 이미 처리된 요청으로 종료한다.
- TTL 지난 non-empty `response_body` row가 0으로 수렴한다.
- 비용·원장 무결성 위반은 계속 0건이다.

#### 5. Legacy AI metadata 관측 분리

1. `usage_metadata_complete=false`를 prompt version과 status별로 집계한다.
2. `legacy` row는 현재 generation 회귀 경보에서 제외하되 감사 데이터는 유지한다.
3. 최신 prompt의 committed row에서 metadata 누락 또는 0원 provider cost가 발생할 때만 경보한다.

완료 조건:

- legacy 데이터와 현재 회귀가 같은 경보로 섞이지 않는다.
- 소급 비용 추정치를 사실처럼 DB에 기록하지 않는다.

### 2차 배포 — 강한 제거 후보와 schema contract 정리

#### 6. `credit_accounts.version` 제거

1. 구현 직전 운영에서 `version` 값 분포와 `CreditAccount.version` 외부 조회 여부를 다시 확인한다.
2. ORM의 `version` 컬럼과 `ck_credit_accounts_version_nonnegative` CHECK를 제거한다.
3. 새 Alembic revision에서 CHECK를 먼저 제거하고 column을 drop한다.
4. downgrade는 `version INTEGER NOT NULL DEFAULT 0`과 CHECK를 복구한다. 과거 값이 모두 0이므로 shape 복구는 가능하지만 삭제 이후의 원래 값 복구를 보장한다고 표현하지 않는다.
5. credit reserve, purchase, refund, chargeback, debt, account audit 테스트를 실행한다.

완료 조건:

- ORM과 DB에서 `version` 및 관련 CHECK가 모두 사라진다.
- row lock 기반 지갑 갱신과 원장 합계가 동일하게 동작한다.
- balance·ledger mismatch가 0건이다.

#### 7. `apple_oauth_credentials.last_validated_at` 제거

1. 주기적 Apple credential validation 기능 계획이 없음을 제품·백엔드 담당자가 승인한다.
2. ORM과 새 Alembic revision에서 nullable column을 제거한다.
3. downgrade는 nullable timestamp shape만 복구한다.
4. Apple web/native login, credential upsert, token revoke, account deletion, account notification 테스트를 실행한다.

완료 조건:

- ORM과 DB에서 `last_validated_at`이 사라진다.
- Apple refresh token revoke와 credential upsert가 변하지 않는다.

#### 8. 배포 방식

1. 1차 보존 정책 migration과 2차 drop migration을 하나의 revision에 섞지 않는다.
2. drop migration은 운영 트래픽이 낮은 시간에 실행한다.
3. migration transaction에 짧은 `lock_timeout`을 적용해 lock 획득 실패 시 backend rollout 전에 안전하게 중단한다.
4. migration 성공 후 expected head/current, 컬럼 부재, 핵심 무결성을 확인하고 backend rollout을 완료한다.

### 3차 배포 — 조건부 컬럼과 projection 정리

#### 9. Apple credential 최소화 결정

| 컬럼 | 유지 조건 | 제거 조건 |
|---|---|---|
| `access_token_encrypted` | access token으로 Apple API를 호출할 승인된 기능이 존재 | OAuth 완료 후 어떤 runtime도 읽지 않음 |
| `access_token_expires_at` | access token refresh·validation schedule에 사용 | access token을 저장하지 않음 |
| `email_forwarding_enabled` | 사용자 화면·support·운영 query에서 현재 상태를 소비 | 이벤트 이력만으로 충분하고 state consumer 없음 |
| `apple_account_events.payload_hash` | 중복 event payload 불일치 탐지 또는 감사 검증 구현 | event ID 멱등성 외 hash 목적 없음 |

access token 2개를 제거하기로 하면 expand-contract를 사용한다.

1. 먼저 writer에서 access token 저장을 중단하고 refresh token revoke 테스트를 강화한다.
2. 한 배포 동안 Apple login·account deletion·notification을 관측한다.
3. 다음 migration에서 두 컬럼을 drop한다.
4. 기존 암호화 access token 원문은 문서·로그·backup 외부로 내보내지 않는다.

완료 조건:

- 유지 컬럼에는 명시적인 reader·운영 목적·보존 기간이 존재한다.
- 제거 컬럼의 writer가 먼저 사라지고 관측 기간을 통과한다.

#### 10. Legacy auto-post 표식 제거

1. `20260820_0030` 이전 운영 rollback 지원 종료를 승인한다.
2. `auto_post_legacy_credit_stop_recovered=true` row가 현재 상태에 미치는 영향이 없음을 재검증한다.
3. runtime의 `false` write와 ORM 컬럼을 제거한다.
4. cleanup migration에서 컬럼을 drop한다.
5. cleanup migration downgrade는 `BOOLEAN NOT NULL DEFAULT false`를 재생성해 과거 `0030` downgrade chain의 shape를 보존한다. 원래 true 표식은 backup 없이 복구할 수 없음을 기록한다.

완료 조건:

- 현재 auto-post claim, stale lease, 성공·실패·잔액 부족 경로가 동일하게 동작한다.
- 운영 rollback 기준이 문서화되고 legacy 컬럼이 제거된다.

#### 11. JSON projection 장기 개선 여부 판단

현재 다음 중복은 active query projection이므로 즉시 제거하지 않는다.

- `characters.posts`: authoritative 게시물
- `public_feed_posts.payload`: feed pagination projection
- `shared_characters.character`: discover/detail 공개 snapshot
- `profiles.app_state`: frontend bootstrap backup

다음 조건이 모두 충족될 때만 별도 설계 계획을 만든다.

1. endpoint별 query latency·payload size·TOAST 크기를 측정했다.
2. `shared_characters.character.posts`를 `public_feed_posts`로 대체해도 정렬·comment·상세 응답이 동일하다.
3. structured state가 모든 client version에서 안정적으로 동작해 `app_state` fallback 의존도를 제거할 수 있다.
4. 구버전 mobile client 호환 종료 정책이 있다.

## 구현 단계별 운영 반영 절차

### 공통 운영 반영 원칙

모든 단계는 다음 순서로 운영에 반영한다.

```text
개발·테스트 완료
→ 변경 없는 production snapshot으로 staging rehearsal
→ 운영 commit/image tag와 expected Alembic head 고정
→ alive DB만 backup + checksum 확인
→ 호환 application image 먼저 배포
→ 필요 시 migration 실행
→ 설정 flag를 최소 batch로 활성화
→ revision·health·무결성·오류율 확인
→ 관찰 기간 통과 후 다음 단계 진행
```

다음 규칙을 지킨다.

- schema를 삭제하는 contract migration은 해당 컬럼을 참조하지 않는 호환 image가 먼저 운영 중이어야 한다.
- cleanup은 code와 migration 배포 직후 자동으로 대량 실행하지 않는다. 기본 비활성 상태로 배포한 뒤 dry-run 집계와 작은 batch부터 활성화한다.
- 운영 migration은 `docker-compose.prod.yml`의 `migrate` service를 사용하고 컨테이너 내부에서 수동 SQL DDL을 실행하지 않는다.
- backup은 PostgreSQL cluster 전체가 아니라 대상 `alive` DB를 명시한다.
- 운영 dump와 검증 출력에 email, OAuth subject, token, DM, 콘텐츠, 주문 ID를 포함하지 않는다.
- migration 실패 시 backend rollout을 진행하지 않는다.
- 삭제된 row·payload·column 값은 downgrade만으로 복구되지 않는다. 복구가 필요하면 배포 전 backup을 별도 DB에 복원한다.

### 공통 운영 명령 흐름

실제 경로·환경 파일·image tag는 현재 배포 runbook의 값을 사용한다. 아래 명령은 구조를 설명하는 예시이며 secret을 명령행에 직접 넣지 않는다.

```bash
# 1. 현재 service와 설정 해석 확인
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml ps

# 2. 배포할 backend/migrate image 준비
BACKEND_IMAGE_TAG=<immutable-tag> docker compose -f docker-compose.prod.yml build backend migrate

# 3. 승인된 backup 완료 후 migration만 실행
BACKEND_IMAGE_TAG=<immutable-tag> docker compose -f docker-compose.prod.yml run --rm migrate

# 4. migration 성공 뒤 backend image 반영
BACKEND_IMAGE_TAG=<immutable-tag> docker compose -f docker-compose.prod.yml up -d --no-deps backend

# 5. 상태와 최근 오류 확인
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --since=15m backend
```

평상시에는 현재 compose의 `depends_on: migrate: service_completed_successfully`를 이용해 backend 기동 전에 migration을 보장할 수 있다. 다만 column drop처럼 contract 단계가 있는 배포는 migration과 backend 전환을 위처럼 분리해 각 gate를 확인한다.

### 단계 1 — Schema gate 자동화 운영 반영

운영 DB를 변경하지 않는다. CI와 배포 pipeline의 차단 조건으로 반영한다.

1. PR 검사에서 `alembic heads`, migration unit test, fresh DB upgrade, ORM drift 검사를 실행한다.
2. release artifact 생성 시 commit SHA, immutable image tag, expected Alembic head를 기록한다.
3. 운영 배포 직전 read-only preflight로 현재 `alembic current`를 조회한다.
4. 현재 revision이 release가 기대하는 parent가 아니면 배포를 중단한다.
5. 배포 후 current가 expected head와 일치해야 release를 완료 처리한다.

운영 확인:

- application 기능 변화 없음
- DB write 없음
- pipeline이 복수 head, 누락 revision, ORM drift를 의도적으로 차단하는지 확인

rollback:

- gate 자체 오류라면 배포를 진행하지 않고 CI 설정만 이전 버전으로 되돌린다.
- 실제 schema에는 영향이 없다.

### 단계 2 — Restricted staging restore rehearsal 운영 반영

운영 DB에는 read-only backup 부하만 발생하며 migration은 staging DB에서만 실행한다.

1. 트래픽이 낮은 시간에 `alive` DB만 backup한다.
2. 로컬 일반 개발 DB가 아니라 접근 제한 staging DB에 복원한다.
3. 다음 운영 배포와 동일한 image로 migration을 실행한다.
4. upgrade·downgrade·upgrade 결과, 소요 시간, lock, row count, 무결성 결과를 release evidence로 첨부한다.
5. rehearsal이 실패하면 운영 반영을 취소한다.
6. 승인된 보관 기간이 끝나면 staging DB와 dump를 폐기한다.

운영 확인:

- backup 중 DB latency·lock 증가가 없는지 확인
- dump checksum과 restore 성공 확인
- staging 결과의 개인정보 원문을 로그나 문서에 남기지 않음

rollback:

- 운영 schema를 변경하지 않았으므로 별도 DB rollback은 없다.
- backup 부하가 크면 backup을 중단하고 더 낮은 트래픽 시간으로 재예약한다.

### 단계 3 — `native_oauth_codes` retention 운영 반영

두 번의 활성화 단계로 반영한다.

#### 배포 A — 코드·index만 반영

1. `expires_at` index migration과 batch cleanup code를 배포한다.
2. cleanup flag는 `false`, batch size는 500 이하로 둔다.
3. migration 후 OAuth code 발급·교환·만료 테스트와 index 존재를 확인한다.
4. dry-run query로 grace period를 지난 삭제 예정 row 수만 집계한다.

#### 배포 B — cleanup 활성화

1. `.env.prod`에서 cleanup flag를 활성화하고 backend를 재시작한다.
2. 첫 poll은 batch 100으로 실행한다.
3. 삭제 수, poll 시간, 오류만 확인하고 user ID·code hash는 기록하지 않는다.
4. 정상이라면 batch를 최대 500까지 올린다.
5. grace period가 지난 row가 0으로 수렴하는지 24시간 관찰한다.

운영 확인:

- 신규 code 교환 성공률 변화 없음
- 유효 code 오삭제 0건
- 만료 후 24시간 이내 row는 보존
- cleanup transaction과 lock 시간이 허용 범위 안

rollback:

- cleanup flag를 `false`로 바꾸고 backend를 재시작한다.
- index와 code는 남겨도 기능 영향이 없다.
- 이미 삭제된 code는 만료 데이터이므로 일반적으로 복구하지 않으며, 사고 분석이 필요하면 backup에서만 확인한다.

### 단계 4 — `credit_usages.response_body` retention 운영 반영

관측·저장 축소·기존 데이터 cleanup을 세 번에 나눠 반영한다.

#### 배포 A — 관측만 추가

1. response byte 크기, replay 성공 횟수, replay 요청 연령의 비식별 metric을 배포한다.
2. cleanup은 비활성화한다.
3. 최소 1주 동안 실제 최대 retry 연령과 payload 분포를 관찰한다.

#### 배포 B — 신규 row의 최소 replay payload 적용

1. public API replay에 필요한 필드만 저장하는 serializer를 활성화한다.
2. idempotency replay 응답이 기존 API contract와 동일한지 먼저 일부 트래픽에서 확인한다.
3. provider cost, token, prompt/model/policy metadata는 기존 컬럼에 계속 기록한다.
4. 문제가 없으면 신규 committed row 전체에 적용한다.

#### 배포 C — 기존 payload cleanup 활성화

1. 확정된 TTL보다 오래된 대상 row 수와 직렬화 bytes를 dry-run으로 집계한다.
2. `alive` DB backup과 checksum을 다시 확인한다.
3. batch 50으로 시작해 `response_body={}` cleanup을 활성화한다.
4. DB latency와 transaction 시간을 보며 batch를 점진적으로 확대한다.
5. TTL 안 replay, TTL 밖 `REQUEST_ALREADY_PROCESSED`, 재과금 0건을 확인한다.

운영 확인:

- AI provider 호출량·credit debit가 중복 요청으로 증가하지 않음
- TTL 안 replay 성공률 유지
- TTL 밖 요청이 provider를 다시 호출하지 않음
- dump/TOAST payload가 baseline보다 감소
- credit account와 ledger mismatch 0건

rollback:

- cleanup flag와 최소-payload flag를 각각 독립적으로 끈다.
- 신규 저장 형식에 문제가 있으면 기존 serializer로 되돌린다.
- `{}`로 비운 과거 response는 backup 외 복구할 수 없지만 credit·비용·token·상태 데이터는 유지된다.

### 단계 5 — Legacy AI metadata 관측 분리 운영 반영

DB migration 없이 metric·alert 설정으로 먼저 반영한다.

1. dashboard를 prompt version과 status로 분리한다.
2. `legacy` row는 별도 historical panel에 둔다.
3. 최신 prompt의 committed row만 metadata 누락 경보 대상으로 설정한다.
4. 1주 동안 기존 경보와 새 경보를 함께 관찰한 뒤 기존 혼합 경보를 제거한다.

운영 확인:

- 최신 prompt의 실제 누락은 계속 탐지
- legacy 63건 때문에 지속적으로 오경보가 발생하지 않음
- DB 값을 임의 보정하지 않음

rollback:

- alert routing만 이전 설정으로 되돌린다.
- schema와 데이터에는 영향이 없다.

### 단계 6 — `credit_accounts.version` 제거 운영 반영

호환 image와 contract migration을 분리한다.

#### 배포 A — 호환 application image

1. ORM에서 `version`과 관련 CHECK 선언을 제거하되 DB column은 유지한다.
2. migration 없는 image를 운영에 먼저 배포한다.
3. credit snapshot, reserve, purchase, refund, chargeback, debt, moderation audit를 확인한다.
4. 최소 24시간 동안 wallet·ledger mismatch와 DB 오류를 관찰한다.

#### 배포 B — contract migration

1. 직전 운영에서 `version` 분포가 계속 전부 0인지 재검사한다.
2. `alive` DB backup과 checksum을 확인한다.
3. 낮은 트래픽 시간에 CHECK와 column을 drop하는 migration을 실행한다.
4. expected head, column 부재, credit 무결성을 확인한다.
5. 이미 운영 중인 호환 image는 재배포하지 않아도 새 schema와 동작해야 한다.

운영 확인:

- `credit_accounts.version`과 CHECK 부재
- credit reserve·refund·purchase API 오류 없음
- account balance와 ledger 합계 mismatch 0건

rollback:

- migration downgrade로 `version INTEGER NOT NULL DEFAULT 0`과 CHECK를 복구한다.
- 그 다음 필요할 때만 이전 application image로 되돌린다.
- 순서를 반대로 하면 이전 ORM이 없는 column을 조회할 수 있으므로 금지한다.

### 단계 7 — `apple_oauth_credentials.last_validated_at` 제거 운영 반영

단계 6과 같은 expand-contract를 사용한다.

#### 배포 A — 호환 application image

1. ORM에서 `last_validated_at`을 제거하고 DB column은 유지한다.
2. Apple web/native login, credential upsert, logout, account deletion, notification을 검증한다.
3. 최소 한 배포 관찰 기간 동안 Apple 인증 오류율을 확인한다.

#### 배포 B — contract migration

1. 값이 계속 전부 NULL이고 수동 운영 consumer가 없음을 재확인한다.
2. backup 후 nullable column drop migration을 실행한다.
3. expected head와 Apple credential row 수·login·revoke를 확인한다.

rollback:

- migration downgrade로 nullable timestamp를 복구한 후 이전 image를 배포한다.
- 원래 값은 모두 NULL이므로 현재 snapshot에서는 실질 data loss가 없지만 구현 시점에 다시 확인한다.

### 단계 8 — 배포 방식의 운영 반영

이 단계는 별도 기능이 아니라 단계 3·4·6·7·9·10에 공통 적용하는 release control이다.

1. 각 migration을 독립 revision과 독립 release record로 관리한다.
2. migration image와 backend image는 같은 immutable tag를 사용한다.
3. expected parent/current가 다르면 migration을 실행하지 않는다.
4. `lock_timeout`으로 contract DDL이 오래 기다리지 않게 한다.
5. migrate service가 실패하면 현재 backend를 그대로 유지하고 새 backend를 올리지 않는다.
6. 성공 후에만 운영 revision과 document status를 갱신한다.

운영 확인:

- migrate exit code 0
- backend health 통과
- expected head/current 일치
- 15분 즉시 관찰과 24시간 지연 관찰 완료

rollback:

- additive migration은 code flag 비활성화를 우선한다.
- destructive migration은 maintenance/write 중단 → downgrade → 이전 image 순서를 따른다.

### 단계 9 — Apple 조건부 컬럼 운영 반영

각 컬럼의 유지·제거 결정을 먼저 기록하고, 제거 대상만 두 배포로 진행한다.

#### 배포 A — writer 중단

1. access token 2개를 제거한다면 OAuth credential upsert에서 해당 값을 저장하지 않는다.
2. `email_forwarding_enabled`를 제거한다면 notification 처리 결과를 event log로만 남기도록 writer를 중단한다.
3. `payload_hash`를 제거한다면 감사·불일치 탐지가 필요 없다는 결정을 기록하고 writer를 중단한다.
4. DB column은 그대로 유지한 채 최소 1~2주 또는 한 번의 전체 인증 release cycle을 관찰한다.

#### 배포 B — contract migration

1. reader·writer·수동 운영 query가 없음을 다시 검색한다.
2. Apple login, revoke, notification, account deletion evidence를 승인한다.
3. backup 후 승인된 컬럼만 drop한다.
4. Apple 기능별 smoke와 error rate를 24시간 관찰한다.

rollback:

- downgrade로 nullable column을 복구하고 writer image를 다시 배포한다.
- 과거 access token은 backup 외 복구하지 않는다. 필요하면 다음 Apple login부터 새 token을 수집한다.

### 단계 10 — Legacy auto-post 표식 운영 반영

rollback 정책 승인 후 두 배포로 진행한다.

#### 배포 A — runtime 참조 제거

1. `0030` 이전 운영 downgrade 지원 종료를 release decision으로 승인한다.
2. ORM 컬럼과 설정 변경 시 `false` write를 제거하되 DB column은 유지한다.
3. 자동 게시 claim, stale lease, 성공, 생성 실패, 잔액 부족 경로를 검증한다.
4. 최소 24시간 또는 scheduler 여러 cycle 동안 관찰한다.

#### 배포 B — contract migration

1. `true` row가 runtime 결과에 영향을 주지 않음을 재검사한다.
2. backup 후 column을 drop한다.
3. auto-post due, stale claim, failure count, next schedule을 확인한다.

rollback:

- downgrade는 column을 `false` default로 재생성한다.
- 원래 `true` 표식 의미는 자동 복구되지 않으므로 `0030` 이전 상태가 필요하면 backup 기반 수동 runbook을 사용한다.

### 단계 11 — JSON projection 장기 개선 운영 반영

이번 개선 배포에서는 실행하지 않는다. 후속 계획이 승인되면 다음 expand-contract를 사용한다.

1. 기존 projection과 새 조회 경로를 dual-write한다.
2. background backfill을 작은 batch로 수행한다.
3. shadow read로 두 응답의 post 수, 정렬, comment, payload hash를 비식별 비교한다.
4. feature flag로 일부 read만 새 경로로 전환한다.
5. 오류·latency·payload가 안정되면 전체 read를 전환한다.
6. 구버전 mobile client 지원 종료 후 기존 JSON field write를 중단한다.
7. 최소 한 release 관찰 뒤 별도 contract migration을 검토한다.

rollback:

- read feature flag를 기존 projection으로 즉시 되돌린다.
- dual-write와 기존 column은 안정화 기간 동안 유지하므로 data rollback이 필요 없다.

### 운영 반영 요약표

| 단계 | 운영 변경 | 활성화 방식 | 최소 관찰 | 다음 단계 진입 조건 |
|---|---|---|---:|---|
| 1 | CI·배포 gate | pipeline 필수 검사 | 1회 의도적 실패 검증 | 복수 head·drift 차단 확인 |
| 2 | 운영 backup, staging restore | 수동 승인 runbook | rehearsal 1회 | upgrade·downgrade·upgrade 통과 |
| 3 | OAuth code index·cleanup | flag off → batch 100 → 500 | 24시간 | 유효 code 영향 0, expired 0 수렴 |
| 4 | AI replay 관측·최소 payload·cleanup | 관측 → 신규 write → batch cleanup | 관측 1주 + 활성 24시간 | 재과금 0, TTL replay 정상 |
| 5 | AI metadata dashboard·alert | 병행 alert 후 전환 | 1주 | 최신 누락 탐지·legacy 오경보 제거 |
| 6 | credit version 제거 | 호환 image → DROP | 24시간 + contract 24시간 | ledger mismatch 0 |
| 7 | Apple validation timestamp 제거 | 호환 image → DROP | 1 release + contract 24시간 | login·revoke 오류 증가 없음 |
| 8 | release control | 모든 migration에 강제 | 매 배포 15분·24시간 | expected head/current 일치 |
| 9 | Apple 조건부 컬럼 | writer off → 1~2주 → DROP | 1~2주 | 승인된 consumer 없음 |
| 10 | legacy auto-post flag | runtime 제거 → DROP | scheduler 여러 cycle + 24시간 | auto-post 회귀 0 |
| 11 | JSON projection | dual-write → shadow read → flag 전환 | 최소 1 release | 응답·정렬·comment·latency 일치 |

## 배포 단위와 의존성

| 배포 | 내용 | 선행 조건 | rollback |
|---|---|---|---|
| 1차 | schema gate, staging rehearsal, OAuth code cleanup, response TTL·최소 payload, AI metric 분리 | 보존 정책 승인, 제한 staging | cleanup flag/poll 비활성화; 삭제 payload는 backup에서만 복구 |
| 2차 | `credit_accounts.version`, `last_validated_at` 제거 | 1차 gate 통과, 직전 운영 분포 재검사 | application rollback 후 migration downgrade; 삭제 데이터는 backup에서만 복구 |
| 3차 | Apple 조건부 컬럼, legacy auto-post flag | 제품·보안·rollback 정책 승인과 관측 기간 | writer 재활성화 전 downgrade; secret·legacy 값은 backup 외 자동 복구 불가 |

각 배포는 독립 PR과 독립 Alembic revision으로 운영한다. 현재 head가 변경되면 구현 시점의 최신 단일 head를 parent로 사용한다.

## 성공 조건

### Schema 관리

- Alembic head가 항상 정확히 하나다.
- 빈 DB와 restricted production snapshot restore DB가 최신 head까지 upgrade된다.
- 최신 migration 결과와 `Base.metadata`의 table·column·constraint·index drift가 0건이다.
- 운영 `alembic current`가 배포 artifact의 기대 head와 일치한다.
- 신규 테이블·컬럼 PR은 model, migration, tests, docs, retention, rollback 항목을 모두 포함한다.

### 데이터 보존

- grace period가 지난 `native_oauth_codes`가 0으로 수렴한다.
- TTL이 지난 non-empty `credit_usages.response_body`가 0으로 수렴한다.
- TTL 안 idempotency replay와 TTL 밖 무과금 종료가 모두 테스트된다.
- dump에 기록되는 AI response payload가 현재 13.34 MB baseline에서 명확히 감소한다.
- 최신 prompt의 committed metadata 누락을 legacy row와 분리해 감지한다.

### 컬럼 정리

- `credit_accounts.version`과 관련 CHECK가 ORM·DB에서 제거된다.
- `apple_oauth_credentials.last_validated_at`이 ORM·DB에서 제거된다.
- 조건부 컬럼은 승인된 reader·감사 목적이 없을 때만 별도 배포로 제거된다.
- account, OAuth, auto-post, credit, purchase, moderation 회귀가 없다.

### 운영 무결성

- PK·UNIQUE 중복, FK orphan, CHECK 위반, JSON decode 오류가 모두 0건이다.
- credit account와 ledger mismatch가 0건이다.
- 공개 feed projection 누락·추가 row가 모두 0건이다.
- 처리 중 또는 stale credit reservation, purchase reconciliation 이상이 허용 기준 안이다.

## 검증 계획

### 정적·단위 검증

| 검증 | 명령 또는 방법 | 통과 기준 |
|---|---|---|
| Python compile | `make backend-compile` | 오류 없음 |
| Migration unit | `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests/test_migrations.py` | 전체 통과 |
| 관련 repository | OAuth, account deletion, credit, purchase, auto-post 테스트 선택 실행 | 전체 통과 |
| Backend 전체 | `make backend-test` | 전체 통과 |
| Alembic heads | backend 환경에서 `alembic heads` | head 1개 |
| Alembic history | backend 환경에서 `alembic history` | revision chain 단절·미병합 branch 없음 |
| ORM drift | fresh DB introspection과 `Base.metadata` 비교 | table·column·constraint·index 차이 0 |

프로젝트 규칙에 따라 frontend·backend application process는 새로 시작하지 않는다.

### Staging migration rehearsal

1. 제한된 staging PostgreSQL에 승인된 운영 snapshot을 복원한다.
2. `alembic current`와 기준 row count를 기록한다.
3. `alembic upgrade head`를 수행하고 시간·lock·오류를 기록한다.
4. 비식별 무결성 query와 repository smoke test를 실행한다.
5. 새 revision 하나를 downgrade하고 shape·data loss를 확인한다.
6. 다시 upgrade해 최종 head와 무결성을 확인한다.

### 배포 전 gate

- [ ] 대상 DB가 `alive`인지 확인
- [ ] 배포 artifact의 expected head와 현재 운영 revision 기록
- [ ] `alive` DB만 backup하고 checksum·권한·복원 명령 검증
- [ ] staging rehearsal evidence 승인
- [ ] migration 예상 lock 시간과 `lock_timeout` 승인
- [ ] cleanup TTL·grace period·batch size 승인
- [ ] application image와 migration rollback 순서 승인
- [ ] 민감 dump 보관·폐기 기한 기록

### 배포 후 gate

- [ ] migrate service exit code 0
- [ ] backend health check 통과
- [ ] 운영 `alembic current`가 expected head와 일치
- [ ] 제거 대상 컬럼·constraint의 실제 부재 확인
- [ ] PK·UNIQUE·FK·CHECK·JSON·원장·feed projection 위반 0
- [ ] OAuth code와 response cleanup batch 정상 동작
- [ ] Apple login·logout·account deletion, AI 중복 요청, credit snapshot, auto-post smoke 확인
- [ ] 비정상 lock, DB error, 5xx 증가 없음

## 위험과 롤백

| 위험 | 예방 | rollback |
|---|---|---|
| response TTL이 client retry보다 짧음 | 1주 관측, 72시간 보수 기본값, TTL 안 replay 테스트 | cleanup poll 중단·TTL 확대; 이미 비운 body는 backup 외 복구 불가 |
| cleanup이 많은 row를 한 transaction에서 잠금 | 제한 batch, 짧은 transaction, poll당 최대 삭제량 | scheduler/feature flag 비활성화 |
| column drop lock으로 migrate 지연 | 낮은 트래픽 시간, staging lock 측정, `lock_timeout` | migration 실패 시 backend rollout 중단; DB는 transaction rollback |
| ORM과 DB 배포 순서 불일치 | writer 제거 → 관측 → drop의 expand-contract | 이전 image가 drop column을 참조하면 먼저 downgrade 후 image rollback |
| Apple access token 제거 후 예정 기능 필요 | 제품·보안 승인과 reader 검색, 별도 3차 배포 | nullable column 재생성 후 새 login부터 재수집; 과거 secret은 backup 외 복구 불가 |
| legacy flag 제거로 과거 downgrade 의미 상실 | rollback boundary 승인, downgrade shape 재생성 | backup restore 또는 수동 상태 복구 runbook 사용 |
| production dump 노출 | 저장소 밖 0600, 최소 접근, 제한 staging, 폐기 기한 | 접근 차단, 파일 폐기, credential 영향 평가 |
| 무결성 회귀 | 배포 전후 동일 비식별 검사 | backend rollout 중단, migration downgrade 또는 backup restore |

### Rollback 순서

1. write path가 새 schema를 사용하기 시작했는지 확인한다.
2. destructive migration이면 이전 application image를 먼저 올리지 않는다.
3. 현재 image에서 write를 중단하거나 maintenance mode로 전환한다.
4. 승인된 Alembic downgrade를 실행한다.
5. downgrade가 data를 복구하지 못하는 경우 배포 전 backup을 별도 DB에 복원해 필요한 row만 검증·복구한다.
6. 이전 application image를 배포한다.
7. expected revision, health, OAuth, credit ledger, feed projection을 재검증한다.

## 검증하지 못한 것

- 이 계획 단계에서는 migration, scheduler, retention query를 구현하거나 실행하지 않았다.
- 운영 `pg_stat_statements`, 실제 relation·TOAST 크기, lock wait baseline은 아직 수집하지 않았다.
- client idempotency retry 최대 연령과 support·BI의 수동 컬럼 조회 여부는 아직 확인하지 않았다.
- `20260820_0030` 이전 운영 rollback 지원 종료 여부는 아직 승인되지 않았다.
- Apple access token, email forwarding, payload hash의 향후 제품·운영 목적은 아직 결정되지 않았다.

## 남은 결정

| 결정 | 권장안 | 결정 시점 |
|---|---|---|
| AI replay TTL | 1주 관측 후 72시간 기본값 | 1차 구현 전 |
| OAuth code grace period | 만료 후 24시간 | 1차 구현 전 |
| Retention 실행 주체 | 기존 retention poll을 확장하되 책임이 커지면 후속 rename | 1차 구현 시 |
| Apple access token 보존 | 승인된 reader 계획이 없으면 제거 | 3차 계획 전 |
| Email forwarding state | 사용자·support consumer가 없으면 제거 | 3차 계획 전 |
| Apple payload hash | 불일치 탐지를 구현하지 않으면 제거 | 3차 계획 전 |
| Legacy auto-post rollback | `0030` 이전 rollback 종료 후 제거 | 3차 계획 전 |

## 다음 추천 작업

1. 1차 배포만 별도 implementation plan으로 쪼개 schema gate와 retention 정책부터 구현한다.
2. 완료 조건은 fresh DB·restricted restore migration 검증, TTL replay 테스트, 만료 batch cleanup 테스트, 배포 전후 비식별 무결성 검사 통과다.
3. 1차 운영 관측이 안정된 뒤 강한 제거 후보 2개를 2차 migration으로 진행한다.
