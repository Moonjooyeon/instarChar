---
title: 팔로우 게시글 좋아요 영구 저장 작업 계획
author: black (black@ashwoodfriends.com)
created: 2026-07-24
updated: 2026-07-24
version: 1.0.0
status: review
---

# 팔로우 게시글 좋아요 영구 저장 작업 계획

## 1. 목적

현재 팔로우 게시글의 좋아요 상태는 프런트엔드 메모리에만 저장된다. 따라서 새로고침, 재로그인, 앱 재시작 또는 다른 기기 접속 후에는 좋아요 여부와 증가한 개수가 사라진다.

이번 작업은 좋아요 기록을 PostgreSQL에 저장하고, 현재 캐릭터별 좋아요 여부와 게시글별 전체 좋아요 수를 백엔드 API에서 일관되게 제공하는 것을 목표로 한다.

## 2. 성공 기준

- 팔로우 게시글에서 누른 좋아요가 새로고침, 재로그인, 앱 재시작 후에도 유지된다.
- 같은 사용자가 보유한 여러 캐릭터는 각각 독립적으로 같은 게시글에 좋아요를 누를 수 있다.
- 한 캐릭터는 같은 게시글에 좋아요를 한 번만 반영할 수 있다.
- 좋아요와 좋아요 취소를 여러 번 요청해도 전체 개수가 중복 증가하거나 음수가 되지 않는다.
- 여러 백엔드 인스턴스에서 동시에 요청해도 PostgreSQL 제약조건을 기준으로 결과가 일관된다.
- 타임라인을 불러올 때 게시글마다 개별 조회하지 않고 한 번의 일괄 조회로 좋아요 상태를 반영한다.
- API 실패 시 화면의 낙관적 변경을 되돌리고 사용자가 다시 시도할 수 있는 오류를 표시한다.

## 3. 범위 해석과 전제

### 3.1 좋아요 주체

인증과 데이터 소유권의 최상위 단위는 사용자이지만, SNS 활동 주체는 현재 선택한 캐릭터다.

- 사용자 ID는 요청 인증과 캐릭터 소유권 검증에 사용한다.
- 실제 좋아요 주체는 `owner_id + source_account_id`로 식별되는 현재 캐릭터다.
- 같은 사용자가 캐릭터 A와 캐릭터 B로 같은 게시글에 좋아요를 누르면 각각 한 건으로 집계한다.

이 기준은 현재 프런트엔드가 좋아요 임시 상태를 `activeId`별로 분리하는 동작과 일치한다.

### 3.2 대상 게시글

이번 범위는 타임라인에 표시되는 팔로우 캐릭터 게시글이다.

- 대상 캐릭터는 기존 `shared_characters.id`로 식별한다.
- 대상 게시글은 공유 캐릭터 snapshot 안의 원본 `post.id`로 식별한다.
- 프런트 표시용 합성 ID인 `followed:{sharedId}:{postId}`는 DB에 저장하지 않는다.
- `post.id`가 숫자 또는 문자열일 수 있으므로 API와 DB에서는 문자열로 정규화한다.

### 3.3 좋아요 수

기존 게시글 JSON의 `likes`는 과거 또는 작성자 게시글 흐름에서 만들어진 기본값으로 유지한다. 새 테이블에는 이번 기능을 통해 발생한 캐릭터별 좋아요 기록만 저장한다.

API가 반환하는 최종 좋아요 수는 아래와 같이 계산한다.

```text
표시 좋아요 수 = 게시글 JSON의 기존 likes + character_post_likes 행 개수
```

좋아요 API는 대상 게시글 JSON을 직접 수정하지 않는다. 이 원칙으로 게시글 revision 저장과 좋아요 요청이 서로 덮어쓰는 문제를 막는다.

## 4. 이미 존재하는 구현

| 기존 구현 | 경로 | 재사용 여부 |
|---|---|---|
| 현재 캐릭터 게시글의 revision 기반 저장 | `backend/app/repositories/character_posts.py` | 유지한다. 팔로우 게시글 좋아요는 이 경로와 분리한다. |
| 팔로우 대상의 안정적인 공유 ID | `SharedCharacter.id`, `CharacterFollow.target_shared_character_id` | 좋아요 대상 식별과 팔로우 여부 검증에 재사용한다. |
| 현재 캐릭터 소유권 식별 | `Character.owner_id`, `Character.source_account_id` | 좋아요 주체 검증과 복합 외래키에 재사용한다. |
| 원본 게시글 ID 보존 | `FeedPost.originalPostId` | API 요청의 `post_id`로 사용한다. |
| 대상 공유 캐릭터 ID 보존 | `FeedPost.authorSharedId` | API 요청의 `target_shared_character_id`로 사용한다. |
| 팔로우 게시글 임시 좋아요 상태 | `followedLikesByAccount`, `FollowedLikeState` | 서버 상태로 교체한 뒤 제거한다. |
| 공통 API 요청 경계 | `apps/frontend/src/api/client.ts` | 인증 쿠키, JSON 파싱, 오류 형식을 재사용한다. |

## 5. 데이터 모델

Alembic revision `20260724_0003`에서 `character_post_likes` 테이블을 추가한다.

| 컬럼 | 타입 | 규칙 |
|---|---|---|
| `id` | UUID | 기본 키 |
| `liker_owner_id` | UUID | 현재 사용자 ID |
| `liker_account_id` | VARCHAR(120) | 현재 캐릭터의 `source_account_id` |
| `target_shared_character_id` | UUID | `shared_characters.id` 참조, 대상 삭제 시 함께 삭제 |
| `target_post_id` | VARCHAR(120) | 문자열로 정규화한 원본 게시글 ID |
| `created_at` | TIMESTAMPTZ | 좋아요 생성 시각 |

제약조건과 인덱스:

- `liker_owner_id + liker_account_id`는 `characters.owner_id + characters.source_account_id`를 참조하며 캐릭터 삭제 시 함께 삭제한다.
- `liker_owner_id + liker_account_id + target_shared_character_id + target_post_id`에 unique constraint를 둔다.
- `target_shared_character_id + target_post_id`에 집계용 index를 둔다.
- 대상 공유 캐릭터 삭제 시 관련 좋아요를 모두 cascade 삭제한다.

```text
[users]
   |
   | owns
   v
[characters] <---- composite FK ---- [character_post_likes]
                                          |
                                          | target FK
                                          v
                                 [shared_characters]
                                          |
                                          | character.posts JSON
                                          v
                                      [post.id]
```

개별 게시글은 아직 JSON 배열에 있으므로 DB 외래키로 직접 연결할 수 없다. 대신 쓰기 시 공유 snapshot 안에 `target_post_id`가 실제로 존재하는지 백엔드에서 검증한다.

## 6. API 계약

좋아요 전용 router, schema, repository를 추가한다. 모든 경로는 로그인 세션을 요구한다.

### 6.1 일괄 상태 조회

`POST /api/post-likes/query`

요청:

```json
{
  "liker_account_id": "acc_123",
  "targets": [
    {
      "target_shared_character_id": "shared-character-uuid",
      "post_id": "post-uuid"
    }
  ]
}
```

응답:

```json
{
  "items": [
    {
      "target_shared_character_id": "shared-character-uuid",
      "post_id": "post-uuid",
      "available": true,
      "liked": true,
      "likes": 4
    }
  ]
}
```

규칙:

- `liker_account_id`가 현재 사용자의 캐릭터인지 검증한다.
- 한 요청의 `targets`는 최대 100개로 제한하고 중복 키를 제거한다.
- 대상 공유 캐릭터와 게시글을 묶어서 조회하고 좋아요 수를 일괄 집계한다.
- 존재하지 않는 대상은 응답에서 누락하지 않고 `liked: false`, `likes: 0`, `available: false`로 명시한다.

### 6.2 좋아요 상태 변경

`PUT /api/post-likes`

요청:

```json
{
  "liker_account_id": "acc_123",
  "target_shared_character_id": "shared-character-uuid",
  "post_id": "post-uuid",
  "liked": true
}
```

응답:

```json
    {
      "target_shared_character_id": "shared-character-uuid",
      "post_id": "post-uuid",
      "available": true,
      "liked": true,
      "likes": 4
    }
```

규칙:

- `liked: true`는 PostgreSQL `ON CONFLICT DO NOTHING`으로 저장한다.
- `liked: false`는 정확히 일치하는 현재 캐릭터의 행만 삭제한다.
- 요청을 반복해도 최종 상태와 개수가 같도록 멱등하게 처리한다.
- 현재 캐릭터가 실제로 해당 공유 캐릭터를 팔로우 중인지 검증한다.
- 대상 공유 캐릭터와 원본 게시글이 없으면 `404`를 반환한다.
- 현재 사용자가 `liker_account_id`를 소유하지 않으면 `403`을 반환한다.
- 성공 응답은 DB를 다시 기준으로 계산한 최종 `liked`, `likes`를 반환한다.

## 7. 데이터 흐름

### 7.1 타임라인 진입

```text
[팔로우 캐릭터 게시글 구성]
              |
              v
[sharedId + originalPostId 목록 추출]
              |
              v
[POST /api/post-likes/query]
              |
              +--> 현재 캐릭터 소유권 검증
              +--> 대상 게시글 기본 likes 추출
              +--> 좋아요 행 GROUP BY 집계
              |
              v
[liked / likes를 합성 게시글에 병합]
              |
              v
[타임라인 렌더링]
```

### 7.2 좋아요 클릭

```text
[사용자 클릭]
      |
      v
[화면에 낙관적 반영 + 해당 버튼 pending]
      |
      v
[PUT /api/post-likes]
      |
      +--> 성공: 서버 최종값으로 교정
      |
      +--> 실패: 이전값 복원 + 오류 표시
```

같은 게시글 버튼이 처리 중일 때는 추가 클릭을 막는다. 다른 게시글의 좋아요는 독립적으로 처리할 수 있다.

## 8. 단계별 작업

### Phase L1. PostgreSQL 모델과 마이그레이션

- [ ] `CharacterPostLike` ORM 모델을 추가한다.
- [ ] 모델 export를 추가한다.
- [ ] `20260724_0003` Alembic 마이그레이션을 추가한다.
- [ ] 복합 외래키, target cascade, unique constraint, 집계 index를 정의한다.
- [ ] upgrade와 downgrade 순서를 검증한다.

완료 조건:

- 동일 캐릭터와 동일 게시글 조합의 중복 insert가 DB에서 차단된다.
- 캐릭터 또는 공유 캐릭터 삭제 시 관련 좋아요가 남지 않는다.

### Phase L2. 백엔드 schema, repository, API

- [ ] 좋아요 query와 상태 변경용 Pydantic schema를 추가한다.
- [ ] `PostLikesRepository`에 현재 캐릭터 소유권 검증을 추가한다.
- [ ] 대상 팔로우 여부와 원본 게시글 존재 여부를 검증한다.
- [ ] 일괄 상태 조회를 단일 집계 흐름으로 구현한다.
- [ ] 좋아요 추가와 취소를 멱등한 트랜잭션으로 구현한다.
- [ ] `post_likes.py` router를 `/api`에 등록한다.
- [ ] 잘못된 소유권은 `403`, 없는 대상은 `404`로 구분할 수 있도록 공통 오류를 보완한다.

완료 조건:

- 중복 요청과 취소 재요청이 개수를 왜곡하지 않는다.
- 다른 사용자의 `source_account_id`를 사용한 요청이 거부된다.
- 게시글 revision이나 공유 snapshot 전체를 저장하지 않고 좋아요만 변경된다.

### Phase L3. 프런트엔드 API와 도메인 상태

- [ ] `apps/frontend/src/api/postLikes.ts`에 query와 상태 변경 함수를 추가한다.
- [ ] `FeedPost`의 `authorSharedId`, `originalPostId`를 서버 요청의 권위 식별자로 사용한다.
- [ ] 합성된 타임라인 ID를 서버에 보내지 않도록 변환 함수를 둔다.
- [ ] 서버 응답을 팔로우 게시글에 병합하는 순수 도메인 함수를 추가한다.
- [ ] `followedLikesByAccount`, `FollowedLikeState`, 임시 토글 함수를 제거한다.

완료 조건:

- 서버 상태를 받기 전에는 게시글 snapshot의 기본 좋아요 수를 표시한다.
- 서버 상태를 받은 후에는 같은 게시글의 `liked`, `likes`만 갱신되고 작성자·본문·시간은 유지된다.

### Phase L4. 타임라인 연동과 사용자 피드백

- [ ] 피드 진입, 현재 캐릭터 변경, 팔로우 목록 또는 팔로우 게시글 변경 시 좋아요 상태를 일괄 조회한다.
- [ ] 팔로우 게시글 좋아요 클릭을 낙관적으로 반영한다.
- [ ] 게시글별 pending 상태로 빠른 중복 클릭을 막는다.
- [ ] 성공 시 서버의 최종 개수로 화면을 교정한다.
- [ ] 실패 시 이전 상태로 되돌리고 기존 저장 상태 표시 영역에 오류를 안내한다.
- [ ] unmount 또는 현재 캐릭터 변경 뒤 도착한 이전 요청 응답이 새 화면 상태를 덮지 않게 한다.

완료 조건:

- 좋아요가 즉시 보이고 새로고침 후에도 같은 상태로 복원된다.
- 네트워크 실패 시 거짓 좋아요 상태가 화면에 남지 않는다.

### Phase L5. 테스트와 문서

- [ ] migration 및 ORM 제약조건을 검증한다.
- [ ] repository와 API 계약 테스트를 추가한다.
- [ ] 프런트 API 요청 형식과 오류 파싱 테스트를 추가한다.
- [ ] 좋아요 상태 병합, 낙관적 반영, rollback 도메인 테스트를 추가한다.
- [ ] 실제 실행 중 앱에서 영구 저장 시나리오를 수동 검증한다.
- [ ] 백엔드 구조와 API 문서에 새 모델과 endpoint를 반영한다.
- [ ] 본 계획서의 체크리스트와 진행 현황을 구현 결과에 맞춰 갱신한다.

## 9. 테스트 계획

### 9.1 백엔드

| 구분 | 시나리오 | 기대 결과 |
|---|---|---|
| API | 현재 캐릭터로 팔로우 게시글 좋아요 | `liked: true`, 전체 수 1 증가 |
| API | 같은 요청을 두 번 전송 | 행과 전체 수가 한 번만 증가 |
| API | 좋아요 취소를 두 번 전송 | 오류 없이 `liked: false`, 개수 음수 방지 |
| API | 같은 사용자의 다른 캐릭터가 좋아요 | 별도 기록으로 전체 수 1 추가 |
| 권한 | 다른 사용자의 `liker_account_id` 사용 | `403` |
| 권한 | 팔로우하지 않은 대상에 좋아요 | 거부 |
| 검증 | 없는 공유 캐릭터 또는 게시글 ID | `404` |
| 조회 | 100개 대상 일괄 조회 | 입력 키별 `liked`, `likes` 반환 |
| 동시성 | 같은 좋아요를 동시에 요청 | unique constraint로 한 행만 생성 |
| 삭제 | 좋아요 주체 캐릭터 삭제 | 해당 캐릭터의 좋아요 cascade 삭제 |
| 삭제 | 대상 공유 캐릭터 삭제 | 대상 게시글의 좋아요 cascade 삭제 |
| 회귀 | 게시글 revision 저장 | 좋아요 행과 무관하게 기존 동작 유지 |

### 9.2 프런트엔드

| 구분 | 시나리오 | 기대 결과 |
|---|---|---|
| 도메인 | query 결과를 합성 게시글에 병합 | 본문과 작성자 유지, 좋아요 필드만 변경 |
| 도메인 | 동일 post ID가 서로 다른 공유 캐릭터에 존재 | `sharedId + postId` 조합으로 구분 |
| API | query 및 update 요청 | 원본 ID와 현재 `activeId` 전송 |
| UI | 좋아요 성공 | 즉시 반영 후 서버 최종값 유지 |
| UI | 좋아요 실패 | 이전값 rollback, 오류 안내 |
| UI | 빠른 중복 클릭 | 처리 중인 같은 버튼의 추가 요청 차단 |
| UI | 캐릭터 전환 중 이전 응답 도착 | 새 캐릭터 상태를 덮지 않음 |
| E2E | 좋아요 후 새로고침 | 좋아요 상태와 개수 유지 |
| E2E | 다른 캐릭터로 전환 | 캐릭터별 좋아요 여부가 독립적으로 표시 |
| E2E | 좋아요 취소 후 새로고침 | 취소 상태 유지 |

### 9.3 검증 명령

프로세스는 새로 시작하지 않고, 정적 검사와 테스트 명령만 실행한다.

```bash
PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache backend/.venv/bin/python -m compileall -q backend/app backend/tests backend/migrations
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run test:domain
npm --prefix apps/frontend run build
npm --prefix apps/frontend run test:e2e -- --list
```

실제 좋아요 영구 저장 검증은 이미 실행 중인 프런트엔드와 백엔드가 있을 때 아래 순서로 확인한다.

1. 캐릭터 A의 타임라인에서 팔로우 게시글에 좋아요를 누른다.
2. 새로고침 후 좋아요 여부와 개수가 유지되는지 확인한다.
3. 캐릭터 B로 전환해 같은 게시글의 좋아요 여부가 독립적인지 확인한다.
4. 캐릭터 A로 돌아와 좋아요를 취소한다.
5. 다시 새로고침해 취소 상태가 유지되는지 확인한다.

## 10. 실패 모드와 대응

| 실패 모드 | 백엔드 대응 | 프런트 대응 | 테스트 |
|---|---|---|---|
| 빠른 중복 클릭 | unique constraint와 멱등 update | 게시글별 pending 처리 | API, UI |
| 두 기기에서 동시 좋아요 | DB 최종 상태와 count를 응답 | 응답값으로 화면 교정 | repository |
| 타임라인 조회 중 일부 게시글 삭제 | `available: false` 반환 | 해당 응답을 무시하고 다음 동기화에서 제거 | API, domain |
| 공유 snapshot과 원본 게시글 변경 시점 차이 | 쓰기 시 현재 snapshot 재검증 | 실패 rollback과 재시도 안내 | API |
| 세션 만료 | 공통 `401` 응답 | 기존 인증 복구 흐름 사용 | API |
| 네트워크 또는 서버 오류 | 트랜잭션 rollback | 낙관적 상태 rollback과 오류 표시 | UI |
| 캐릭터 전환 뒤 늦은 응답 | 요청 결과에 actor key 포함 | 현재 `activeId`와 다르면 폐기 | hook |
| 게시글 JSON의 잘못된 likes 값 | 0 이상의 정수로 정규화 | 서버가 준 최종값 사용 | repository |

사용자에게 보이지 않는 조용한 실패를 허용하지 않는다. 모든 쓰기 실패는 화면 상태를 원복하고 오류 메시지를 남긴다.

## 11. 성능과 운영

- 타임라인 상태 조회는 게시글별 요청이 아닌 최대 100개 단위의 일괄 요청으로 처리한다.
- 좋아요 수는 `target_shared_character_id + target_post_id` index를 사용해 집계한다.
- 초기 규모에서는 별도 counter column이나 캐시를 두지 않고 실제 좋아요 행을 집계한다.
- 게시글당 좋아요 수가 커져 집계 지연이 측정될 때만 counter table 또는 비동기 집계를 별도 계획으로 검토한다.
- 마이그레이션은 새 테이블만 추가하므로 기존 프런트엔드와 호환된다.
- 배포 순서는 `DB migration → backend API → frontend`로 진행한다.
- 기존 프런트엔드가 동작 중인 동안 새 테이블은 사용되지 않으므로 단계적 배포가 가능하다.
- 기존 메모리 좋아요 상태는 영구 기록이 아니므로 backfill하지 않는다.

## 12. 구현 순서와 커밋 단위

1. `feat(backend): add persistent character post likes`
   - 모델, 마이그레이션, schema, repository, API, 백엔드 테스트
2. `feat(frontend): persist followed post likes`
   - API client, 도메인 병합, hook 연동, 프런트 테스트
3. `docs: document persistent post likes`
   - 구조/API 문서, 계획서 진행 현황

백엔드 계약이 프런트 구현의 선행 조건이고 양쪽 모두 타임라인 식별자에 의존하므로 순차 구현한다. 별도 worktree 병렬화는 적용하지 않는다.

## 13. 이번 작업에서 제외

- 좋아요를 누른 캐릭터 목록 공개: 영구 기록에는 포함되지만 조회 UI와 공개 API는 별도 제품 요구사항이다.
- 좋아요 알림과 푸시 알림: 알림 도메인과 전달 정책이 아직 없다.
- 좋아요 기반 타임라인 추천 또는 정렬: 이번 목표는 저장과 표시 일관성이다.
- 댓글 좋아요: 게시글 좋아요와 별도 식별·권한 정책이 필요하다.
- 내 게시글 좋아요 경로의 전면 마이그레이션: 현재 revision 기반 저장을 유지하고 팔로우 게시글만 새 API로 전환한다.
- 게시글 JSON의 관계형 테이블 전환: 현재 게시글 권위 구조 전체를 바꾸는 작업으로 범위가 크다.
- 기존 세션 임시 좋아요의 데이터 이전: 서버에 신뢰할 수 있는 원본 기록이 없다.

## 14. 작업 현황

- [x] 기존 게시글, 팔로우, 프런트 임시 좋아요 흐름 조사
- [x] 데이터 모델과 API 계약 설계
- [x] 테스트, 오류 처리, 배포 순서 정의
- [ ] 계획 승인
- [ ] Phase L1 구현
- [ ] Phase L2 구현
- [ ] Phase L3 구현
- [ ] Phase L4 구현
- [ ] Phase L5 검증 및 문서화

계획 승인 전에는 코드 구현과 마이그레이션 적용을 진행하지 않는다.
