---
title: 현재 데이터베이스 스키마 카탈로그
author: black (black@ashwoodfriends.com)
created: 2026-08-26
updated: 2026-08-26
version: 1.2.0
status: ready
---

# 현재 데이터베이스 스키마 카탈로그

## 문서 범위

- 기준 revision: Alembic `20260825_0033` 단일 head
- 기준 코드: `backend/app/models/entities.py`의 SQLAlchemy metadata
- 범위: 31개 테이블, 275개 컬럼, PK·FK·UNIQUE·CHECK·index·default
- 운영 대조: 2026-08-26 `alive` 운영 dump의 revision·테이블·컬럼·constraint·index와 비교 완료
- 제외: 실행 계획, index 사용률, table bloat

> 이 문서는 현재 코드가 기대하는 스키마를 설명한다. 2026-08-26 운영 dump와의 대조 결과는 [운영 데이터베이스 dump 및 무결성 감사](report_production-database-audit_2026-08-26.md)를 참고한다.

## 옵션 표기

| 표기 | 의미 |
|---|---|
| PK | 기본키. 복수 컬럼에 표시되면 복합 기본키 |
| FK | 외래키와 참조 대상. `ON DELETE` 동작을 함께 표기 |
| UNIQUE | 단일 컬럼 또는 테이블 단위 유일성 제약 |
| CHECK | DB가 직접 검사하는 값 범위·상태 제약 |
| 애플리케이션 기본값 | SQLAlchemy가 INSERT를 만들 때 적용하는 Python/SQL 기본값 |
| DB 기본값 | ORM metadata의 `server_default`. migration에만 남아 있는 기본값은 이 열에 나타나지 않을 수 있음 |
| ON UPDATE | SQLAlchemy UPDATE 문 생성 시 적용되는 값. PostgreSQL trigger를 의미하지 않음 |

## 테이블 구성 요약

| 도메인 | 테이블 수 | 테이블 |
|---|---:|---|
| 인증·계정·안전 | 9 | `users`, `profiles`, `apple_oauth_credentials`, `apple_account_events`, `native_oauth_codes`, `account_deletion_identities`, `user_policy_consents`, `user_blocks`, `content_reports` |
| 캐릭터·소셜·피드 | 7 | `characters`, `personas`, `shared_characters`, `character_follows`, `character_post_likes`, `public_feed_posts`, `feed_request_limits` |
| DM·미디어 | 3 | `dm_threads`, `shared_dm_threads`, `media_assets` |
| AI 사용량·크레딧 | 7 | `ai_daily_usage`, `ai_monthly_usage`, `credit_accounts`, `energy_accounts`, `credit_ledger_entries`, `reward_grants`, `credit_usages` |
| 스토어 결제 | 5 | `credit_purchases`, `google_play_accounts`, `google_play_rtdn_events`, `app_store_accounts`, `app_store_notification_events` |

# 인증·계정·안전

## `users`

OAuth 사용자 식별자와 계정, 제재, 세션, 탈퇴 상태를 관리하는 사용자 루트 테이블이다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `email` | OAuth provider에서 받은 사용자 email | `VARCHAR(320)` | 불허 | - | `-` | `-` |
| `provider` | 로그인에 사용한 OAuth provider(google·apple·toss) | `user_provider (google, apple, toss)` | 불허 | - | `-` | `-` |
| `provider_subject` | OAuth provider 내부 사용자 subject | `VARCHAR(255)` | 불허 | - | `-` | `-` |
| `moderation_status` | 사용자 제재 상태(활성·정지·차단) | `user_moderation_status (active, suspended, banned)` | 불허 | - | `<UserModerationStatus.active: 'active'>` | `-` |
| `account_status` | 계정의 활성·탈퇴 대기 lifecycle 상태 | `user_account_status (active, pending_deletion)` | 불허 | - | `<UserAccountStatus.active: 'active'>` | `-` |
| `session_version` | 기존 session을 일괄 무효화하는 세대 번호 | `INTEGER` | 불허 | - | `0` | `-` |
| `deletion_requested_at` | 사용자가 계정 삭제를 요청한 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `purge_at` | 계정 영구 삭제 예정 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `auth_revoked_at` | OAuth 또는 계정 알림으로 인증이 취소된 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_users_provider_subject` (`provider`, `provider_subject`)
- CHECK: 없음
- 보조 index: 없음

## `profiles`

사용자 표시명, onboarding 상태와 compact app state backup을 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | PK<br>FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `display_name` | 앱에서 표시하는 사용자 이름 | `VARCHAR(120)` | 불허 | - | `''` | `-` |
| `onboarded` | 최초 onboarding 완료 여부 | `BOOLEAN` | 불허 | - | `False` | `-` |
| `app_state` | 클라이언트 app state의 compact backup JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: 없음
- CHECK: 없음
- 보조 index: 없음

## `apple_oauth_credentials`

Apple OAuth token과 검증 상태를 암호화하여 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `client_id` | Apple OAuth client identifier | `VARCHAR(255)` | 불허 | - | `-` | `-` |
| `subject` | Apple 계정의 provider subject | `VARCHAR(255)` | 불허 | - | `-` | `-` |
| `refresh_token_encrypted` | 암호화해 저장한 Apple refresh token | `TEXT` | 불허 | - | `-` | `-` |
| `access_token_encrypted` | 암호화해 저장한 Apple access token | `TEXT` | 허용 | - | `-` | `-` |
| `access_token_expires_at` | Apple access token 만료 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `last_validated_at` | Apple credential을 마지막으로 검증한 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `email_forwarding_enabled` | Apple private relay email forwarding 상태 | `BOOLEAN` | 허용 | - | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_apple_oauth_credentials_user_client` (`user_id`, `client_id`)
- CHECK: 없음
- 보조 index: `ix_apple_oauth_credentials_subject_client` (`subject`, `client_id`)

## `apple_account_events`

Apple 계정 상태 알림의 중복 처리와 처리 결과를 기록한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `event_id` | Apple 알림을 식별하고 중복 처리를 막는 ID | `VARCHAR(255)` | 불허 | UNIQUE | `-` | `-` |
| `event_type` | Apple 계정 알림 종류 | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `subject` | Apple 계정의 provider subject | `VARCHAR(255)` | 불허 | - | `-` | `-` |
| `payload_hash` | Apple 알림 payload 무결성·중복 비교용 hash | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `status` | Apple 알림 처리 상태 | `VARCHAR(32)` | 불허 | - | `'pending'` | `-` |
| `processed_at` | 이벤트 처리가 완료된 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |

- 복합/명시적 UNIQUE: `(자동 이름)` (`event_id`)
- CHECK: 없음
- 보조 index: 없음

## `native_oauth_codes`

네이티브 OAuth 로그인의 단기 일회용 교환 code hash와 사용 상태를 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `code_hash` | 원문 대신 저장하는 일회용 교환 code hash | `VARCHAR(64)` | 불허 | UNIQUE | `-` | `-` |
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `expires_at` | 일회용 OAuth code 만료 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `-` |
| `used_at` | 일회용 OAuth code가 소비된 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `(자동 이름)` (`code_hash`)
- CHECK: 없음
- 보조 index: 없음

## `account_deletion_identities`

탈퇴 후 재가입 제한을 위해 provider 식별자의 fingerprint와 보존 기한을 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `provider` | 보존된 식별자가 속한 OAuth provider | `user_provider (google, apple, toss)` | 불허 | - | `-` | `-` |
| `identity_fingerprint` | 재가입 제한 비교에 사용하는 provider 식별자 fingerprint | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `user_id` | 탈퇴 전 사용자 ID이며 사용자 삭제 후에는 NULL | `UUID` | 허용 | FK → `users.id`; ON DELETE SET NULL | `-` | `-` |
| `retention_until` | 법적·운영 정책상 row 보존 만료 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_account_deletion_identities_provider_fingerprint` (`provider`, `identity_fingerprint`)
- CHECK: 없음
- 보조 index: `ix_account_deletion_identities_retention` (`retention_until`)

## `user_policy_consents`

사용자별 약관·안전정책 version 동의 이력을 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `terms_version` | 동의한 약관·안전정책 version | `VARCHAR(32)` | 불허 | - | `-` | `-` |
| `accepted_at` | 해당 약관 version에 동의한 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_user_policy_consents_version` (`user_id`, `terms_version`)
- CHECK: 없음
- 보조 index: 없음

## `user_blocks`

사용자 간 차단 관계를 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `blocker_id` | 차단을 설정한 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `blocked_id` | 차단당한 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_user_blocks_pair` (`blocker_id`, `blocked_id`)
- CHECK: 없음
- 보조 index: `ix_user_blocks_blocked_blocker` (`blocked_id`, `blocker_id`)

## `content_reports`

사용자 신고 대상, 사유, snapshot과 운영자 처리 결과를 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `reporter_id` | 신고를 제출한 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `target_type` | 신고 대상 종류(캐릭터·게시글·댓글·DM 등) | `VARCHAR(32)` | 불허 | - | `-` | `-` |
| `target_owner_id` | 신고 대상 콘텐츠 소유자 ID snapshot | `UUID` | 허용 | - | `-` | `-` |
| `target_reference` | 신고 대상을 다시 찾기 위한 문자열 reference | `VARCHAR(500)` | 불허 | - | `-` | `-` |
| `reason` | 사용자가 선택한 신고 사유 코드 | `VARCHAR(32)` | 불허 | - | `-` | `-` |
| `detail` | 사용자가 입력한 신고 상세 설명 | `TEXT` | 불허 | - | `''` | `-` |
| `snapshot` | 신고 당시 대상 콘텐츠 snapshot JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `status` | 신고 검토 상태(pending·reviewing·resolved·dismissed) | `report_status (pending, reviewing, resolved, dismissed)` | 불허 | - | `<ReportStatus.pending: 'pending'>` | `-` |
| `resolution_action` | 운영자가 선택한 신고 조치 코드 | `VARCHAR(32)` | 불허 | - | `'none'` | `-` |
| `moderator_note` | 운영자가 남긴 신고 처리 메모 | `TEXT` | 불허 | - | `''` | `-` |
| `resolved_by` | 신고를 처리한 운영자 식별자 | `VARCHAR(120)` | 불허 | - | `''` | `-` |
| `resolved_at` | 신고 처리를 완료한 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: 없음
- CHECK: 없음
- 보조 index: `ix_content_reports_status_created` (`status`, `created_at`)

# 캐릭터·소셜·피드

## `characters`

사용자 소유 캐릭터의 설정, 게시글, 공개성, 자동 게시 상태를 저장하는 권위 테이블이다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `owner_id` | 해당 자원을 소유한 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `source_account_id` | 클라이언트 캐릭터 계정 식별자 | `VARCHAR(120)` | 불허 | - | `-` | `-` |
| `name` | 도메인 객체의 표시 이름 | `VARCHAR(120)` | 불허 | - | `''` | `-` |
| `handle` | 사용자에게 노출되는 캐릭터 고유 handle | `VARCHAR(24)` | 불허 | - | `-` | `-` |
| `character` | 성격·말투·세계관·관계 등 캐릭터 원본 설정 JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `gallery` | 캐릭터 gallery media reference 배열 JSON | `JSONB` | 불허 | - | `list()` | `-` |
| `posts` | 캐릭터의 권위 게시글 배열 JSON | `JSONB` | 불허 | - | `list()` | `-` |
| `posts_revision` | 게시글 낙관적 동시성 제어 revision | `INTEGER` | 불허 | - | `0` | `-` |
| `following` | 클라이언트 호환용 following snapshot JSON | `JSONB` | 불허 | - | `list()` | `-` |
| `is_public` | 캐릭터와 게시글의 공개 피드 노출 여부 | `BOOLEAN` | 불허 | - | `True` | `-` |
| `auto_post_enabled` | 자동 게시 기능 활성 여부 | `BOOLEAN` | 불허 | - | `True` | `-` |
| `auto_post_interval_seconds` | 자동 게시 실행 간격(초) | `INTEGER` | 불허 | - | `21600` | `-` |
| `next_auto_post_at` | 다음 자동 게시 예정 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `default_next_auto_post_at()` | `-` |
| `auto_post_claimed_at` | worker가 자동 게시 작업을 선점한 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `auto_post_legacy_credit_stop_recovered` | 과거 크레딧 부족 중지 row의 복구 처리 여부 | `BOOLEAN` | 불허 | - | `False` | `-` |
| `last_auto_post_at` | 마지막 자동 게시 성공 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `last_auto_post_error` | 마지막 자동 게시 실패 code 또는 메시지 | `TEXT` | 불허 | - | `''` | `-` |
| `auto_post_failure_count` | 연속 자동 게시 실패 횟수 | `INTEGER` | 불허 | - | `0` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_characters_handle` (`handle`); `uq_characters_owner_source` (`owner_id`, `source_account_id`)
- CHECK: `ck_characters_handle_format`: `handle ~ '^[a-z0-9]([a-z0-9._-]{0,22}[a-z0-9])?$'`; `ck_characters_handle_reserved`: `handle NOT IN ('admin', 'administrator', 'alive', 'help', 'mod', 'moderator', 'official', 'staff', 'support', 'system')`
- 보조 index: 없음

## `personas`

사용자 persona 설정을 owner와 persona ID 조합으로 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `owner_id` | 해당 자원을 소유한 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `persona_id` | 클라이언트가 부여한 persona 식별자 | `VARCHAR(120)` | 불허 | - | `-` | `-` |
| `name` | 도메인 객체의 표시 이름 | `VARCHAR(120)` | 불허 | - | `''` | `-` |
| `persona` | 사용자 persona 상세 설정 JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_personas_owner_persona` (`owner_id`, `persona_id`)
- CHECK: 없음
- 보조 index: 없음

## `shared_characters`

탐색·공유에 노출되는 캐릭터 snapshot과 검색 tag를 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `owner_id` | 해당 자원을 소유한 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `owner_name` | 공유 snapshot에 저장된 소유자 표시 이름 | `VARCHAR(120)` | 불허 | - | `''` | `-` |
| `source_account_id` | 클라이언트 캐릭터 계정 식별자 | `VARCHAR(120)` | 불허 | - | `-` | `-` |
| `name` | 도메인 객체의 표시 이름 | `VARCHAR(120)` | 불허 | - | `-` | `-` |
| `handle` | 사용자에게 노출되는 캐릭터 고유 handle | `VARCHAR(120)` | 불허 | - | `''` | `-` |
| `persona` | 탐색 카드에 노출하는 persona 요약문 | `TEXT` | 불허 | - | `''` | `-` |
| `tags` | 탐색·추천 검색에 사용하는 tag 배열 | `TEXT[]` | 불허 | - | `list()` | `-` |
| `character` | 탐색·공유 응답에 사용하는 캐릭터 snapshot JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_shared_characters_owner_source` (`owner_id`, `source_account_id`)
- CHECK: 없음
- 보조 index: `ix_shared_characters_tags_gin` (`tags`); USING GIN

## `character_follows`

사용자 소유 캐릭터가 공유 캐릭터를 팔로우하는 관계와 follower snapshot을 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `follower_id` | 팔로우를 수행한 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `follower_name` | 팔로우를 수행한 캐릭터 표시 이름 snapshot | `VARCHAR(120)` | 불허 | - | `''` | `-` |
| `follower_account_id` | 팔로우를 수행한 소유 캐릭터의 source account ID | `VARCHAR(120)` | 불허 | - | `-` | `-` |
| `follower_character` | 팔로우 시점의 follower 캐릭터 snapshot JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `target_shared_character_id` | 팔로우 대상 공유 캐릭터 ID | `UUID` | 불허 | FK → `shared_characters.id`; ON DELETE CASCADE | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_character_follows` (`follower_id`, `follower_account_id`, `target_shared_character_id`)
- CHECK: 없음
- 보조 index: `ix_character_follows_follower_recent` (`follower_id`, `follower_account_id`, `created_at`, `id`, `target_shared_character_id`); `ix_character_follows_target_created` (`target_shared_character_id`, `created_at`)

## `character_post_likes`

소유 캐릭터가 다른 캐릭터 게시글에 표시한 좋아요를 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `liker_owner_id` | 좋아요를 누른 캐릭터 소유자 ID | `UUID` | 불허 | FK → `characters.owner_id`; ON DELETE CASCADE | `-` | `-` |
| `liker_account_id` | 좋아요를 누른 소유 캐릭터의 source account ID | `VARCHAR(120)` | 불허 | FK → `characters.source_account_id`; ON DELETE CASCADE | `-` | `-` |
| `target_character_id` | 좋아요 대상 게시글 작성 캐릭터 ID | `UUID` | 불허 | FK → `characters.id`; ON DELETE CASCADE | `-` | `-` |
| `target_post_id` | 좋아요 대상 게시글 ID | `VARCHAR(120)` | 불허 | - | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_character_post_likes` (`liker_owner_id`, `liker_account_id`, `target_character_id`, `target_post_id`)
- CHECK: 없음
- 보조 index: `ix_character_post_likes_liker_recent` (`liker_owner_id`, `liker_account_id`, `created_at`, `id`, `target_character_id`); `ix_character_post_likes_target` (`target_character_id`, `target_post_id`)

## `public_feed_posts`

characters.posts JSONB에서 공개 피드 조회에 필요한 게시글을 투영한 읽기 모델이다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `author_character_id` | 게시글을 작성한 캐릭터 ID | `UUID` | 불허 | PK<br>FK → `characters.id`; ON DELETE CASCADE | `-` | `-` |
| `post_id` | 캐릭터 내부 게시글 식별자 | `VARCHAR(120)` | 불허 | PK | `-` | `-` |
| `created_at` | 원본 게시글의 작성 시각이자 피드 cursor 정렬 기준 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `-` |
| `payload` | 공개 피드 카드 렌더링용 게시글 JSON | `JSONB` | 불허 | - | `dict()` | `-` |

- 복합/명시적 UNIQUE: 없음
- CHECK: 없음
- 보조 index: `ix_public_feed_posts_author_created` (`author_character_id`, `created_at`, `post_id`); `ix_public_feed_posts_cursor` (`created_at`, `post_id`, `author_character_id`)

## `feed_request_limits`

사용자별 피드 요청 횟수와 rate-limit window 시작 시각을 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `user_id` | rate limit을 적용받는 사용자 ID | `UUID` | 불허 | PK<br>FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `request_count` | 현재 window에서 발생한 피드 요청 횟수 | `INTEGER` | 불허 | - | `0` | `-` |
| `window_started_at` | 피드 rate-limit window 시작 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `-` |

- 복합/명시적 UNIQUE: 없음
- CHECK: 없음
- 보조 index: 없음

# DM·미디어

## `dm_threads`

사용자 소유 로컬 DM thread의 메시지와 세계관 설정을 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `owner_id` | 해당 자원을 소유한 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `thread_key` | 클라이언트와 서버가 공유하는 DM thread 고유 key | `VARCHAR(500)` | 불허 | - | `-` | `-` |
| `messages` | DM 메시지 배열 JSON | `JSONB` | 불허 | - | `list()` | `-` |
| `world_pref` | DM에 적용할 세계관 preference JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_dm_threads_owner_key` (`owner_id`, `thread_key`)
- CHECK: 없음
- 보조 index: 없음

## `shared_dm_threads`

여러 사용자가 참여하는 공유 DM의 참여자 배열, 메시지, 세계관 설정을 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `thread_key` | 클라이언트와 서버가 공유하는 DM thread 고유 key | `VARCHAR(500)` | 불허 | UNIQUE | `-` | `-` |
| `participant_user_ids` | 공유 DM에 접근할 수 있는 사용자 ID 배열 | `UUID[]` | 불허 | - | `list()` | `-` |
| `participant_labels` | 참여자 ID 순서에 대응하는 공유 DM 표시 label 배열 | `TEXT[]` | 불허 | - | `list()` | `-` |
| `messages` | DM 메시지 배열 JSON | `JSONB` | 불허 | - | `list()` | `-` |
| `world_pref` | DM에 적용할 세계관 preference JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `created_by` | 공유 DM thread를 생성한 사용자 ID | `UUID` | 허용 | FK → `users.id`; ON DELETE SET NULL | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `(자동 이름)` (`thread_key`)
- CHECK: 없음
- 보조 index: 없음

## `media_assets`

업로드 이미지의 소유권, 목적, 공개 범위, 검증 상태와 저장소 key를 관리한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `owner_id` | 해당 자원을 소유한 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `source_account_id` | 클라이언트 캐릭터 계정 식별자 | `VARCHAR(120)` | 허용 | - | `-` | `-` |
| `purpose` | media 사용 목적(avatar·gallery·post·DM 등) | `media_purpose (profile_avatar, profile_header, gallery, feed_post, dm_attachment)` | 불허 | - | `-` | `-` |
| `visibility` | media 공개 범위(공개 또는 비공개) | `media_visibility (public, private)` | 불허 | - | `-` | `-` |
| `status` | media 검증·사용 lifecycle 상태 | `media_status (pending, ready, rejected, deleted)` | 불허 | - | `<MediaStatus.pending: 'pending'>` | `-` |
| `storage_key` | S3 object를 가리키는 서버 소유 저장소 key | `VARCHAR(512)` | 불허 | - | `-` | `-` |
| `content_type` | 검증된 media MIME type | `VARCHAR(120)` | 불허 | - | `-` | `-` |
| `byte_size` | 업로드 객체의 byte 크기 | `INTEGER` | 불허 | - | `-` | `-` |
| `sha256` | 업로드 객체 내용의 SHA-256 checksum | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `width` | 검증된 이미지 가로 pixel 크기 | `INTEGER` | 허용 | - | `-` | `-` |
| `height` | 검증된 이미지 세로 pixel 크기 | `INTEGER` | 허용 | - | `-` | `-` |
| `deleted_at` | media 자산이 논리 삭제된 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_media_assets_storage_key` (`storage_key`)
- CHECK: 없음
- 보조 index: `ix_media_assets_owner_status` (`owner_id`, `status`)

# AI 사용량·크레딧

## `ai_daily_usage`

사용자별 일간 AI 호출 수와 추정·실제 비용을 집계한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `owner_id` | 해당 자원을 소유한 사용자 ID | `UUID` | 불허 | PK<br>FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `usage_date` | 사용자별 AI 사용량 집계 날짜 | `DATE` | 불허 | PK | `-` | `-` |
| `call_count` | 집계 기간의 AI 호출 횟수 | `INTEGER` | 불허 | - | `0` | `-` |
| `estimated_cost_usd` | 정책상 단가로 계산한 추정 비용(USD) | `NUMERIC(12, 6)` | 불허 | - | `0` | `-` |
| `actual_cost_usd` | provider 사용량으로 계산한 실제 비용(USD) | `NUMERIC(14, 8)` | 불허 | - | `0` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: 없음
- CHECK: 없음
- 보조 index: 없음

## `ai_monthly_usage`

시스템 전체의 월별 AI 호출 수와 추정·실제 비용을 집계한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `usage_month` | 시스템 AI 사용량 집계 월(YYYY-MM) | `VARCHAR(7)` | 불허 | PK | `-` | `-` |
| `call_count` | 집계 기간의 AI 호출 횟수 | `INTEGER` | 불허 | - | `0` | `-` |
| `estimated_cost_usd` | 정책상 단가로 계산한 추정 비용(USD) | `NUMERIC(12, 6)` | 불허 | - | `0` | `-` |
| `actual_cost_usd` | provider 사용량으로 계산한 실제 비용(USD) | `NUMERIC(14, 8)` | 불허 | - | `0` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: 없음
- CHECK: 없음
- 보조 index: 없음

## `credit_accounts`

사용자별 구매·보너스 크레딧 잔액, 환불 부채와 낙관적 version을 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | PK<br>FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `purchased_credits` | 구매 잔액 또는 요청에 사용된 구매 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `bonus_credits` | 보너스 잔액 또는 요청에 사용된 보너스 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `debt_credits` | 환불 시 잔액 부족으로 남은 회수 대상 부채 | `INTEGER` | 불허 | - | `0` | `-` |
| `version` | 잔액 갱신의 낙관적 동시성 제어 version | `INTEGER` | 불허 | - | `0` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: 없음
- CHECK: `ck_credit_accounts_bonus_nonnegative`: `bonus_credits >= 0`; `ck_credit_accounts_debt_nonnegative`: `debt_credits >= 0`; `ck_credit_accounts_purchased_nonnegative`: `purchased_credits >= 0`; `ck_credit_accounts_version_nonnegative`: `version >= 0`
- 보조 index: 없음

## `energy_accounts`

사용자별 에너지 잔량과 마지막 회복 시각을 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | PK<br>FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `energy_percent` | 현재 에너지 잔량(0~100) | `INTEGER` | 불허 | - | `100` | `-` |
| `last_recovered_at` | 에너지를 마지막으로 회복 계산한 기준 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: 없음
- CHECK: `ck_energy_accounts_percent`: `energy_percent BETWEEN 0 AND 100`
- 보조 index: 없음

## `credit_ledger_entries`

크레딧 증감 내역을 불변 원장 형태로 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `entry_type` | 원장 변동 유형(지급·차감·환불·구매 등) | `VARCHAR(32)` | 불허 | - | `-` | `-` |
| `balance_type` | 증감 대상 잔액 종류(보너스 또는 구매) | `VARCHAR(16)` | 불허 | - | `-` | `-` |
| `amount` | 해당 원장 항목의 증감 크레딧 수량 | `INTEGER` | 불허 | - | `-` | `-` |
| `idempotency_key` | 동일 작업의 중복 반영을 막는 멱등성 key | `VARCHAR(180)` | 불허 | - | `-` | `-` |
| `metadata` | 원장 발생 원인과 provider 정보를 담는 JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_credit_ledger_user_idempotency` (`user_id`, `idempotency_key`)
- CHECK: `ck_credit_ledger_amount_nonzero`: `amount <> 0`; `ck_credit_ledger_balance_type`: `balance_type IN ('bonus', 'purchased')`; `ck_credit_ledger_entry_type`: `entry_type IN ('grant', 'debit', 'refund', 'purchase', 'adjustment', 'chargeback')`
- 보조 index: `ix_credit_ledger_user_created` (`user_id`, `created_at`)

## `reward_grants`

이벤트별 보너스 크레딧 지급을 사용자당 한 번으로 제한하고 기록한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `event_code` | 보상 지급 원인이 되는 고유 이벤트 코드 | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `credits` | 이벤트로 지급한 보너스 크레딧 | `INTEGER` | 불허 | - | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_reward_grants_user_event` (`user_id`, `event_code`)
- CHECK: `ck_reward_grants_credits_positive`: `credits > 0`
- 보조 index: 없음

## `credit_usages`

AI 요청 단위의 크레딧 예약·확정·환불과 provider 비용·응답 metadata를 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `flow` | 크레딧을 사용한 AI 기능 흐름 | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `policy_version` | 크레딧 차감에 적용한 정책 version | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `prompt_version` | AI 생성에 적용한 prompt 정책 version | `VARCHAR(64)` | 불허 | - | `''` | `-` |
| `model` | AI 요청에 실제 사용한 model identifier | `VARCHAR(64)` | 불허 | - | `''` | `-` |
| `status` | 크레딧 사용 상태(reserved·committed·refunded) | `VARCHAR(16)` | 불허 | - | `'reserved'` | `-` |
| `credits` | 해당 AI 요청에 사용한 총 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `energy_percent` | 해당 AI 요청에 사용한 에너지 비율 | `INTEGER` | 불허 | - | `0` | `-` |
| `bonus_credits` | 보너스 잔액 또는 요청에 사용된 보너스 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `purchased_credits` | 구매 잔액 또는 요청에 사용된 구매 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `idempotency_key` | 동일 작업의 중복 반영을 막는 멱등성 key | `VARCHAR(180)` | 불허 | - | `-` | `-` |
| `provider_status` | 외부 provider가 반환한 원본 상태 | `VARCHAR(32)` | 불허 | - | `''` | `-` |
| `provider_attempts` | 외부 AI provider 호출 시도 횟수 | `INTEGER` | 불허 | - | `0` | `-` |
| `input_tokens` | provider가 보고한 입력 token 수 | `INTEGER` | 불허 | - | `0` | `-` |
| `output_tokens` | provider가 보고한 출력 token 수 | `INTEGER` | 불허 | - | `0` | `-` |
| `thought_tokens` | provider가 보고한 reasoning token 수 | `INTEGER` | 불허 | - | `0` | `-` |
| `total_tokens` | provider가 보고한 전체 token 수 | `INTEGER` | 불허 | - | `0` | `-` |
| `usage_metadata_complete` | provider token·비용 metadata가 완전한지 여부 | `BOOLEAN` | 불허 | - | `False` | `-` |
| `reserved_cost_usd` | 요청 전에 보수적으로 예약한 최대 비용(USD) | `NUMERIC(14, 8)` | 불허 | - | `0` | `-` |
| `provider_cost_usd` | provider 사용량으로 계산한 요청 실제 비용(USD) | `NUMERIC(14, 8)` | 불허 | - | `0` | `-` |
| `response_body` | 재시도·멱등 응답에 사용하는 AI 결과 JSON | `JSONB` | 불허 | - | `dict()` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_credit_usages_user_idempotency` (`user_id`, `idempotency_key`)
- CHECK: `ck_credit_usages_bonus_nonnegative`: `bonus_credits >= 0`; `ck_credit_usages_credits_nonnegative`: `credits >= 0`; `ck_credit_usages_energy_nonnegative`: `energy_percent >= 0`; `ck_credit_usages_provider_costs`: `reserved_cost_usd >= 0 AND provider_cost_usd >= 0`; `ck_credit_usages_provider_counts`: `provider_attempts >= 0 AND input_tokens >= 0 AND output_tokens >= 0 AND thought_tokens >= 0 AND total_tokens >= 0`; `ck_credit_usages_purchased_nonnegative`: `purchased_credits >= 0`; `ck_credit_usages_single_payment_kind`: `energy_percent = 0 OR credits = 0`; `ck_credit_usages_source_total`: `credits = bonus_credits + purchased_credits`; `ck_credit_usages_status`: `status IN ('reserved', 'committed', 'refunded')`
- 보조 index: `ix_credit_usages_user_created` (`user_id`, `created_at`)

# 스토어 결제

## `credit_purchases`

스토어별 구매 검증, 지급, 환불, 보존 및 결제 감사 정보를 통합 저장한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `user_id` | 구매자 ID이며 탈퇴 후 법적 보존 중에는 NULL | `UUID` | 허용 | FK → `users.id`; ON DELETE SET NULL | `-` | `-` |
| `provider` | 구매를 처리한 스토어 provider | `VARCHAR(32)` | 불허 | - | `'apps_in_toss'` | `-` |
| `provider_order_id` | 스토어가 발급한 주문·transaction 식별자 | `VARCHAR(512)` | 불허 | - | `-` | `-` |
| `ledger_reference` | provider 간 주문 ID 충돌을 피하는 원장 참조 key | `VARCHAR(96)` | 불허 | - | `''` | `-` |
| `provider_subject_hash` | 결제 계정 subject의 비가역 hash | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `retention_until` | 법적·운영 정책상 row 보존 만료 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `sku` | 구매한 상품 SKU 또는 product ID | `VARCHAR(255)` | 불허 | - | `-` | `-` |
| `status` | 구매 처리 상태(processing·granted·refunded·failed·review) | `VARCHAR(32)` | 불허 | - | `'processing'` | `-` |
| `provider_status` | 외부 provider가 반환한 원본 상태 | `VARCHAR(32)` | 불허 | - | `''` | `-` |
| `price_krw` | 상품의 기준 원화 가격 | `INTEGER` | 불허 | - | `0` | `-` |
| `provider_currency` | 스토어가 보고한 ISO 4217 통화 코드 | `VARCHAR(3)` | 불허 | - | `''` | `-` |
| `provider_storefront` | App Store storefront 국가 코드 | `VARCHAR(3)` | 불허 | - | `''` | `-` |
| `provider_price_milliunits` | 스토어 결제 금액의 통화 1/1000 단위 값 | `INTEGER` | 불허 | - | `0` | `-` |
| `base_credits` | 상품 구매 시 지급하는 기본 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `product_bonus_credits` | 상품 구성에 포함된 추가 보너스 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `first_purchase_bonus_credits` | 첫 구매 조건으로 추가 지급한 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `granted_credits` | 구매 처리로 최종 지급한 총 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `chargeback_credits` | 환불·차지백으로 회수한 크레딧 | `INTEGER` | 불허 | - | `0` | `-` |
| `failure_reason` | 실패 또는 검토 상태의 사유 | `VARCHAR(255)` | 불허 | - | `''` | `-` |
| `provider_checked_at` | 구매 상태를 provider에서 마지막 확인한 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `provider_consumed_at` | Google Play 구매 consume 완료 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `granted_at` | 구매 크레딧 지급 완료 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `refunded_at` | 구매 환불 처리 완료 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `updated_at` | row가 마지막으로 갱신된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | ON UPDATE now() | `-` | `now()` |

- 복합/명시적 UNIQUE: `uq_credit_purchases_provider_order` (`provider`, `provider_order_id`)
- CHECK: `ck_credit_purchases_credit_amounts`: `base_credits >= 0 AND product_bonus_credits >= 0 AND first_purchase_bonus_credits >= 0 AND granted_credits >= 0 AND chargeback_credits >= 0`; `ck_credit_purchases_status`: `status IN ('processing', 'granted', 'refunded', 'failed', 'review')`
- 보조 index: `ix_credit_purchases_retention` (`retention_until`); `ix_credit_purchases_status_checked` (`status`, `provider_checked_at`); `ix_credit_purchases_subject_granted` (`provider_subject_hash`, `granted_credits`); `ix_credit_purchases_user_created` (`user_id`, `created_at`)

## `google_play_accounts`

사용자와 Google Play obfuscated account ID를 연결한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `account_id` | Google Play에 전달하는 난독화 계정 식별자 | `VARCHAR(64)` | 불허 | UNIQUE | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `(자동 이름)` (`account_id`)
- CHECK: 없음
- 보조 index: 없음

## `google_play_rtdn_events`

Google Play RTDN 메시지의 중복 처리 방지, claim, 처리 결과를 기록한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `message_id` | Google RTDN Pub/Sub 메시지 ID이자 중복 방지 key | `VARCHAR(255)` | 불허 | UNIQUE | `-` | `-` |
| `notification_type` | 스토어 서버 알림 종류 | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `purchase_token` | Google Play purchase token | `VARCHAR(512)` | 불허 | - | `''` | `-` |
| `status` | Google Play RTDN 처리 상태 | `VARCHAR(32)` | 불허 | - | `'processing'` | `-` |
| `failure_reason` | 실패 또는 검토 상태의 사유 | `VARCHAR(255)` | 불허 | - | `''` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `claimed_at` | 이벤트 처리를 선점한 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `processed_at` | 이벤트 처리가 완료된 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |

- 복합/명시적 UNIQUE: `(자동 이름)` (`message_id`)
- CHECK: 없음
- 보조 index: `ix_google_play_rtdn_events_status_created` (`status`, `created_at`)

## `app_store_accounts`

사용자와 App Store appAccountToken을 1:1로 연결한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `user_id` | 연결된 사용자 ID | `UUID` | 불허 | FK → `users.id`; ON DELETE CASCADE | `-` | `-` |
| `account_token` | App Store appAccountToken으로 사용하는 UUID | `UUID` | 불허 | UNIQUE | `-` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |

- 복합/명시적 UNIQUE: `(자동 이름)` (`account_token`); `uq_app_store_accounts_user_id` (`user_id`)
- CHECK: 없음
- 보조 index: 없음

## `app_store_notification_events`

App Store Server Notification의 중복 처리 방지, claim, 처리 결과를 기록한다.

| 컬럼 | 역할 | 타입 | NULL | 옵션 | 애플리케이션 기본값 | DB 기본값 |
|---|---|---|---|---|---|---|
| `id` | row를 식별하는 UUID | `UUID` | 불허 | PK | `uuid4()` | `-` |
| `notification_uuid` | App Store 알림 UUID이자 중복 방지 key | `VARCHAR(255)` | 불허 | UNIQUE | `-` | `-` |
| `notification_type` | 스토어 서버 알림 종류 | `VARCHAR(64)` | 불허 | - | `-` | `-` |
| `transaction_id` | App Store transaction identifier | `VARCHAR(512)` | 불허 | - | `''` | `-` |
| `status` | App Store Server Notification 처리 상태 | `VARCHAR(32)` | 불허 | - | `'processing'` | `-` |
| `failure_reason` | 실패 또는 검토 상태의 사유 | `VARCHAR(255)` | 불허 | - | `''` | `-` |
| `created_at` | row가 생성된 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `claimed_at` | 이벤트 처리를 선점한 시각 | `TIMESTAMP WITH TIME ZONE` | 불허 | - | `-` | `now()` |
| `processed_at` | 이벤트 처리가 완료된 시각 | `TIMESTAMP WITH TIME ZONE` | 허용 | - | `-` | `-` |

- 복합/명시적 UNIQUE: `(자동 이름)` (`notification_uuid`)
- CHECK: 없음
- 보조 index: `ix_app_store_notification_events_status_created` (`status`, `created_at`)

# 관련 소스

- `backend/app/models/entities.py`: ORM table·column·constraint·index 정의
- `backend/migrations/versions/`: Alembic schema 변경 이력
- `backend/migrations/env.py`: ORM metadata와 migration runner 연결
- `docker-compose.prod.yml`: 배포 전 `alembic upgrade head` 실행

# 검증 상태

- SQLAlchemy metadata import 및 전체 table 순회: 통과
- 테이블/컬럼 수 집계: 31개/275개
- Alembic head 확인: `20260825_0033`
- 실제 운영 DB dump 대조: 통과 — revision, 31개 테이블, 컬럼 집합, 명시적 constraint와 index 일치
