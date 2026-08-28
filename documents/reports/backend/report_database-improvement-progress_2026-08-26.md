---
title: 데이터베이스 스키마·데이터 개선 진행 현황
author: black (black@ashwoodfriends.com)
created: 2026-08-26
updated: 2026-08-26
version: 1.0
status: active
---

# 데이터베이스 스키마·데이터 개선 진행 현황

## 결과

2026년 8월 26일 기준으로 운영 데이터를 삭제하지 않는 1차 관측 단계의 구현과 배포는 완료됐다. Schema migration gate, 운영 dump 기반 로컬 rehearsal, `native_oauth_codes` cleanup 코드와 dry-run 관측, `credit_usages.response_body` 보존 관측, Legacy AI metadata 분리 관측이 반영됐다. 실제 데이터 cleanup은 실행하지 않았으며 OAuth Cleanup은 사용자 결정에 따라 비활성 상태를 유지한다. 전체 개선 계획은 부분 완료 상태로, replay 관측과 AI metadata 관측을 최소 1주 진행한 뒤 payload 축소·cleanup 및 컬럼 제거 단계로 넘어간다.

기준 계획은 [데이터베이스 스키마·데이터 개선 계획](../../plans/backend/data-migration/plan_database-schema-and-data-improvement_2026-08-26.md)이다.

## 확정 결정

| 항목 | 결정 |
|---|---|
| GitHub Actions | 연결하지 않는다. Schema gate는 현재 로컬·배포 전 명령으로 운영한다. |
| OAuth Cleanup | `NATIVE_OAUTH_CODE_CLEANUP_ENABLED=false`를 유지한다. |
| AI response cleanup | 실제 replay 연령을 최소 1주 관측하기 전에는 활성화하지 않는다. |
| Legacy AI metadata | 감사 데이터는 유지하고 현재 prompt 경고와 분리한다. |
| 운영 데이터 | 집계 결과만 문서화하며 응답 본문·사용자 ID·idempotency key는 기록하지 않는다. |

## 단계별 진행 상태

| 단계 | 작업 | 상태 | 다음 조건 |
|---:|---|---|---|
| 1 | Schema migration gate | 부분 완료 | 단일 head·migration test는 적용됨. GitHub Actions 연동은 제외 결정. |
| 2 | 운영 dump 기반 migration rehearsal | 로컬 완료 | 실제 제한 staging 환경이 필요해지는 migration 전에 재실행. |
| 3 | `native_oauth_codes` retention | 배포 A 완료·활성화 보류 | 사용자 승인 전까지 cleanup flag `false` 유지. |
| 4-A | `credit_usages.response_body` 관측 | 운영 배포 완료·관측 중 | 2026-09-02 이후 최대 replay 연령과 payload 분포 확인. |
| 4-B | 신규 row 최소 replay payload | 미착수 | 단계 4-A 관측 결과로 TTL과 API replay contract 확정. |
| 4-C | 기존 response payload cleanup | 미착수 | backup·checksum, dry-run, 단계 4-B 안정화 필요. |
| 5 | Legacy AI metadata 관측 분리 | 운영 배포 완료·관측 중 | 2026-09-02 이후 현재 prompt anomaly가 계속 0인지 확인. |
| 6 | `credit_accounts.version` 제거 | 미착수 | 운영 값 분포·reader 재확인 후 expand-contract 적용. |
| 7 | `apple_oauth_credentials.last_validated_at` 제거 | 미착수 | Apple 기능 승인과 실제 consumer 재확인. |
| 8 | Migration release control | 부분 적용 | migration 배포마다 expected/current head와 rollback evidence를 강제. |
| 9 | Apple 조건부 컬럼 정리 | 미착수 | 제품·보안 승인과 writer 관측 기간 필요. |
| 10 | Legacy auto-post 표식 제거 | 미착수 | 과거 rollback 지원 종료 승인 필요. |
| 11 | JSON projection 개선 | 미착수 | 별도 장기 계획과 dual-write/shadow-read 필요. |

## 구현 결과

### Schema 관리

- `backend/scripts/check_schema_migrations.py`가 Alembic graph의 단일 base와 단일 head를 검사한다.
- `make backend-test`가 schema migration gate를 먼저 실행한다.
- 최신 검증 head는 `20260826_0034`다.
- 신규 table·column 변경은 ORM과 새 Alembic revision을 함께 추가하는 방식을 유지한다.

### `native_oauth_codes`

- `expires_at` index와 grace period 기반 제한 batch cleanup 경로가 구현됐다.
- 삭제 전 운영 집계를 확인할 수 있다.
- 운영 cleanup flag는 `false`이며 row 삭제는 실행하지 않는다.
- 활성화는 기능 결함이 아니라 사용자 결정으로 보류됐다.

### `credit_usages.response_body`

- 신규 response 저장 시 flow, prompt version, status, payload byte 크기를 비식별 로그로 남긴다.
- idempotency replay 시 payload 크기와 요청 연령을 비식별 로그로 남긴다.
- 응답 본문, 사용자 ID, idempotency key는 로그에 포함하지 않는다.
- `python -m scripts.observe_credit_responses`로 status와 prompt version별 보관 현황을 읽기 전용 집계한다.

### AI metadata

- 현재 prompt version은 코드의 `AI_PROMPT_VERSION`을 기준으로 판단한다.
- `legacy`, 이전 prompt, 현재 prompt를 별도 cohort로 분류한다.
- 현재 prompt의 committed row만 metadata 누락·0원 provider cost 경고 후보가 된다.
- 신규 현재 prompt anomaly는 사용자 식별 정보 없이 warning 로그로 남긴다.
- `python -m scripts.observe_ai_metadata`로 운영 현황을 읽기 전용 집계한다.

## 운영 baseline

### Response payload

2026년 8월 26일 운영 집계 결과다. 크기는 PostgreSQL `pg_column_size` 기준이므로 plain SQL dump 직렬화 크기와 직접 비교하지 않는다.

| 상태 | Prompt | 전체 row | Non-empty | 전체 크기 | 평균 | 최대 | 24시간 초과 | 72시간 초과 | 7일 초과 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| committed | `ai-prompt-2026-08-v1` | 2 | 2 | 2,832 bytes | 1,416 | 1,520 | 2 | 2 | 2 |
| committed | `ai-prompt-2026-08-v2` | 464 | 464 | 4,731,342 bytes | 10,197 | 20,484 | 444 | 343 | 42 |
| committed | `legacy` | 63 | 63 | 714,086 bytes | 11,335 | 17,864 | 63 | 63 | 63 |
| refunded | `ai-prompt-2026-08-v2` | 62 | 0 | 0 bytes | 0 | 0 | 0 | 0 | 0 |
| 합계 | - | 591 | 529 | 5,448,260 bytes | - | 20,484 | 509 | 408 | 107 |

해석:

- 전체 non-empty payload는 약 5.20 MiB다.
- non-empty row 중 509건은 24시간, 408건은 72시간, 107건은 7일을 넘었다.
- 저장된 row의 연령은 실제 replay 요청 연령이 아니다. 이 baseline만으로 TTL을 확정하지 않는다.

### AI metadata

| 상태 | Cohort | Prompt | 전체 row | Metadata 미완료 | Provider cost 0 | 경고 후보 |
|---|---|---|---:|---:|---:|---:|
| committed | previous | `ai-prompt-2026-08-v1` | 2 | 0 | 0 | 0 |
| committed | current | `ai-prompt-2026-08-v2` | 464 | 0 | 0 | 0 |
| committed | legacy | `legacy` | 63 | 63 | 63 | 0 |
| refunded | current | `ai-prompt-2026-08-v2` | 62 | 13 | 13 | 0 |

해석:

- 현재 prompt의 committed 464건은 metadata 누락과 0원 provider cost가 모두 0건이다.
- Legacy 63건은 과거 감사 데이터로 유지되며 현재 경고에서 제외된다.
- Refunded 13건의 incomplete/0원 값은 committed 회귀가 아니므로 현재 경고 대상이 아니다.

## 검증 결과

| 검증 | 상태 | 결과 |
|---|---|---|
| Backend compile | passed | `make backend-compile` 통과 |
| Schema migration gate | passed | `head=20260826_0034` |
| Backend pytest | passed | 476 passed, 1 skipped |
| Response 관측 Docker image | passed | 이미지 빌드와 로컬 DB 실행 통과 |
| AI metadata 관측 Docker image | passed | 이미지 빌드와 로컬 DB 실행 통과 |
| 운영 response 집계 | passed | 집계 4개 group 출력 확인 |
| 운영 AI metadata 집계 | passed | 현재 committed alert 후보 0건 확인 |
| 운영 DB write | not applicable | 두 관측 script는 읽기 전용이며 migration 없음 |
| AI 정성 평가 | not applicable | prompt·model·응답 contract를 변경하지 않음 |

## 검증하지 못한 것

- 실제 사용자가 idempotency retry를 수행한 최대 연령은 관측 기간이 끝나지 않아 아직 확정하지 못했다.
- 신규 현재 prompt metadata anomaly warning이 운영에서 실제 발생하는 경우는 아직 없다. anomaly가 없는 것이 정상 상태다.
- Docker log가 7일간 보존되는지는 별도 중앙 로그 시스템이나 Docker log rotation 설정에 따라 달라진다.
- OAuth cleanup은 비활성 상태이므로 실제 batch 삭제 시간, lock, 유효 code 영향은 검증하지 않았다.
- GitHub Actions를 사용하지 않으므로 PR 단계의 자동 schema 차단은 검증하지 않는다.

## 남은 위험

1. Docker log가 7일 전에 rotate되면 실제 최대 replay 연령을 잃을 수 있다.
2. Replay 관측 없이 72시간 TTL을 적용하면 더 늦은 정상 retry에 영향을 줄 수 있다.
3. OAuth Cleanup을 장기간 비활성화하면 만료 code row가 계속 증가한다.
4. Schema gate가 PR 자동 검사에 연결되지 않아 개발자가 로컬 명령을 생략할 수 있다.
5. `credit_accounts.version` 등 컬럼 제거 단계는 backup과 expand-contract 없이 진행하면 이전 application image rollback을 방해할 수 있다.

## 1주 관측 명령

2026년 9월 2일 이후 다음 명령을 운영 VM에서 실행한다.

### Response 보관 현황

```bash
docker compose \
  --env-file .env.prod \
  -f docker-compose.prod.yml \
  exec backend \
  python -m scripts.observe_credit_responses
```

### Replay 요청 연령

```bash
docker compose \
  --env-file .env.prod \
  -f docker-compose.prod.yml \
  logs --since=168h backend \
  | grep 'Credit usage response event=replay'
```

```bash
docker compose \
  --env-file .env.prod \
  -f docker-compose.prod.yml \
  logs --since=168h backend \
  | grep 'Credit usage response event=replay' \
  | sed -n 's/.*age_seconds=\([0-9]*\).*/\1/p' \
  | sort -n \
  | tail -1
```

### AI metadata

```bash
docker compose \
  --env-file .env.prod \
  -f docker-compose.prod.yml \
  exec backend \
  python -m scripts.observe_ai_metadata
```

```bash
docker compose \
  --env-file .env.prod \
  -f docker-compose.prod.yml \
  logs --since=168h backend \
  | grep 'AI usage metadata anomaly'
```

## 관측 종료 후 판단 기준

1. 현재 prompt의 committed `alert_candidate_rows`가 계속 0인지 확인한다.
2. Replay 로그의 최대 `age_seconds`와 발생 건수를 확인한다.
3. Replay가 없으면 72시간을 보수적 초기 TTL 후보로 검토하되 즉시 cleanup하지 않는다.
4. TTL을 정한 뒤 신규 row에만 최소 replay payload serializer를 먼저 적용한다.
5. 기존 payload cleanup은 신규 serializer 안정화, backup·checksum, dry-run 이후 batch 50부터 별도 배포한다.

## 다음 추천 작업

1. 2026년 9월 2일까지 response replay와 AI metadata를 관측한다.
2. 관측 중에는 destructive schema/data 변경을 운영에 중첩하지 않는다.
3. 대기 중 필요한 경우 `credit_accounts.version` 값 분포와 runtime reader를 읽기 전용으로 사전검증한다.
4. 관측 통과 후 단계 4-B 최소 replay payload 적용을 별도 PR로 시작한다.
5. 단계 4가 안정화된 뒤 단계 6 `credit_accounts.version` 제거를 호환 image와 contract migration으로 분리해 진행한다.
