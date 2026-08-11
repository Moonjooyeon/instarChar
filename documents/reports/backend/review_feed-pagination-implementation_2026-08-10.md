---
title: 피드 커서 페이지네이션 구현 리뷰
author: Codex
created: 2026-08-10
updated: 2026-08-10
version: 1.0.0
status: review
---

# 피드 커서 페이지네이션 구현 리뷰

## 결과

페이지네이션 구현은 타입 검사·단위 테스트·프런트 build를 통과했지만, **현재 상태로 staging 배포를 권고하지 않는다.** 페이지 경계에서 글이 누락될 수 있는 cursor tie-breaker 결함과 레거시 `id` 없는 글의 React key 충돌이 있다. 또한 API 오류를 빈 피드로 표시하고, 대용량 추천 조회는 전체 후보 정렬을 수행할 수 있다.

## 발견 사항

### P1 — 전역적으로 유일하지 않은 cursor 정렬키가 페이지 경계에서 글을 누락시킬 수 있음

- 위치: [`feed.py`](../../../backend/app/repositories/feed.py)의 `_apply_cursor`, `_apply_recommendation_cursor`, `order_by`; [`20260810_0019_feed_pagination.py`](../../../backend/migrations/versions/20260810_0019_feed_pagination.py)의 index
- 근거: 순서와 cursor가 `(created_at, post_id)`만 사용한다. `public_feed_posts`의 PK는 `(author_character_id, post_id)`이므로 서로 다른 캐릭터가 같은 시각에 같은 `post_id`를 가질 수 있다. 수동 작성의 `Date.now()` ID는 특히 이 충돌을 만들 수 있다.
- 재현: A·B 캐릭터가 같은 timestamp와 `post_id`로 글을 쓰고, 둘 사이에 page limit 경계가 생기게 한다. 다음 cursor의 `< (created_at, post_id)` 조건은 동률인 다른 행을 제외한다.
- 수정: 모든 query/index/cursor에 `author_character_id`를 세 번째 tie-breaker로 추가한다. 예: `ORDER BY created_at DESC, post_id DESC, author_character_id DESC` 및 동등 비교 조건. 추천도 `score, created_at, post_id, author_character_id`로 맞춘다. 이 fixture를 repository/API 테스트로 추가한다.

### P1 — migration이 fallback으로 생성한 legacy post ID가 API 응답에서 사라져 카드가 중복/누락될 수 있음

- 위치: [`20260810_0019_feed_pagination.py`](../../../backend/migrations/versions/20260810_0019_feed_pagination.py)의 `_BACKFILL_SQL`/trigger, [`feed.py`](../../../backend/app/repositories/feed.py)의 `_item_from_row`, [`feed.ts`](../../../apps/frontend/src/api/feed.ts)의 `feedPostFromItem`
- 근거: projection은 `post.payload.id`가 없으면 MD5 값을 `post_id`로 저장한다. 그러나 API DTO는 `post_id`를 보내지 않고 payload만 보내며, 클라이언트는 `item.post?.id || ""`로 React key·dedupe ID를 만든다.
- 영향: 과거 데이터에 ID 없는 글이 두 개 이상 있으면 같은 작성자 글이 `timeline:{sharedId}:`로 합쳐지거나 React key가 중복된다.
- 수정: DTO에 authoritative `post_id`를 추가하고, 클라이언트는 그것을 `originalPostId`와 카드 ID의 유일한 원천으로 사용한다. migration backfill fixture를 추가한다.

### P1 — feed API 실패를 “글이 없음”으로 잘못 표시함

- 위치: [`useFeedPagination.ts`](../../../apps/frontend/src/hooks/useFeedPagination.ts)의 `catch`, [`FeedTimeline.tsx`](../../../apps/frontend/src/app/feed/FeedTimeline.tsx)의 empty state
- 근거: network/401/500은 `isLoading`만 false로 바꾸며 오류 상태·재시도·사용자 메시지를 남기지 않는다. 이후 화면은 빈 목록에 대한 `EmptyFeed`를 렌더한다.
- 영향: 권한 만료, migration 실패, 서버 장애가 콘텐츠 부족처럼 보이며 사용자가 복구할 수 없다.
- 수정: page state에 `error`와 `retry`를 두고, 오류 시 기존 카드가 있으면 유지한 채 하단 재시도 UI를, 첫 페이지면 오류 상태를 보여 준다. API error fixture와 빠른 탭 전환/abort 브라우저 테스트를 추가한다.

### P1 — migration의 한 트랜잭션 backfill과 time cast가 운영 적용을 중단시킬 수 있음

- 위치: [`20260810_0019_feed_pagination.py`](../../../backend/migrations/versions/20260810_0019_feed_pagination.py)
- 근거: migration이 모든 기존 `characters.posts`를 한 번에 `INSERT … SELECT`하고 `time` 문자열을 바로 `timestamptz`로 cast한다. 큰 테이블에서는 긴 transaction·WAL·replication lag를 만들 수 있고, legacy malformed time 하나는 전체 migration을 rollback할 수 있다.
- 수정: schema/trigger migration과 재시작 가능한 batch backfill을 분리한다. `time`은 검증 가능한 ISO timestamp일 때만 cast하고 나머지는 `characters.created_at`으로 fallback한다. staging clone에서 row count·payload checksum·lock/lag를 확인한 후 적용한다.

### P2 — 추천 첫 페이지가 공개 글 전체를 score 정렬할 수 있음

- 위치: [`feed.py`](../../../backend/app/repositories/feed.py)의 `_recommendation_page`
- 근거: `CASE(tags && terms)` 점수는 계산식이며 `(score DESC, created_at DESC)`를 지원하는 materialized score/index가 없다. 후보를 좁히지 않으면 공개 글 수만큼 join/filter/sort한 뒤 21개를 반환한다.
- 수정: 우선 `tag overlap` 후보와 최신 후보를 각각 제한해 union한 뒤 rank하거나, 추천 candidate projection을 둔다. 운영 `EXPLAIN (ANALYZE, BUFFERS)`에서 전체 sort가 확인되면 구현한다. 첫 단계에서 Redis를 추가할 근거는 아직 없다.

### P2 — projection trigger가 댓글/수정마다 해당 캐릭터의 모든 글을 delete/insert함

- 위치: [`20260810_0019_feed_pagination.py`](../../../backend/migrations/versions/20260810_0019_feed_pagination.py)의 `sync_public_feed_posts`
- 근거: `posts` JSONB를 변경할 때 author의 projection을 모두 삭제한 뒤 재삽입한다.
- 영향: 글 40개 상한에서는 수용 가능하지만 댓글이 많은 공개 캐릭터는 write amplification, index churn, dead tuple을 키운다.
- 수정: P1 안정화 후 application-level diff upsert 또는 post 단위 영속화로 바꾼다. 현재는 autovacuum·dead tuple·write latency를 계측한다.

### P2 — 개인화 API에 명시적인 no-store가 없음

- 위치: [`feed.py`](../../../backend/app/api/v1/feed.py)
- 근거: response는 현재 사용자·차단·팔로우에 따라 달라지나 `Cache-Control`을 명시하지 않는다.
- 수정: `Cache-Control: private, no-store`를 적용한다. 현재 CDN 설정이 이를 캐시하지 않더라도 미래 cache rule 변경에서 오노출을 예방한다.

## 악용·권한 검토

- **확인됨:** `source_account_id`는 서버에서 현재 사용자 소유 character로 검증한다. public 여부와 양방향 block 대상도 feed query 전에 적용한다.
- **확인됨:** forged cursor는 다른 사용자의 글을 노출하지 않는다. 모든 페이지 query가 동일한 owner/public/block 조건을 다시 적용한다.
- **남은 개선:** cursor는 서명되지 않아 사용자가 임의 위치로 탐색하거나 score를 조작할 수 있다. 권한 우회는 아니지만 rate limit/관측을 추가하고, 제품상 순서 안정성이 중요하면 HMAC 서명 cursor로 변경한다.
- **범위 외 기존 위험:** follower count route는 인증 dependency가 없다. 공개 count 정책이 맞는지 별도 API 보안 리뷰에서 확정해야 한다.

## 검증 결과

- `PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache backend/.venv/bin/python -m compileall -q backend/app backend/tests backend/migrations`: passed
- `backend/.venv/bin/python -m pytest -q`: passed — 259 tests
- `npm run typecheck`: passed
- `npm run test:domain`: passed — 144 tests
- `npm run build`: passed
- `alembic heads`: passed — `20260810_0019`
- `alembic upgrade head --sql`: failed before the new migration — historical `20260730_0009_character_handle_uniqueness` migration performs a row query that offline SQL mode cannot provide. 새 migration SQL의 end-to-end 전개를 증명하지 못했다.
- 실제 PostgreSQL migration, `EXPLAIN ANALYZE`, 브라우저 scroll/abort, concurrent load: not run — 실행 중인 staging 환경이 없다.

## 변경 파일

- `documents/reports/backend/review_feed-pagination-implementation_2026-08-10.md`: 구현 리뷰·악용 검토·검증 증거
- `documents/reports/backend/README.md`: 보고서 색인

## 다음 추천 작업

1. P1 네 항목(cursor author tie-breaker, authoritative post ID, 오류 UI, 안전한 backfill)을 수정하고 회귀 테스트를 추가한다.
2. staging clone에서 migration과 100k public-post fixture의 query plan/p95를 검증한다.
3. 그 결과에 따라 추천 후보 축소와 projection write 경로를 최적화한다.
