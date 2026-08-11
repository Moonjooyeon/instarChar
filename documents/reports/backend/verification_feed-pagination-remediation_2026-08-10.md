---
title: 피드 페이지네이션 보완·검증 결과
author: Codex
created: 2026-08-10
updated: 2026-08-10
version: 1.1.0
status: verified-local
---

# 피드 페이지네이션 보완·검증 결과

## 결과

리뷰에서 확인한 P1 문제를 수정했다. 서버 커서는 HMAC 서명과 `(created_at, post_id, author_character_id)` 순서를 사용하며, API는 projection의 `post_id`를 그대로 전달한다. 피드 오류는 빈 상태 대신 재시도 UI로 표시한다. 개인화 응답에는 `Cache-Control: private, no-store`를 명시했다.

대량 기존 데이터는 migration transaction에서 제거하고, trigger 설치 후 작은 transaction으로 실행하는 백필 도구로 분리했다. malformed `time`은 작성 시각으로 안전하게 fallback하며, projection trigger는 삭제된 글만 삭제하고 실제 변경된 글만 upsert한다.

## 적용 내용

- `GET /api/feed`의 timeline/recommendation keyset cursor에 작성자 ID tie-breaker와 HMAC 서명을 추가했다.
- recommendation은 태그 일치 글을 먼저, 나머지 최신 글을 다음으로 조회한다. 전체 후보 `CASE` 정렬 대신 태그 GIN index와 각 segment의 created-at keyset을 사용한다.
- API `items[]`에 authoritative `post_id`를 추가했고, 프런트 카드는 이 값을 ID/dedupe 원천으로 사용한다.
- `useFeedPagination`에 명시적인 오류·재시도 상태를 추가했다. 기존 결과가 있으면 유지하고, 첫 요청 실패에는 빈 피드 대신 오류를 표시한다.
- `backend/scripts/backfill_public_feed_posts.py`는 `--batch-size`와 `--after-id`로 재시작 가능한 projection backfill을 제공한다.
- 게시물 저장은 최대 40개와 120자 이하 ID만 허용한다. malformed legacy ID는 로컬 DB에서 0건임을 확인했다.
- 인증 사용자마다 분산 환경에서 공유되는 60회/분 feed rate limit을 적용했다. 한도를 넘으면 `429 RATE_LIMITED`를 반환한다.
- 팔로우·차단·추천 프로필 변경은 프런트 pagination revision을 바꿔 첫 페이지부터 다시 조회한다. 메모리·DOM에는 최근 120개 카드만 남긴다.
- 태그 GIN index는 별도 `20260810_0020` migration에서 concurrent 방식으로 재생성한다.

## 로컬 DB 검증

- `alembic upgrade head`: passed — `20260810_0018 → 20260810_0019` 실제 PostgreSQL 적용
- `alembic current`: passed — `20260810_0020 (head)`
- `python scripts/backfill_public_feed_posts.py --batch-size 100`: passed — 2개 character 처리, projection 4건 확인
- repository 실제 조회: 1개씩 다음 cursor를 따라 recommendation 3건을 중복 없이 수집, timeline 0건 확인
- transaction rollback 기반 trigger 확인: posts 변경 후 해당 projection payload 변경 확인
- 다른 임의 사용자 ID로 source account 접근: `BadRequest` 거부 확인
- 실제 DB transaction에서 동일 사용자 61번째 feed 요청: `429 RATE_LIMITED` 확인 후 rollback

## 회귀 검증

| 검증 | 상태 | 근거 |
|---|---|---|
| Backend compile/test | passed | `compileall`, `pytest -q` — 265 passed |
| Migration unit | passed | incremental trigger·index DDL 확인 |
| Cursor 보안 | passed | feed kind 불일치·서명 변조 거부 테스트 |
| Frontend type/domain/build | passed | `typecheck`, domain 144 passed, Vite build |
| UI 오류 상태 | passed (정적) | hook state와 retry 렌더링 타입·빌드 검증 |

## 아직 증명하지 않은 것

- 100k 이상 public post에서 `EXPLAIN (ANALYZE, BUFFERS)`와 p95/p99은 실행하지 않았다. 현재 로컬 데이터는 4개 projection뿐이라 성능 수치의 근거가 되지 않는다.
- 실행 중인 브라우저 프로세스가 없어 실제 스크롤, offline 재시도, 빠른 탭 전환은 수동 E2E로 확인하지 않았다.
- staging/production rollout, 동시 사용자 부하, CDN/media 및 auto-post worker 분리는 이번 피드 수정 범위에 포함하지 않았다.

## 배포 순서

1. `alembic upgrade head`로 table, index, trigger를 설치한다.
2. 낮은 트래픽 시간에 `python scripts/backfill_public_feed_posts.py --batch-size 100`을 실행한다.
3. 중단되면 출력된 `last_character_id`를 `--after-id`로 넘겨 재개한다.
4. staging에서 실제 계정의 cursor 경계, 권한, `EXPLAIN (ANALYZE, BUFFERS)`를 확인한 뒤 점진적으로 노출한다.
