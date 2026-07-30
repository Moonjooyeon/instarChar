---
title: 캐릭터 아이디 전역 중복 방지 구현 계획
author: black (black@ashwoodfriends.com)
created: 2026-07-30
updated: 2026-07-30
version: 1.0.0
status: review
---

# 캐릭터 아이디 전역 중복 방지 구현 계획

## 1. 목적

캐릭터 생성 및 수정 시 공개 아이디(`@handle`)가 중복되는 문제를 해결한다.

사용자가 보는 아이디는 SNS 계정의 식별자이므로 이름이나 내부 계정 ID와 다르게 모든 사용자와 캐릭터 사이에서 유일해야 한다. 프론트엔드의 사전 확인만으로는 동시에 같은 아이디를 저장하는 요청을 막을 수 없으므로 PostgreSQL 유니크 제약을 최종 판정자로 사용한다.

이번 작업은 다음 결과를 만든다.

- 새 캐릭터는 사용 가능한 아이디를 확보한 뒤에만 생성된다.
- 기존 캐릭터의 아이디 수정도 같은 규칙을 적용한다.
- `Alice`, `@alice`, `ALICE`는 모두 `alice`로 정규화되어 같은 아이디로 취급된다.
- 두 사용자가 동시에 같은 아이디를 선택해도 DB에는 하나만 저장된다.
- 기존 중복·공백 아이디는 마이그레이션에서 결정적 규칙으로 정리된다.
- 공유 캐릭터와 팔로워 스냅샷이 캐릭터의 최신 아이디를 사용한다.
- 아이디 저장 실패를 로컬 성공으로 오인하지 않고 사용자가 화면에서 바로 복구할 수 있다.

## 2. 확정 정책

이 계획서는 아래 권장안을 기준으로 작성한다.

| 항목 | 권장 정책 | 이유 |
|---|---|---|
| 유일성 범위 | 전체 사용자·전체 캐릭터 전역 | 공개 SNS 아이디는 소유자와 무관하게 한 계정만 사용해야 함 |
| 대소문자 | 구분하지 않음 | `Alice`와 `alice`가 다른 계정처럼 보이는 혼란 방지 |
| 저장 형태 | 소문자 정규형만 저장 | 단일 `handle` 컬럼에 일반 유니크 제약을 적용할 수 있음 |
| 허용 문자 | 영문 소문자, 숫자, `.`, `_`, `-` | 기존 `normalizeHandle()` 규칙과 호환 |
| 길이 | 1~24자 | 기존 분석 결과의 최대 길이를 유지해 범위 확대를 피함 |
| 앞뒤 문자 | 영문 소문자 또는 숫자 | 구두점으로 시작·종료하는 애매한 아이디 방지 |
| 필수 여부 | 신규 생성·수정 시 필수 | 이름 기반 표시 fallback도 중복될 수 있으므로 공개 식별자로 부족 |
| 삭제 후 재사용 | 즉시 허용 | 별도 보존 테이블과 유예 기간은 이번 문제 해결 범위를 넘음 |
| 기존 중복 처리 | 가장 오래된 캐릭터가 원본 유지, 나머지는 suffix 부여 | 데이터 삭제 없이 유니크 제약 적용 가능 |
| 기존 공백 처리 | `character`, `character-2` 형태로 결정적 배정 | 모든 기존 캐릭터가 유효한 아이디를 갖게 함 |
| 예약어 | 완전 일치 차단 | 공식 운영 계정 사칭과 향후 아이디 회수 방지 |

2026-07-30에 다음 정책을 확정했다.

1. 아이디는 전체 사용자와 전체 캐릭터에서 전역 유일하다.
2. 기존 중복·공백 아이디는 운영 매핑 확인 후 결정적 규칙으로 변경한다.
3. 삭제한 아이디는 즉시 재사용할 수 있다.
4. 예약어는 일반 사용자가 사용할 수 없다.

초기 예약어는 다음과 같다.

```text
admin
administrator
alive
official
support
help
system
moderator
mod
staff
```

예약어가 포함된 긴 아이디는 허용하고 완전히 일치하는 경우만 차단한다. 예를 들어 `alive_story`는 허용하고 `alive`는 차단한다.

## 3. 현재 동작과 문제 원인

### 3.1 프론트엔드 생성 조건

`apps/frontend/src/hooks/useAliveAppController.tsx`의 `confirmReady`는 이름과 페르소나만 확인한다. 아이디는 필수가 아니며 형식과 중복 상태도 생성 버튼에 반영되지 않는다.

`apps/frontend/src/features/character-setup/ConfirmScreen.tsx`는 아이디를 일반 텍스트 입력으로 렌더링하고 오류·확인 중·사용 가능 상태를 표시하지 않는다.

### 3.2 프론트엔드 캐릭터 식별

`apps/frontend/src/hooks/useAliveCharacterLifecycle.ts`는 새 캐릭터에 `acc_${Date.now()}` 내부 ID를 부여한다. 공개 아이디와 내부 ID는 별개이므로 공개 아이디가 같아도 새 계정이 생성된다.

같은 파일의 `findExistingCharacter()`는 이름·아이디·페르소나가 모두 같은 경우 기존 계정을 선택한다. 이는 공개 아이디 중복 규칙이 아니라 내용 기반 추정이므로 제거해야 한다.

### 3.3 저장 성공 오판

현재 캐릭터 생성은 먼저 React 상태와 로컬 스냅샷을 바꾼 뒤 700ms 자동 저장으로 서버에 반영된다.

`apps/frontend/src/hooks/useAliveStructuredPersistence.ts`의 `syncStructuredState()`는 서버 오류를 경고 로그로만 남긴다. `apps/frontend/src/hooks/useAliveAutosave.ts`와 `useAliveAppStatePersistence.ts`는 구조화 저장을 기다리지 않고 `저장됨`을 표시하는 경로가 있다.

DB 유니크 제약만 추가하면 중복은 DB에서 거절되지만 사용자는 이미 생성된 것처럼 보게 된다. 따라서 캐릭터 생성과 아이디 변경은 일반 자동 저장보다 먼저 실행되는 전용 API가 필요하다.

### 3.4 백엔드와 DB 제약

`backend/app/models/entities.py`의 `Character`는 `(owner_id, source_account_id)`만 유니크하다. `handle`에는 유니크 제약과 형식 제약이 없다.

`backend/app/repositories/profile_state.py`는 모든 캐릭터를 `(owner_id, source_account_id)` 기준으로 bulk upsert한다. 서로 다른 캐릭터가 같은 `handle`을 보내도 모두 저장된다.

### 3.5 중복된 스냅샷

아이디는 다음 위치에 복제된다.

| 저장 위치 | 용도 | 현재 권위 |
|---|---|---|
| `characters.handle` | 소유 캐릭터 구조화 데이터 | 캐릭터 아이디의 권위 데이터로 전환 |
| `characters.character.handle` | 프론트 캐릭터 JSON 복원 | 현재 로드 시 컬럼보다 먼저 사용될 수 있음 |
| `shared_characters.handle` | 탐색·공유 카드 | 공유 시점 스냅샷 |
| `shared_characters.character.handle` | 공유 캐릭터 JSON | 공유 시점 스냅샷 |
| `character_follows.follower_character.handle` | 팔로워 목록 스냅샷 | 팔로우 저장 시점 스냅샷 |
| `profiles.app_state` | 압축 백업 | 구조화 데이터 로드 전 임시 캐시 |
| 브라우저 localStorage | 빠른 초기 표시 | 서버 병합 전 임시 캐시 |

`characters.handle`을 단일 권위 데이터로 정하고 나머지는 같은 트랜잭션 또는 다음 서버 병합에서 갱신해야 한다.

## 4. 성공 기준

### 4.1 사용자 동작

- 신규 캐릭터의 아이디가 비어 있거나 형식이 잘못되면 생성할 수 없다.
- 아이디 입력 중 `확인 중`, `사용 가능`, `이미 사용 중`, `형식 오류`, `확인 실패` 상태가 표시된다.
- 이미 사용 중인 아이디로 생성 또는 수정하면 확인 화면에 남고 입력값과 다른 설정은 보존된다.
- 네트워크 실패 시 캐릭터가 로컬에만 생성된 것처럼 보이지 않는다.
- 현재 캐릭터의 아이디를 그대로 저장하는 수정은 성공한다.
- 서버가 정규화한 아이디가 입력창과 생성된 계정에 반영된다.

### 4.2 데이터 무결성

- `characters.handle`은 전역 유니크다.
- `characters.handle`은 항상 정규형이며 공백이 없다.
- 동시에 들어온 같은 아이디 요청 중 하나만 성공한다.
- 공유 캐릭터와 팔로워 스냅샷이 최신 아이디를 반환한다.
- 일반 구조화 자동 저장이 전용 API로 확정한 아이디를 과거 값으로 되돌리지 못한다.

### 4.3 호환성

- 이전 앱 버전의 구조화 저장으로 새 캐릭터가 들어와도 서버가 유효한 고유 아이디를 배정한다.
- 이전 앱 버전의 자동 저장은 기존 캐릭터 아이디를 변경하지 못하지만 다른 캐릭터 데이터는 계속 저장한다.
- 신규 앱은 전용 API에서 명확한 409 오류를 받고 화면에 안내한다.

## 5. 목표 데이터 흐름

### 5.1 신규 캐릭터 생성

```text
[아이디 입력]
      |
      +--> 프론트 형식 검사
      |       |
      |       +--> 실패: 입력 아래 오류, 생성 버튼 비활성화
      |
      +--> 300ms debounce
              |
              v
     [GET handle-availability] --------------+
              |                              |
              +--> available                 +--> 오류: "저장할 때 다시 확인"
              |                                      제출 자체는 허용
              v
        [깨우기 선택]
              |
              v
[PUT /characters/{stable_draft_id}]
              |
              +--> Pydantic 정규화·검증
              |
              +--> DB INSERT/UPDATE
              |       |
              |       +--> uq_characters_handle 충돌
              |               |
              |               v
              |       409 CHARACTER_HANDLE_TAKEN
              |
              +--> 성공 응답
                      |
                      v
           [React/로컬 상태 반영]
                      |
                      v
              [feed 화면 이동]
                      |
                      v
            [기존 자동 저장 계속]
```

가용성 조회는 UX 보조 수단이다. 최종 성공 여부는 `PUT`과 DB 유니크 제약으로 결정한다.

### 5.2 아이디 수정

```text
[기존 캐릭터 수정]
        |
        +--> 현재 아이디와 동일
        |       |
        |       +--> 가용성 조회 생략, 저장 가능
        |
        +--> 새 아이디
                |
                +--> 가용성 조회(exclude_source_account_id)
                        |
                        v
          [PUT /characters/{source_account_id}]
                        |
                        +--> characters 갱신
                        +--> shared_characters 스냅샷 갱신
                        +--> character_follows 스냅샷 갱신
                        |
                        v
                 [한 트랜잭션 commit]
```

### 5.3 동시 요청

```text
사용자 A: alice 사용 가능 확인 ──> PUT alice ──> UNIQUE INSERT 성공
사용자 B: alice 사용 가능 확인 ──> PUT alice ──> UNIQUE 충돌 ──> 409
```

조회 결과를 잠금이나 예약으로 취급하지 않는다. PostgreSQL 유니크 제약이 동시성 경쟁의 최종 판정자다.

## 6. DB 마이그레이션

### 6.1 신규 마이그레이션

파일:

`backend/migrations/versions/20260730_0009_character_handle_uniqueness.py`

`down_revision`은 현재 head인 `20260728_0008`을 사용한다.

### 6.2 정규형

서버와 마이그레이션에서 같은 규칙을 사용한다.

1. 앞의 `@` 제거
2. 앞뒤 공백 제거
3. 소문자 변환
4. `[a-z0-9._-]` 이외 문자 제거
5. 앞뒤 `.`, `_`, `-` 제거
6. 24자로 자르기
7. 결과가 비면 `character`를 기본값으로 사용

마이그레이션은 Python helper로 모든 캐릭터를 `created_at`, `id` 순서로 읽고 `used_handles` 집합을 사용해 결정적으로 배정한다.

```text
첫 번째 alice  -> alice
두 번째 alice  -> alice-2
세 번째 alice  -> alice-3
기존 alice-2   -> alice-2-2  # 이미 사용된 후보를 건너뜀
공백 첫 번째   -> character
공백 두 번째   -> character-2
```

suffix를 붙일 때 전체 길이가 24자를 넘지 않도록 base를 자른다.

### 6.3 갱신 대상

한 마이그레이션에서 다음 값을 맞춘다.

- `characters.handle`
- `characters.character -> 'handle'`
- 같은 `(owner_id, source_account_id)`의 `shared_characters.handle`
- `shared_characters.character -> 'handle'`
- 같은 `(follower_id, follower_account_id)`의 `character_follows.follower_character -> 'handle'`

`profiles.app_state`는 깊게 중첩된 백업 데이터이므로 DB 마이그레이션에서 직접 재작성하지 않는다. 로그인 시 구조화 캐릭터 행을 권위 데이터로 병합하고 다음 자동 저장에서 백업을 갱신한다.

### 6.4 제약

백필 완료 후 다음 제약을 추가한다.

- `UniqueConstraint("handle", name="uq_characters_handle")`
- `CheckConstraint`로 소문자 정규형과 허용 문자 확인
- `handle` 길이를 `VARCHAR(24)`로 축소
- `handle`의 빈 문자열 기본값 제거

권장 check 조건의 의미는 다음과 같다.

```text
handle ~ '^[a-z0-9](?:[a-z0-9._-]{0,22}[a-z0-9])?$'
```

한 글자 아이디와 2~24자 아이디를 모두 허용해야 하므로 실제 SQL 정규식은 마이그레이션 테스트로 검증한다.

PostgreSQL은 유니크 제약을 유니크 B-tree 인덱스로 강제하므로 별도 조회 인덱스를 추가하지 않는다.

### 6.5 배포 전 읽기 전용 점검

운영 DB에서 다음 수치를 먼저 기록한다.

- 전체 캐릭터 수
- 공백 아이디 수
- 정규화 후 중복 그룹 수
- 변경될 캐릭터 수
- 공유 중인 변경 대상 수
- 가장 큰 중복 그룹

변경 예정 매핑을 CSV로 내보내고 운영자가 검토한다.

```text
owner_id | source_account_id | old_handle | normalized_base | assigned_handle | shared
```

중복이 예상보다 많거나 공식 운영 계정이 포함되면 자동 배포를 중단하고 수동 매핑을 확정한다.

### 6.6 downgrade

downgrade는 유니크·check 제약을 제거하고 컬럼 길이를 120자로 되돌린다. 이미 변경된 아이디 문자열은 자동 복원하지 않는다. 원래 값 복원이 필요하면 배포 전 CSV를 사용한다.

## 7. 백엔드 변경

### 7.1 공통 정규화 모듈

신규 파일:

`backend/app/core/character_handles.py`

책임:

- `normalize_character_handle(value: str) -> str`
- `validate_character_handle(value: str) -> str`
- `next_available_handle(base: str, used: set[str]) -> str`
- `is_reserved_character_handle(value: str) -> bool`

API 스키마, 레거시 구조화 저장, 마이그레이션이 같은 규칙을 사용한다. DB migration에서 앱 코드를 직접 import하면 과거 마이그레이션 재현성이 깨질 수 있으므로 migration 파일에는 작은 동등 helper를 복사하고 테스트로 결과 테이블을 맞춘다.

### 7.2 스키마

신규 파일:

`backend/app/schemas/characters.py`

계약:

```text
CharacterHandleAvailabilityResponse
  handle: str
  available: bool

CharacterWrite
  name: str
  handle: str
  character: dict[str, object]
  gallery: list[object]
  following: list[object]

CharacterWriteResponse
  source_account_id: str
  name: str
  handle: str
  character: dict[str, object]
  gallery: list[object]
  following: list[object]
```

`CharacterWrite.handle`은 입력을 정규화한 뒤 빈 값과 형식 오류를 422로 거절한다. `character.handle`은 클라이언트 값을 신뢰하지 않고 정규화된 최상위 `handle`로 덮어쓴다.

### 7.3 API

수정 파일:

`backend/app/api/v1/characters.py`

추가 endpoint:

| Method | Path | 목적 |
|---|---|---|
| `GET` | `/api/characters/handle-availability` | 입력 중 사용 가능 여부 확인 |
| `PUT` | `/api/characters/{source_account_id}` | 신규 생성 또는 기존 캐릭터 수정 |

가용성 요청:

```http
GET /api/characters/handle-availability?handle=Alice&exclude_source_account_id=acc_123
```

응답:

```json
{
  "handle": "alice",
  "available": true
}
```

`exclude_source_account_id`는 현재 사용자가 소유한 캐릭터만 제외할 수 있다. 다른 사용자의 내부 ID를 전달해도 제외되지 않아야 한다.

저장 충돌:

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "error": "CHARACTER_HANDLE_TAKEN",
  "message": "이미 사용 중인 아이디야."
}
```

### 7.4 저장소

신규 파일:

`backend/app/repositories/characters.py`

`CharacterRepository`의 책임:

- 소유자 범위에서 기존 캐릭터 조회
- 아이디 가용성 조회
- 신규 캐릭터 insert
- 기존 캐릭터 update
- 아이디 변경 시 공유·팔로워 스냅샷 갱신
- named unique constraint 충돌만 `CHARACTER_HANDLE_TAKEN`으로 변환
- 성공 시 한 번 commit, 실패 시 rollback

다른 무결성 오류까지 중복 아이디로 오인하지 않도록 PostgreSQL driver의 constraint name이 `uq_characters_handle`인지 확인한다.

### 7.5 모델

수정 파일:

`backend/app/models/entities.py`

`Character.__table_args__`에 다음을 추가한다.

- 기존 `uq_characters_owner_source` 유지
- `uq_characters_handle` 추가
- 정규형 check constraint 추가

`handle`은 `String(24)`, `nullable=False`로 정의하고 빈 문자열 default를 제거한다.

### 7.6 레거시 구조화 저장 호환

수정 파일:

`backend/app/repositories/profile_state.py`

`_upsert_characters()`를 다음 규칙으로 변경한다.

```text
기존 캐릭터:
  DB handle을 유지
  incoming character.handle도 DB handle로 교체
  이름·설정·갤러리·following만 기존 방식으로 upsert

신규 캐릭터(이전 앱 버전):
  incoming handle 정규화
  비어 있거나 이미 사용 중이면 next_available_handle()로 서버 배정
  character.handle을 배정 결과로 교체
  insert
```

일반 자동 저장은 더 이상 기존 캐릭터의 아이디 변경 경로가 아니다. 신규 앱은 전용 `PUT` endpoint를 사용한다.

이전 앱 두 개가 같은 아이디로 동시에 신규 저장하는 드문 경우 DB 유니크 제약이 한 요청을 거절할 수 있다. 데이터 중복은 발생하지 않지만 이전 앱은 명확한 안내를 표시하지 못한다. 이미 배포된 클라이언트 UI는 서버에서 고칠 수 없으므로 배포 모니터링 항목으로 남긴다.

### 7.7 공유 데이터의 권위

수정 파일:

`backend/app/repositories/shared_characters.py`

`upsert_shared()`는 payload의 `handle`을 그대로 저장하지 않는다.

1. `(user.id, source_account_id)`로 소유 `Character`를 조회한다.
2. `Character.handle`을 `SharedCharacter.handle`과 `character.handle`에 사용한다.
3. 소유 캐릭터가 없으면 공유 요청을 거절한다.

전용 캐릭터 수정 트랜잭션은 이미 존재하는 공유 행과 팔로워 스냅샷도 갱신한다.

### 7.8 오류 타입

수정 파일:

`backend/app/core/errors.py`

`CharacterHandleTakenError`를 추가해 안정적인 오류 코드 `CHARACTER_HANDLE_TAKEN`과 HTTP 409를 제공한다.

## 8. 프론트엔드 변경

### 8.1 공통 아이디 규칙

수정 파일:

`apps/frontend/src/domain/app/textUtils.ts`

기존 `normalizeHandle()`을 서버 규칙과 맞추고 다음 pure helper를 추가한다.

- `normalizeHandle(value: unknown, fallback?: unknown): string`
- `characterHandleError(value: unknown): string`
- `isValidCharacterHandle(value: unknown): boolean`

사용자 직접 입력에는 이름 fallback을 사용하지 않는다. AI 분석 결과를 초기값으로 만들 때만 기존 fallback을 허용한다.

### 8.2 API client

신규 파일:

`apps/frontend/src/api/characters.ts`

제공 함수:

- `getCharacterHandleAvailability(handle, excludeSourceAccountId?)`
- `saveCharacter(sourceAccountId, payload)`

반환 타입은 `ApiResult<T>`를 그대로 사용해 네트워크 오류와 409 메시지를 화면 로직에 전달한다.

### 8.3 가용성 상태 hook

신규 파일:

`apps/frontend/src/hooks/useCharacterHandleAvailability.ts`

상태:

```text
idle
  |
  +--> invalid
  |
  +--> checking
          |
          +--> available
          +--> taken
          +--> unknown  # 네트워크 오류, 최종 PUT으로 재검증
```

요구 동작:

- 입력 변경 후 300ms debounce
- 현재 캐릭터의 기존 아이디는 요청 없이 `available`
- 요청 순번 또는 `AbortController`로 오래된 응답 무시
- 컴포넌트 unmount 후 상태 갱신 금지
- 네트워크 실패는 제출을 막지 않고 안내만 표시
- `taken`과 형식 오류만 제출 차단

### 8.4 생성·수정 lifecycle

수정 파일:

`apps/frontend/src/hooks/useAliveCharacterLifecycle.ts`

변경:

- `wakeCharacter()`를 async 함수로 변경
- `saveCharacterEdits()`를 async 함수로 변경
- `findExistingCharacter()` 제거
- 전용 API 성공 전 `setAccounts`, `setActiveId`, localStorage 저장, 화면 이동 금지
- 서버 응답의 정규화된 `handle`을 로컬 캐릭터에 반영
- 실패 시 `wakingRef`와 로딩 상태 해제
- 실패 시 confirm 화면과 모든 입력값 유지
- 409는 아이디 입력 아래에 연결
- 다른 API 오류는 재시도 가능한 일반 메시지로 표시

신규 캐릭터는 retry에 안전한 draft ID를 한 번만 생성한다.

```text
startNewCharacter()
  -> draftIdRef = acc_<UUID>
  -> 여러 번 PUT해도 같은 owner/source_account_id
  -> 첫 응답이 유실되어도 재시도가 새 orphan row를 만들지 않음
```

`Date.now()`를 submit마다 새로 만드는 방식은 서버 성공 후 응답이 유실됐을 때 재시도가 다른 내부 ID를 만들 수 있으므로 사용하지 않는다.

### 8.5 controller

수정 파일:

`apps/frontend/src/hooks/useAliveAppController.tsx`

변경:

- `confirmReady`에 아이디 형식과 가용성 상태 포함
- 생성·수정 저장 오류 상태 소유
- 아이디가 바뀌면 이전 서버 오류 제거
- availability hook 결과를 `ConfirmScreen`으로 전달
- 저장 중 중복 클릭 방지 상태 전달

controller에 검증 구현을 직접 넣지 않고 pure helper와 전용 hook을 조합한다.

### 8.6 확인 화면

수정 파일:

`apps/frontend/src/features/character-setup/ConfirmScreen.tsx`

아이디 필드를 필수 필드로 변경한다.

표시 예:

```text
아이디 *
[@] [alice________________]
     ✓ 사용할 수 있는 아이디야.
```

상태별 문구:

| 상태 | 문구 | 버튼 |
|---|---|---|
| 빈 값 | `아이디를 입력해줘.` | 비활성 |
| 잘못된 형식 | 구체적인 허용 문자·길이 안내 | 비활성 |
| checking | `아이디를 확인하고 있어.` | 필요 시 잠시 비활성 |
| available | `사용할 수 있는 아이디야.` | 활성 |
| taken | `이미 사용 중인 아이디야.` | 비활성 |
| unknown | `미리 확인하지 못했어. 저장할 때 다시 확인할게.` | 활성 |
| saving | `아이디를 확보하고 있어.` | 비활성 |
| submit 409 | `방금 다른 캐릭터가 사용하기 시작했어. 다른 아이디를 골라줘.` | 비활성 |

접근성:

- 도움말과 오류를 입력의 `aria-describedby`에 연결
- 오류 상태에 `aria-invalid`
- 비동기 상태 문구에 `aria-live="polite"`
- 색만으로 성공·오류를 구분하지 않음

### 8.7 스타일

수정 파일:

`apps/frontend/src/appStyles.ts`

추가 범위:

- 아이디 prefix
- 상태 문구
- 성공·오류·중립 상태
- 작은 화면에서 입력과 상태 문구 줄바꿈

기존 `.al-field`, `.al-row`, `.al-confirm-actions` 토큰을 재사용하고 새 디자인 시스템은 만들지 않는다.

### 8.8 서버 병합 우선순위

수정 파일:

`apps/frontend/src/hooks/useAliveStructuredPersistence.ts`

`characterAccountFromRow()`에서 권위 순서를 명확히 한다.

```text
row.handle
  > row.character.handle
  > cached.char.handle
```

마이그레이션 후 localStorage나 `profiles.app_state`가 잠시 오래된 값을 가지고 있어도 구조화 행이 최종 값을 덮어쓴다.

## 9. API 및 상태 계약

### 9.1 요청 결과 표

| 상황 | availability | PUT | 사용자 결과 |
|---|---:|---:|---|
| 사용 가능 | 200 true | 200 | 생성/수정 후 이동 |
| 이미 사용 중 | 200 false | 409 | confirm 유지, 아이디 오류 |
| 조회 후 경쟁에서 패배 | 200 true | 409 | confirm 유지, 최신 충돌 안내 |
| 형식 오류 | 422 또는 프론트 차단 | 422 | 형식 안내 |
| 세션 만료 | 401 | 401 | 기존 인증 복구 흐름 |
| 네트워크 실패 | request error | request error | 입력 유지, 재시도 |
| 같은 source ID 재시도 | 200 true | 200 | 같은 캐릭터를 idempotent update |

### 9.2 제출 상태 전이

```text
editing
  |
  +--> submit
          |
          v
        saving
          |
          +--> success --> local commit --> feed
          |
          +--> 409 --> editing + handle error
          |
          +--> 401 --> auth recovery
          |
          +--> other error --> editing + retry message
```

## 10. 기존 데이터 및 배포 호환

### 10.1 배포 순서

1. 운영 DB 읽기 전용 중복 보고서 생성
2. 변경 매핑 검토 및 승인
3. DB 마이그레이션과 백엔드 배포
4. 가용성·PUT endpoint smoke test
5. 웹 프론트 배포
6. iOS·Android 새 빌드 배포
7. 409·422·구조화 저장 실패율 모니터링
8. 최소 지원 앱 버전이 올라간 뒤 레거시 자동 배정 경로 제거 여부 검토

백엔드를 먼저 배포해야 신규 프론트가 호출할 endpoint가 준비된다. 백엔드는 이전 클라이언트 구조화 저장을 계속 받아야 한다.

### 10.2 캐시 정합성

로그인 직후 localStorage의 과거 아이디가 잠깐 표시될 수 있다. 원격 구조화 상태가 로드되면 `characters.handle`이 이를 덮어쓴다.

필요하면 마이그레이션 직후 `profiles.app_state`를 비우는 방식도 가능하지만 전체 앱 백업을 잃을 위험이 있어 사용하지 않는다.

### 10.3 관측 지표

- `CHARACTER_HANDLE_TAKEN` 응답 수
- 아이디 가용성 조회 오류율
- `profile/structured-state` 무결성 오류 수
- 레거시 신규 캐릭터 자동 아이디 배정 수
- 마이그레이션 변경 캐릭터 수
- 공유 행과 권위 캐릭터 handle 불일치 수

별도 관측 플랫폼을 추가하지 않고 기존 API 로그와 운영 SQL로 확인한다.

## 11. 테스트 계획

### 11.1 현재 테스트 기반

- 프론트 도메인 테스트: Node test runner
- 프론트 사용자 흐름: Playwright
- 백엔드 API·repository 테스트: pytest
- DB 스키마: Alembic migration 및 PostgreSQL SQL compile 검사

### 11.2 백엔드 단위 테스트

신규 또는 수정 파일:

- `backend/tests/test_character_handles.py`
- `backend/tests/test_characters_api.py`
- `backend/tests/test_profile_api.py`
- `backend/tests/test_shared_characters_api.py`
- `backend/tests/test_migrations.py`

필수 케이스:

- `@Alice`가 `alice`로 정규화
- 잘못된 문자 제거 후 빈 값이면 신규 API 422
- 1자·24자 경계 허용, 25자 입력 처리
- 앞뒤 구두점 제거
- 가용한 아이디 true
- 다른 캐릭터가 사용 중이면 false
- 현재 사용자의 제외 source ID만 제외
- 다른 사용자의 source ID로 우회 불가
- 신규 PUT 성공
- 같은 source ID와 같은 handle 재시도 성공
- 같은 source ID의 다른 handle 수정 성공
- 다른 source ID의 중복 handle은 409
- named unique constraint만 handle conflict로 변환
- 다른 IntegrityError는 500 경로로 전달
- rename 시 shared row와 follower snapshot 갱신
- shared upsert가 payload handle 대신 authoritative handle 사용
- legacy structured sync가 기존 handle을 덮어쓰지 않음
- legacy 신규 공백·중복 handle에 서버 아이디 배정

### 11.3 DB 통합 테스트

실제 PostgreSQL에서 다음을 검증한다.

1. 두 async session이 같은 handle로 insert를 시도한다.
2. 한 transaction만 commit된다.
3. 패배한 transaction은 `uq_characters_handle` 위반을 받는다.
4. rollback 후 session을 다시 사용할 수 있다.
5. availability query가 unique index를 사용한다.

현재 pytest가 실제 PostgreSQL fixture를 제공하지 않으므로 다음 중 하나를 구현 시 선택한다.

- CI에 격리된 PostgreSQL fixture 추가
- 이미 실행 중인 테스트 DB를 사용하는 opt-in integration test 추가

DB 동시성 검증을 mock 테스트로 대체하지 않는다. 프로세스 실행 규칙에 따라 구현 세션에서는 새 DB를 직접 시작하지 않고 기존 실행 환경을 사용하거나 수동 검증 절차를 제공한다.

### 11.4 프론트 도메인 테스트

신규 또는 수정 파일:

- `apps/frontend/tests/domain/text-utils.test.js`
- `apps/frontend/tests/domain/api-characters.test.js`

필수 케이스:

- 클라이언트 정규화가 서버 테스트 표와 일치
- 빈 값·잘못된 형식·길이 경계 메시지
- availability query가 edit 제외 ID를 전송
- PUT payload가 source ID를 path encoding
- 409 메시지가 호출자에 유지
- 서버 응답의 정규화 handle 사용

### 11.5 Playwright E2E

수정 파일:

`apps/frontend/tests/e2e/alive-flow.spec.js`

mock API에 handle availability와 character PUT을 추가한다.

필수 사용자 흐름:

- 사용 가능한 아이디로 캐릭터 생성
- 사용 중인 아이디는 생성 버튼 차단
- 조회 직후 PUT에서 409가 나면 화면 유지
- availability 네트워크 오류 후 PUT 성공
- PUT 네트워크 오류 시 로컬 캐릭터 미생성
- 오류 후 재시도 성공
- 빠른 두 번 클릭에도 PUT 1회
- 수정 시 현재 아이디 그대로 저장
- 수정 시 중복 아이디 거절
- 느린 과거 availability 응답이 최신 입력 상태를 덮어쓰지 않음
- 성공 후 새로고침해도 서버 handle 유지

### 11.6 테스트 커버리지 다이어그램

```text
CODE PATHS                                             USER FLOWS
[+] normalize/validate handle                         [+] 신규 생성
  ├── [PLAN ★★★] 정상·대소문자·@                      ├── [PLAN →E2E] 사용 가능
  ├── [PLAN ★★★] 빈 값·잘못된 문자                    ├── [PLAN →E2E] 이미 사용 중
  └── [PLAN ★★★] 1/24/25자 경계                       ├── [PLAN →E2E] 경쟁 중 409
                                                       └── [PLAN →E2E] 네트워크 실패·재시도
[+] availability
  ├── [PLAN ★★★] available/taken                     [+] 기존 수정
  ├── [PLAN ★★★] own source exclusion                 ├── [PLAN →E2E] handle 유지
  └── [PLAN ★★★] stale response ignored               └── [PLAN →E2E] rename 충돌

[+] atomic PUT                                        [+] 레거시 앱
  ├── [PLAN ★★★] create/update/retry                   ├── [PLAN] 기존 handle 보존
  ├── [PLAN ★★★] unique conflict                       └── [PLAN] 신규 handle 자동 배정
  ├── [PLAN ★★★] rollback
  └── [PLAN ★★★] snapshot propagation                [+] 마이그레이션
                                                       ├── [PLAN] 중복 결정적 변경
[+] DB constraint                                      ├── [PLAN] 공백 변경
  ├── [PLAN INTEGRATION] concurrent winner/loser       └── [PLAN] snapshot 동기화
  └── [PLAN] normalized check
```

구현 전 현재 커버리지는 0이며, 계획된 모든 분기와 사용자 흐름을 같은 작업에서 추가한다.

## 12. 실패 모드

| 실패 모드 | 방지·처리 | 테스트 | 사용자에게 보이는 결과 |
|---|---|---|---|
| 두 사용자가 동시에 같은 handle 저장 | DB unique constraint | PostgreSQL 동시성 통합 테스트 | 패자는 중복 안내 |
| availability 응답 순서 역전 | request sequence/abort | E2E 지연 응답 | 최신 입력 상태 유지 |
| PUT 성공 후 응답 유실 | stable draft ID + idempotent PUT | API retry 테스트 | 재시도로 동일 캐릭터 복구 |
| PUT 실패 후 로컬 상태만 생성 | 서버 성공 후 local commit | E2E 네트워크 실패 | confirm 화면 유지 |
| IntegrityError 후 session unusable | rollback 후 conflict 변환 | repository 테스트 | 재시도 가능 |
| generic autosave가 과거 handle 전송 | DB handle을 legacy sync 권위로 사용 | profile repository 테스트 | 최신 handle 유지 |
| shared payload가 stale handle 전송 | Character.handle 강제 사용 | shared repository 테스트 | 탐색 화면 최신 handle |
| migration suffix 충돌 | used set으로 후보 반복 | migration helper 테스트 | 유니크 배정 |
| localStorage가 과거 handle 보유 | structured row 우선 merge | 프론트 merge 테스트 | 원격 로드 후 정정 |
| 이전 앱 신규 저장 경쟁 | DB constraint, 한 요청 거절 | 운영 로그 | 이전 앱은 명확한 안내 불가 |
| availability endpoint 장애 | 최종 PUT 허용 | E2E | 미리 확인 실패 안내 후 저장 가능 |

테스트도 없고 오류 처리도 없으며 사용자에게 조용히 실패하는 신규 경로는 허용하지 않는다.

## 13. 성능과 보안

### 13.1 성능

- `characters.handle` unique index로 가용성 조회는 O(log N)이다.
- 300ms debounce로 입력 한 글자마다 요청하지 않는다.
- rename은 character 1행, shared character 최대 1행, follower snapshot 여러 행을 한 transaction에서 갱신한다.
- 팔로워 snapshot 갱신은 `(follower_id, follower_account_id)` 조회 인덱스가 필요한지 `EXPLAIN`으로 확인한다.
- 별도 cache는 추가하지 않는다. handle 변경 직후 cache 무효화 문제를 만들 이유가 없다.

### 13.2 보안

- availability와 PUT 모두 인증이 필요하다.
- 제외 source ID는 현재 사용자 소유 범위에서만 적용한다.
- availability는 소유자 정보 없이 boolean만 반환한다.
- payload의 `owner_id`는 받지 않고 세션 사용자 ID를 사용한다.
- `character.handle` JSON 값은 최상위 검증값으로 덮어쓴다.
- 확정된 예약어와 완전히 일치하면 신규 생성·수정을 거절한다.

## 14. 파일별 변경 목록

### 14.1 백엔드

| 파일 | 변경 |
|---|---|
| `backend/migrations/versions/20260730_0009_character_handle_uniqueness.py` | 기존 데이터 정규화·중복 해소·제약 추가 |
| `backend/app/models/entities.py` | handle unique/check/길이 반영 |
| `backend/app/core/character_handles.py` | 공통 정규화·검증 |
| `backend/app/core/errors.py` | stable 409 오류 |
| `backend/app/schemas/characters.py` | availability·write DTO |
| `backend/app/repositories/characters.py` | atomic create/update와 snapshot sync |
| `backend/app/repositories/profile_state.py` | 레거시 sync가 handle을 덮어쓰지 않도록 변경 |
| `backend/app/repositories/shared_characters.py` | authoritative handle 사용 |
| `backend/app/api/v1/characters.py` | GET availability, PUT character |
| `backend/tests/test_character_handles.py` | 정규화·repository 테스트 |
| `backend/tests/test_characters_api.py` | endpoint 계약·409 테스트 |
| `backend/tests/test_profile_api.py` | legacy sync 테스트 |
| `backend/tests/test_shared_characters_api.py` | 공유 handle 권위 테스트 |
| `backend/tests/test_migrations.py` | migration chain·제약 테스트 |

### 14.2 프론트엔드

| 파일 | 변경 |
|---|---|
| `apps/frontend/src/domain/app/textUtils.ts` | 서버와 동일한 handle helper |
| `apps/frontend/src/api/characters.ts` | availability·PUT API |
| `apps/frontend/src/hooks/useCharacterHandleAvailability.ts` | debounce·stale request 처리 |
| `apps/frontend/src/hooks/useAliveCharacterLifecycle.ts` | server-first async create/edit |
| `apps/frontend/src/hooks/useAliveAppController.tsx` | 상태 조합·오류 전달 |
| `apps/frontend/src/hooks/useAliveStructuredPersistence.ts` | authoritative merge 우선순위 |
| `apps/frontend/src/features/character-setup/ConfirmScreen.tsx` | 필수 입력·상태·접근성 |
| `apps/frontend/src/appStyles.ts` | 입력 상태 스타일 |
| `apps/frontend/tests/domain/text-utils.test.js` | 형식 경계 테스트 |
| `apps/frontend/tests/domain/api-characters.test.js` | API adapter 테스트 |
| `apps/frontend/tests/e2e/alive-flow.spec.js` | 생성·수정·충돌·실패 E2E |

### 14.3 문서

| 파일 | 변경 |
|---|---|
| `documents/references/structures/backend.md` | 신규 API·repository·migration 기록 |
| `documents/references/structures/frontend.md` | 신규 API·hook 기록 |
| `README.md` | 필요한 경우 사용자 정책이 아닌 개발 검증 명령만 추가 |

## 15. 구현 순서

### Phase 0. 운영 데이터 확인

- [ ] 정규화 후 중복·공백 수를 조회한다.
- [ ] 변경 매핑 CSV를 생성한다.
- [ ] 공식 계정과 공유 캐릭터 변경을 검토한다.
- [x] 네 가지 제품 결정을 확정한다.

검증: 변경 대상 수와 승인된 매핑 수가 일치한다.

### Phase 1. 정규화 규칙과 DB

- [ ] 서버 정규화 helper와 테스트 표를 작성한다.
- [ ] migration helper가 같은 테스트 표를 통과하게 한다.
- [ ] 0009 migration을 작성한다.
- [ ] 모델 제약을 migration과 일치시킨다.
- [ ] 업그레이드 후 중복·공백이 0인지 확인한다.
- [ ] downgrade가 스키마를 복구하는지 확인한다.

검증: Alembic upgrade, 제약 조회, 중복 SQL, backend unit test.

### Phase 2. 백엔드 전용 저장 경로

- [ ] character schema와 stable conflict error를 추가한다.
- [ ] CharacterRepository availability를 구현한다.
- [ ] idempotent PUT create/update를 구현한다.
- [ ] unique conflict rollback을 구현한다.
- [ ] shared·follower snapshot 갱신을 구현한다.
- [ ] API route와 계약 테스트를 추가한다.

검증: API 테스트와 실제 PostgreSQL 동시성 테스트.

### Phase 3. 레거시 호환

- [ ] structured sync에서 기존 DB handle을 보존한다.
- [ ] 레거시 신규 행에 unique handle을 배정한다.
- [ ] shared upsert가 authoritative handle을 사용하게 한다.
- [ ] 서버 구조화 응답이 정규화 handle을 반환하는지 확인한다.

검증: profile/shared repository 테스트와 이전 payload fixture.

### Phase 4. 프론트 검증과 UX

- [ ] pure handle validation helper를 서버 규칙과 맞춘다.
- [ ] character API client를 추가한다.
- [ ] availability hook을 추가한다.
- [ ] ConfirmScreen 상태·오류·접근성을 구현한다.
- [ ] create/edit를 server-first async 흐름으로 바꾼다.
- [ ] stable draft ID와 중복 submit 방지를 구현한다.
- [ ] structured merge의 handle 우선순위를 고친다.

검증: typecheck, domain tests, Playwright.

### Phase 5. 통합·배포 검증

- [ ] 백엔드 먼저 배포하고 endpoint smoke test를 실행한다.
- [ ] 웹에서 신규 생성·수정·409를 검증한다.
- [ ] iOS와 Android에서 같은 흐름을 검증한다.
- [ ] 이전 앱 payload 호환을 검증한다.
- [ ] 배포 후 불일치 SQL과 오류 로그를 확인한다.
- [ ] 문서를 현재 구조와 맞춘다.

검증: 전체 프론트·백엔드 테스트와 운영 체크리스트.

## 16. 구현 작업 목록

- [ ] **T1 (P1, human: ~4h / Codex: ~40m)** — DB — 기존 handle을 결정적으로 정규화하고 전역 유니크·형식 제약을 추가한다.
  - 근거: 현재 `characters.handle`에 중복 제약이 없다.
  - 파일: migration, `entities.py`, handle helper
  - 검증: migration 및 PostgreSQL 동시성 테스트
- [ ] **T2 (P1, human: ~5h / Codex: ~50m)** — Backend — availability와 idempotent character PUT을 구현한다.
  - 근거: 프론트 사전 조회만으로 동시 요청을 막을 수 없다.
  - 파일: character API, schema, repository, errors
  - 검증: API·repository 테스트
- [ ] **T3 (P1, human: ~3h / Codex: ~35m)** — Backend compatibility — 레거시 자동 저장과 공유 스냅샷이 권위 handle을 보존하도록 한다.
  - 근거: bulk upsert와 공유 payload가 stale handle을 다시 쓸 수 있다.
  - 파일: profile/shared repositories
  - 검증: legacy fixture tests
- [ ] **T4 (P1, human: ~5h / Codex: ~50m)** — Frontend — 생성·수정을 server-first 흐름으로 전환한다.
  - 근거: 현재 로컬 상태가 서버 성공보다 먼저 바뀐다.
  - 파일: API client, lifecycle, controller
  - 검증: domain tests와 E2E 실패·재시도
- [ ] **T5 (P2, human: ~4h / Codex: ~40m)** — Frontend UX — 아이디 상태·debounce·접근성을 구현한다.
  - 근거: 사용자가 중복과 형식 오류를 제출 전에 알 수 없다.
  - 파일: availability hook, ConfirmScreen, styles
  - 검증: stale response·상태별 E2E
- [ ] **T6 (P1, human: ~4h / Codex: ~45m)** — Test — 실제 PostgreSQL 경쟁 테스트와 전체 회귀 테스트를 추가한다.
  - 근거: mock은 DB unique 경쟁과 rollback을 증명하지 못한다.
  - 파일: backend integration tests, Playwright
  - 검증: 전체 test commands
- [ ] **T7 (P2, human: ~1h / Codex: ~15m)** — Docs/operations — API 구조·배포·데이터 매핑 문서를 갱신한다.
  - 근거: migration은 운영 데이터 변경과 순서 의존성이 있다.
  - 파일: structure docs, migration report
  - 검증: 문서와 실제 route/migration head 대조

## 17. 검증 명령

이미 실행 중인 프로세스만 사용하고 새 프론트·백엔드 프로세스를 직접 시작하지 않는다.

```bash
npm run typecheck
npm run test:domain
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
```

Playwright는 이미 실행 중인 대상 URL이 있을 때 실행한다.

```bash
npm run test:e2e
```

DB migration은 현재 프로젝트의 승인된 환경 로딩 방식으로 실행한다.

```bash
backend/.venv/bin/alembic current
backend/.venv/bin/alembic upgrade 20260730_0009
```

운영 배포 전에는 실제 환경 변수를 출력하지 않고 버전과 결과만 기록한다.

## 18. 병렬화 전략

API 계약과 정규화 규칙을 먼저 고정한 뒤 두 개 lane으로 나눌 수 있다.

| 단계 | 모듈 | 의존 |
|---|---|---|
| 계약·정규화 | backend/core, backend/schemas | 없음 |
| DB·backend | backend/models, migrations, repositories, api | 계약·정규화 |
| frontend | frontend/domain, api, hooks, features | 계약·정규화 |
| 통합 테스트 | backend/tests, frontend/tests | DB·backend + frontend |
| 문서·배포 | documents | 통합 테스트 |

```text
공통 선행: 계약·정규화
              |
              +--> Lane A: DB migration -> backend repository -> API
              |
              +--> Lane B: frontend validation -> availability UX -> lifecycle
                              |
                              v
                     통합 테스트·문서
```

Lane A와 B는 공통 계약이 고정된 뒤 병렬 작업이 가능하다. `useAliveCharacterLifecycle.ts`와 E2E fixture는 프론트 lane 안에서 순차 작업한다.

## 19. NOT in scope

- 사용자 프로필 아이디 유니크 정책: 이번 범위는 캐릭터 아이디만 다룬다.
- 아이디 변경 이력·리다이렉트: 별도 alias 테이블이 필요하므로 후속 기능으로 둔다.
- 삭제 아이디 보존 기간: abuse 정책과 보존 테이블 설계가 필요하다.
- 공식 배지와 확장된 사칭 탐지: 초기 예약어 완전 일치 차단만 이번 범위에 포함한다.
- 추천 아이디 자동 생성: 중복 오류를 명확히 해결한 뒤 UX 개선으로 검토한다.
- Unicode·한글 아이디: 기존 ASCII 규칙을 유지한다.
- 오프라인 캐릭터 신규 생성: 서버 전역 유일성을 확인할 수 없어 지원하지 않는다.
- 전체 persistence 구조 개편: 캐릭터 create/edit만 전용 경로로 분리하고 나머지 자동 저장은 유지한다.
- 과거 게시물 본문·댓글 안의 텍스트 `@mention` 재작성: 현재 mention 관계 모델이 없으며 단순 문자열 변경은 위험하다.
- 새 cache·queue·분산 lock 도입: PostgreSQL unique constraint로 충분하다.

## 20. What already exists

| 기존 구현 | 재사용 방법 |
|---|---|
| `normalizeHandle()` | 서버 규칙과 맞춰 입력 정규화에 재사용 |
| `ConflictError`와 AppError handler | stable handle conflict error 형태에 재사용 |
| `Character`와 `source_account_id` | 새 식별자 체계를 만들지 않고 내부 계정 ID 유지 |
| `ProfileStateRepository` bulk upsert | 일반 캐릭터 상태 자동 저장 유지, handle만 권위 보호 |
| `SharedCharacterRepository` | 공유 snapshot 갱신 경로 유지 |
| `apiResult<T>()` | availability·PUT 오류 전달에 재사용 |
| `ConfirmScreen` | 새 별도 화면 없이 기존 확인 단계 확장 |
| `wakingRef` | 빠른 중복 submit 방지에 재사용 |
| `loadStructuredStateFallback()` | 마이그레이션 후 서버 handle을 local cache에 병합 |
| backend pytest·frontend domain test·Playwright | 신규 테스트를 기존 runner에 추가 |

새 인증 시스템, 별도 handle reservation 테이블, Redis lock, 신규 상태 관리 라이브러리는 만들지 않는다.

## 21. 위험과 rollback

| 위험 | 완화 |
|---|---|
| 기존 사용자의 handle이 조용히 변경됨 | 배포 전 매핑 검토, 변경 수 기록, 필요 시 별도 공지 |
| migration이 큰 테이블에서 lock을 오래 보유 | 사전 row count 측정, transaction 시간 확인, 저트래픽 배포 |
| 이전 앱이 handle 수정 불가 | 데이터 무결성 우선, 신규 앱 배포 후 모니터링 |
| shared/follower snapshot 일부 stale | transaction 갱신 + 배포 후 불일치 SQL |
| 신규 UI가 availability 장애로 막힘 | unknown 상태에서도 최종 PUT 허용 |
| rollback 후 원래 중복 문자열 필요 | 배포 전 CSV 보관 |

DB 제약 적용 후 문제가 발생하면 신규 프론트 배포를 중단하고 backend endpoint를 유지한 채 제약 제거 여부를 판단한다. 데이터 매핑을 되돌릴 때는 승인된 CSV를 사용하며 자동 추정으로 복원하지 않는다.

## 22. 완료 정의

- [x] 네 가지 정책 결정이 확정됐다.
- [ ] 운영 중복 매핑이 검토됐다.
- [ ] DB에 빈 handle과 중복 handle이 없다.
- [ ] DB unique/check constraint가 활성화됐다.
- [ ] 가용성 조회와 atomic PUT이 배포됐다.
- [ ] 신규·수정·경쟁·네트워크 실패 UI가 검증됐다.
- [ ] 이전 앱 구조화 저장 호환이 검증됐다.
- [ ] 공유·팔로워 snapshot 불일치가 0이다.
- [ ] 프론트 타입 검사와 domain/E2E 테스트가 통과했다.
- [ ] 백엔드 전체 테스트와 PostgreSQL 동시성 테스트가 통과했다.
- [ ] 구조 문서와 운영 보고서가 갱신됐다.

## 23. 참고 자료

- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL Index Uniqueness Checks](https://www.postgresql.org/docs/current/index-unique-checks.html)
- [SQLAlchemy Core Exceptions](https://docs.sqlalchemy.org/en/20/core/exceptions.html)
- [SQLAlchemy Constraints and Indexes](https://docs.sqlalchemy.org/en/20/core/constraints.html)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | 미실행 | 별도 CEO 리뷰 없이 사용자 승인으로 정책 확정 |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | 미실행 | 외부 모델 리뷰 없음 |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | REVIEW | DB 권위, server-first 저장, 레거시 호환, 전체 테스트 설계 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | 미실행 | 아이디 입력 상태의 시각 검토 필요 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | 미실행 | 신규 테스트 DB fixture 선택 미확정 |

- **UNRESOLVED:** 운영 DB의 실제 중복 매핑 확인
- **VERDICT:** 정책 확정 및 구현 승인 완료. 페이즈별 구현·테스트·커밋 진행
