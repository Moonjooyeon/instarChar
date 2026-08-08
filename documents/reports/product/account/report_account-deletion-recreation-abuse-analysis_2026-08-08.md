---
title: ALIVE 회원탈퇴·재가입 및 크레딧 악용 방지 분석
author: black (black@ashwoodfriends.com)
created: 2026-08-08
updated: 2026-08-08
version: 1.0.0
status: draft
---

# ALIVE 회원탈퇴·재가입 및 크레딧 악용 방지 분석

## 결과

현재 ALIVE는 회원탈퇴를 요청하면 **1주 유예 없이 즉시 계정을 하드 삭제**한다. 같은 Google·Apple·Toss 식별자로 다시 로그인하면 삭제된 기존 계정이 복구되는 것이 아니라 새로운 `user_id`로 새 계정이 생성된다. 따라서 현재 크레딧 시스템이 구현되지는 않았지만, 가입 보너스가 추가된 뒤에는 탈퇴와 재가입을 반복해 보너스를 다시 받는 악용 가능성이 있다.

추천 정책은 `7일 유예 상태 → 계정 잠금 및 보너스 지급 중지 → 7일 후 DB·S3 영구 삭제`다. 유예기간 동안에는 같은 로그인 식별자로 새 계정을 만들 수 없게 하고, 본인 재인증 시 기존 계정을 복구할 수 있게 한다. 완전 삭제 이후에도 재가입 보너스 중복을 막기 위한 최소한의 일방향 식별 해시를 보존할지는 개인정보처리방침과 함께 확정해야 한다.

## 1. 확인 범위

- 회원탈퇴 API와 서비스 실행 경로
- OAuth/Toss 재가입 시 사용자 식별 및 계정 생성 방식
- 사용자 소유 데이터의 DB cascade 삭제
- 공유 DM·신고·운영 기록의 예외 처리
- 프론트엔드 로컬 저장소 정리
- 계정 삭제 안내·개인정보처리방침의 현재 문구
- 크레딧 도입 이후 발생 가능한 보너스 중복 수령 경로

## 2. 현재 동작

### 2.1 탈퇴 처리

현재 흐름은 다음과 같다.

```text
사용자 확인
  -> DELETE /api/auth/account
  -> Apple 계정이면 저장된 토큰 revoke
  -> UserRepository.delete_account(user)
  -> User row 삭제 및 FK CASCADE
  -> DB commit
  -> 세션 쿠키 삭제
  -> 프론트 로컬 앱 상태 삭제 및 로그아웃
```

근거:

- `/Users/deemo/Desktop/instarChar/backend/app/api/v1/auth.py`의 `delete_account`
- `/Users/deemo/Desktop/instarChar/backend/app/services/account_deletion.py`의 `AccountDeletionService.delete`
- `/Users/deemo/Desktop/instarChar/backend/app/repositories/users.py`의 `delete_account`
- `/Users/deemo/Desktop/instarChar/apps/frontend/src/hooks/useAliveAuthActions.ts`의 `deleteAccount`

현재 코드에는 `deletion_requested_at`, `purge_at`, `pending_deletion`, `grace_period` 같은 유예 상태 필드나 상태 전이가 없다. 계정 삭제 안내 페이지도 앱 내 삭제가 즉시 처리된다고 안내한다.

### 2.2 재가입 처리

`UserRepository.get_or_create_provider_user`는 `(provider, provider_subject)`로 기존 사용자를 찾는다. 탈퇴 시 해당 `users` row가 삭제되므로, 같은 소셜 계정으로 다시 로그인하면 기존 사용자가 아닌 새 사용자 row가 생성된다.

현재 결과는 다음과 같다.

| 상황 | 현재 결과 |
| --- | --- |
| 탈퇴 후 같은 Google 계정 재로그인 | 새 `user_id` 생성 |
| 탈퇴 후 같은 Apple 계정 재로그인 | 새 `user_id` 생성; 기존 로컬 Apple credential은 revoke 대상 |
| 탈퇴 후 같은 Toss 사용자 재로그인 | 새 `user_id` 생성 |
| 기존 캐릭터·피드·DM 복구 | 복구되지 않음 |
| 탈퇴 후 보너스 재지급 방지 | 현재 방어 로직 없음 |

현재는 크레딧 계정과 보너스 원장이 없으므로 실제 보너스 무한 수령은 아직 발생하지 않는다. 그러나 가입 보너스 구현 시 지급 조건을 `user_id`만으로 검사하면 바로 악용될 수 있다.

## 3. 회원탈퇴 시 데이터 처리 범위

### 3.1 삭제되는 사용자 소유 데이터

`User` 삭제와 `ondelete="CASCADE"` 설정에 따라 다음 사용자 소유 데이터가 삭제되는 구조다.

- 사용자 계정과 프로필
- 캐릭터 설정, 갤러리, 피드, 팔로잉, 자동 게시 상태
- 사용자 페르소나
- 사용자가 소유한 공유 캐릭터 snapshot
- 사용자가 생성한 개인 DM thread
- 사용자의 팔로우·좋아요·차단·약관 동의 기록
- DB의 미디어 자산 row
- 사용자별 AI 일일 사용량
- native OAuth code와 Apple OAuth credential

캐릭터의 설정·게시글이 별도 테이블이 아니라 `characters.character`, `characters.posts` JSONB 안에 저장되어 있으므로, 캐릭터 row가 삭제되면 해당 데이터도 함께 사라진다.

### 3.2 삭제되지 않거나 별도 보존될 수 있는 데이터

| 데이터 | 현재 처리 |
| --- | --- |
| 다른 사용자가 참여한 공유 DM | 탈퇴 사용자 ID만 제거하고, 다른 참여자가 있으면 thread와 메시지 유지 |
| 참여자가 모두 탈퇴한 공유 DM | thread 삭제 |
| 다른 사용자가 작성한 신고·분쟁 자료 | reporter 삭제와 target owner 삭제가 별개라 운영·법적 보존 가능 |
| Apple account event audit row | 사용자 FK가 없어 별도 보존 가능 |
| 시스템 월간 AI 사용량 | 사용자별 row가 아니라 시스템 집계라 유지 |
| 브라우저 테마·도움말 완료 상태 | 계정 데이터가 아니므로 로컬에 남을 수 있음 |

공유 DM 유지 동작은 `/Users/deemo/Desktop/instarChar/backend/tests/test_account_deletion.py`의 `test_account_deletion_preserves_shared_dm_for_other_participants`로 의도적으로 검증되어 있다. 따라서 “탈퇴하면 서비스 안의 모든 흔적이 전부 삭제된다”라고 안내하면 현재 동작과 맞지 않는다.

### 3.3 S3 미디어 삭제 공백

현재 탈퇴 서비스는 DB의 `User`를 삭제하지만, 계정에 속한 각 `MediaAsset.storage_key`를 수집해 `MediaStorage.delete()`를 호출하지 않는다.

따라서 현재 코드만 기준으로 보면:

- DB의 미디어 asset row는 cascade 삭제됨
- S3 실제 object는 고아 데이터로 남을 가능성이 있음
- 법적 안내의 “업로드한 미디어 삭제”를 완전히 보장하지 못함

이 부분은 계정 삭제 전에 삭제 작업을 기록하는 outbox/job을 만들고, DB 삭제와 별도의 재시도 가능한 S3 정리 작업으로 보완해야 한다.

## 4. 현재 프론트엔드 로컬 데이터

탈퇴 API가 성공하면 프론트는 `signOut()`을 호출한다. 이 과정에서 다음을 처리한다.

- 서버 세션 쿠키 삭제
- Apps in Toss의 `alive_toss_session` 토큰 삭제
- `alive_app_state_v1` 로컬 캐릭터·앱 상태 삭제
- 메모리상의 runtime state 초기화

다만 테마, 도움말 완료 여부 등 계정과 무관한 로컬 환경 설정은 유지될 수 있다. 이는 계정 콘텐츠가 남는 문제와는 구분해야 한다.

## 5. 크레딧 악용 위험

### 5.1 가장 단순한 악용 경로

현재 BM 제안이 다음과 같다고 가정한다.

- 회원가입 300C
- 첫 캐릭터 생성 100C
- 첫 DM 완료 100C
- 총 500C

이때 다음 반복이 가능하다.

```text
가입 -> 300C 지급 -> 캐릭터 생성 -> 100C 지급 -> 첫 DM -> 100C 지급
  -> 탈퇴 즉시 삭제 -> 같은 로그인으로 재가입 -> 다시 보너스 지급
```

특히 지급 상태를 `user_id + event_code`로만 저장하면 탈퇴와 함께 지급 이력도 삭제되어 재가입 시 다시 지급된다.

### 5.2 추가 악용 가능성

- 첫 구매 추가 보너스의 반복 획득
- 이메일·소셜 제공자 변경을 통한 보너스 우회
- 무료 에너지 회복을 노린 계정 반복 생성
- 자동 DM·자동 게시글을 이용한 AI 비용 유발
- 결제 후 환불하고 크레딧을 유지하는 시나리오

## 6. 권장 탈퇴 정책

### 6.1 7일 유예 방식

| 시점 | 처리 |
| --- | --- |
| 탈퇴 요청 즉시 | 계정 상태를 `pending_deletion`으로 변경 |
| 탈퇴 요청 즉시 | 세션 revoke, 로그인·AI·결제·보너스 지급 차단 |
| 유예기간 7일 | 데이터는 비공개 보관, 재가입 계정 생성 금지 |
| 유예기간 내 재인증 | 삭제 취소 및 기존 계정 복구 가능 |
| 7일 경과 | DB 소유 데이터·S3 object 영구 삭제 |
| 영구 삭제 후 | 법적 보존 데이터와 최소 악용 방지 정보만 별도 기준으로 보존 |

유예기간은 사용자에게 “탈퇴 완료”라고 표현하기보다 “삭제 예약”으로 안내해야 한다. 유예기간 동안 다른 사용자는 해당 계정·캐릭터를 볼 수 없어야 한다.

### 6.2 즉시 삭제를 유지하는 대안

법적·제품 정책상 즉시 삭제를 유지한다면, 캐릭터·피드·DM은 즉시 삭제하되 보너스 악용 방지를 위해 다음 최소 정보만 별도 보관하는 방식을 검토할 수 있다.

- provider와 subject를 서버 비밀키로 HMAC한 일방향 fingerprint
- 보너스 지급 코드별 claim 상태
- 마지막 보너스 지급 시각
- 삭제 시각과 보존 만료 시각

이 정보는 계정 복구용이나 콘텐츠 복원용이 아니라 보너스 중복 지급 방지 전용으로 제한해야 하며, 개인정보처리방침에 보존 목적·기간·삭제 기준을 추가해야 한다.

### 6.3 추천안

ALIVE의 크레딧 BM에는 **7일 유예 방식**을 권장한다.

- 사용자는 실수로 탈퇴해도 복구 기회를 얻는다.
- 같은 소셜 식별자로 즉시 새 계정을 만들어 보너스를 반복 수령할 수 없다.
- 7일 후에는 캐릭터와 개인 콘텐츠를 실제로 영구 삭제할 수 있다.
- 유예기간을 계정 잠금으로 운영하면 별도 복구용 데이터 복제도 줄일 수 있다.

## 7. 필요한 수정사항

### P0 — 정책·법적 안내

- [ ] 즉시 하드 삭제와 7일 유예 중 최종 정책 결정
- [ ] “탈퇴”와 “삭제 예약”의 사용자 문구 확정
- [ ] 유예기간 중 복구 가능 여부와 본인 재인증 방법 정의
- [ ] 공유 DM·신고·분쟁 자료의 삭제·보존 범위 확정
- [ ] 구매 크레딧·가입 보너스·첫 구매 보너스의 탈퇴·환불 처리 확정
- [ ] 개인정보처리방침과 계정 삭제 안내의 처리 기간 문구 수정

### P1 — 계정 상태와 보너스 방어

- [ ] `User.account_status`: `active`, `pending_deletion`, `deleted` 설계
- [ ] `deletion_requested_at`, `purge_at` 저장
- [ ] 유예 중 AI·결제·보너스 지급 endpoint 차단
- [ ] 동일 provider subject의 신규 계정 생성을 pending 기간 동안 차단
- [ ] `RewardGrant`를 사용자 row와 분리하고 지급 event 중복 방지
- [ ] provider subject HMAC fingerprint 보존 여부와 보존 기간 구현
- [ ] 다중 계정·반복 가입에 대한 rate limit과 운영 알림 추가

### P1 — 미디어와 데이터 삭제

- [ ] 탈퇴 대상 MediaAsset의 storage key를 삭제 outbox에 기록
- [ ] S3 삭제 worker와 실패 재시도 구현
- [ ] DB row 삭제와 object 삭제의 최종 일치 여부를 점검하는 orphan scanner 추가
- [ ] 공유 DM에서 participant labels와 메시지 내 탈퇴 사용자 표시 정책 점검
- [ ] 삭제 완료 후 DB·S3·검색·캐시에서 남은 사용자 데이터를 확인하는 운영 명령 추가

### P2 — 프론트엔드

- [ ] 탈퇴 확인 모달을 “7일 후 영구 삭제” 정책에 맞게 수정
- [ ] 삭제 예약 완료 화면과 삭제 예정일 표시
- [ ] 유예기간 중 로그인 시 “계정 복구”와 “영구 삭제 계속” 선택 제공
- [ ] 삭제 실패 시 로컬 데이터를 지우지 않고 재시도 안내
- [ ] 복구·영구 삭제 후 로컬 상태와 토큰을 일관되게 초기화

## 8. 권장 데이터 구조

| 엔티티 | 핵심 필드 | 목적 |
| --- | --- | --- |
| `User` 확장 | `account_status`, `deletion_requested_at`, `purge_at` | 유예 상태와 접근 차단 |
| `AccountDeletionRequest` | `user_id`, `requested_at`, `purge_at`, `cancelled_at`, `status` | 삭제 예약 이력 |
| `RewardGrant` | `claim_key`, `reward_code`, `granted_at`, `revoked_at` | 가입·캐릭터·첫 DM 보너스 중복 방지 |
| `AbusePreventionSubject` | `identity_fingerprint`, `last_reward_at`, `retention_until` | 삭제 후 재가입 보너스 방어 |
| `MediaDeletionJob` | `asset_id`, `storage_key`, `status`, `attempts` | S3 삭제 재시도와 감사 |

## 9. 검증 결과

- 회원탈퇴 API·서비스·저장소 경로 확인: passed
- OAuth/Toss 재가입 시 새 사용자 생성 경로 확인: passed
- 사용자 소유 DB row의 cascade 설정 확인: passed
- 공유 DM 잔존 예외 테스트와 구현 확인: passed
- 계정 삭제 안내·개인정보처리방침의 즉시 삭제 문구 확인: passed
- 실제 DB cascade 통합 테스트: not run — 현재 `pytest` 명령을 실행할 수 없음
- 실제 S3 object 삭제 검증: not run — 연결된 S3 운영 환경이 필요함
- 실제 동일 계정 탈퇴 후 재가입 E2E: not run — 실행 중인 인증·백엔드 환경이 필요함

## 10. 검증하지 못한 것

- 실제 PostgreSQL에서 모든 FK cascade가 운영 마이그레이션과 일치하는지
- S3 lifecycle rule이나 별도 orphan cleanup 작업 존재 여부
- 각 OAuth 제공자가 계정 삭제 후 동일 subject 재인증을 허용하는 실제 환경 동작
- 결제 플랫폼의 환불·취소 이벤트와 계정 삭제의 상호작용
- 법적 보존 대상 데이터의 최종 보존 기간

## 11. 다음 추천 작업

1. 즉시 삭제와 7일 유예 중 제품·법무 정책을 확정한다.
2. 크레딧 개발 전에 `RewardGrant`와 삭제 상태를 먼저 설계한다.
3. 계정 삭제와 S3 삭제를 함께 검증하는 백엔드 통합 테스트를 추가한다.
4. 계정 삭제 안내·개인정보처리방침·탈퇴 모달을 동일한 정책 문구로 맞춘다.

## 성공 조건

- [ ] 같은 provider 계정으로 탈퇴·재가입해도 가입 보너스를 반복 수령하지 못한다.
- [ ] 유예기간 중 삭제 대상 계정이 AI·결제·보너스 endpoint를 사용할 수 없다.
- [ ] 유예기간 내 복구 시 기존 캐릭터·피드·DM이 복원된다.
- [ ] 유예기간 종료 후 사용자 소유 DB row와 S3 object가 모두 삭제된다.
- [ ] 공유 DM·신고·법적 보존 데이터의 예외가 사용자에게 고지된 정책과 일치한다.
- [ ] 계정 삭제 실패·부분 실패가 재시도 가능하고 운영 로그로 추적된다.
