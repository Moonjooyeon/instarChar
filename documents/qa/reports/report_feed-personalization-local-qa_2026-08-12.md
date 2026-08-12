---
title: 추천 피드 개인화 로컬 QA
author: Codex
created: 2026-08-12
updated: 2026-08-12
version: 1.3.0
status: partial
---

# 추천 피드 개인화 로컬 QA

## 사용자 계약

- 추천은 현재 캐릭터 설정과 팔로우·좋아요 성향을 반영한다.
- 자기 자신, 이미 팔로우한 캐릭터, 차단 관계, 비공개·운영정지 계정은 추천에서 제외한다.
- 동일 작성자의 게시글이 한 추천 페이지를 과도하게 점유하지 않는다.
- 팔로잉과 추천 탭에는 지연 로드된 배열 길이를 숫자로 표시하지 않는다.
- 추천과 팔로잉 탭 전환, 빈 상태, 추천 사유, 커서 추가 로드가 기존 기능을 깨지 않는다.

## 환경

- 브랜치: `main`
- 로컬 백엔드: 실행 중인 `instarchat-local-backend`, 작업 디렉터리 마운트와 자동 재로드
- 로컬 DB: 실행 중인 PostgreSQL `instarchat-local-db`
- Android: 실행 중인 ARM64 에뮬레이터, `com.ashwoodfriends.alive` 1.0.0(4)
- 새 후보 소스 버전: Android/iOS `1.0.0 (7)`
- 설치된 APK 갱신 시각: 2026-08-12 11:27:38
- 설치된 APK는 이번 탭 마크업 변경 전 자산이므로 새 숫자 제거 UI의 시각 증거로 사용하지 않는다.

## 자동 검증

| 게이트 | 결과 | 증거 |
|---|---|---|
| 프런트 타입 검사 | passed | `npm run typecheck` |
| 프런트 도메인 테스트 | passed | `npm run test:domain`, 165 passed |
| 프런트 프로덕션 빌드 | passed | `npm run build`, Vite 162 modules |
| Playwright 테스트 발견 | passed | 21 tests listed |
| 백엔드 컴파일 | passed | `python -m compileall` |
| 백엔드 전체 테스트 | passed | 391 passed, 1 skipped |
| 추천 집중 테스트 | passed | 태그, 점수, 차단, 운영 상태, 커서, 다양성, 후보 제한 42 passed |
| diff 공백 검사 | passed | `git diff --check` |

백엔드 전체 테스트의 1개 skip은 실제 결제 공급자 통합 환경이 필요한 기존 테스트다.

## 네이티브 release 패키징

기존 완료 보고서에 `1.0.0 (4)` Android AAB와 iOS IPA 생성 이력이 있었다. App Store export 과정에서 이미 업로드된 최고 빌드가 6이라는 서버 응답을 확인해 이번 후보의 Android `versionCode`와 iOS `CURRENT_PROJECT_VERSION`을 7로 함께 올렸다. 두 플랫폼 번호가 일치하고 6보다 큰지 확인하는 도메인 회귀 테스트도 추가했다.

| 게이트 | 결과 | 증거 |
|---|---|---|
| production 웹 자산 빌드 | passed | `VITE_API_BASE_URL=https://alive.imagebgremover.net`, Vite 162 modules |
| Capacitor Android/iOS sync | passed | 양 플랫폼 주 JS SHA-256 `c48d06ba...938eb6b` 일치 |
| Android unsigned Release APK | passed | `assembleRelease`, package `com.ashwoodfriends.alive`, `1.0.0 (7)`, targetSdk 36 |
| Android 최신 탭 자산 | passed | APK 내 번들에서 `내 글 + 개수`, 숫자 없는 `팔로잉`, 숫자 없는 `추천` 마크업 확인 |
| Android signed AAB | failed | 기존 배포 키 환경변수 4종이 없어 `bundleRelease`가 의도된 가드에서 중단 |
| iOS unsigned Release | passed | arm64 iphoneos Release build, bundle `com.ashwoodfriends.alive`, `1.0.0 (7)` |
| iOS signed archive | passed | `ios/build/ALIVE-1.0.0-7.xcarchive` 생성 |
| iOS App Store IPA | passed | `destination=export`로 배포 서명된 `App.ipa` 생성, 서명·팀·arm64·버전 검증 |
| iOS 로컬 export 안전장치 | passed | 업로드와 로컬 export 옵션·Makefile 명령 분리, 회귀 테스트 통과 |
| production Compose 구문 | passed | `.env.example` 기준 `docker compose ... config -q` |
| 배포 예시 환경 중복 키 | passed | 중복 3개 제거, 전체 키 고유성 회귀 테스트 통과 |
| 최신 후보 실기기 시각 QA | not run | 설치된 에뮬레이터 APK는 이전 build 4이며 저장소 규칙상 새 앱 프로세스를 시작하지 않음 |

Android unsigned APK SHA-256은 `4a07f18e605ac469dea2573a7acd8772fc312d1f4d66d364bbb2ab540b0faff7`다. 배포 서명이 없으므로 스토어 또는 사용자 배포 파일로 사용하면 안 된다. iOS 배포 IPA SHA-256은 `5c222d4a78023614a18ee86303303c31311a0375847cfcbd74e6eefa3549bae2`이며 `Apple Distribution: ashwoodfriends inc. (LRLSLC2RMQ)` 서명을 검증했다.

최초 iOS export는 기존 `ios/AppStoreExportOptions.plist`의 `destination=upload`를 사전에 분리하지 않아 build 5 업로드를 시도했다. App Store는 이미 업로드된 build 6보다 낮다는 이유로 거부했고 새 빌드는 생성되지 않았다. 이후 build 7로 올리고 임시 `destination=export` 옵션만 사용해 업로드 없이 IPA를 생성했다.

기존 `.env.example` 끝부분의 빈 `TERMS_VERSION`, `MODERATION_API_KEY`, `MODERATION_ACTOR`가 앞의 유효한 예시 값을 덮어쓸 수 있어 중복 정의를 제거했다. production Compose는 migration 컨테이너의 `alembic upgrade head`가 성공한 뒤에만 backend가 시작되도록 구성돼 있다.

## 실행 중 프로세스 QA

| 경로 | 기대 | 실제 | 결과 |
|---|---|---|---|
| `GET /health` | 백엔드 정상 | HTTP 200 | passed |
| 추천 탭 | 개인화 추천 응답 | `GET /api/feed?...kind=recommendations` HTTP 200, `취향 추천` 표시 | passed |
| 팔로잉 탭 | 타임라인 또는 빈 상태 | `GET /api/feed?...kind=timeline` HTTP 200, 빈 상태 정상 | passed |
| 크레딧 화면 | 연관 없는 전역 회귀 없음 | 마이그레이션 정합화 후 credits·usage·purchases·catalog 모두 HTTP 200 | passed |
| 새 탭 숫자 제거 | 팔로잉·추천 숫자 없음 | 설치 APK가 이전 자산이라 시각 확인 불가 | not run |

## 공개 서비스 비파괴 점검

- `https://alive.imagebgremover.net/health`: HTTP 200, `{"status":"ok"}`, TLS 검증 통과
- 개인정보 처리방침, 이용약관, 계정 삭제 안내: 모두 HTTP 200, TLS 검증 통과
- 인증 없는 `/api/auth/me`, 추천·팔로잉 `/api/feed`: 모두 HTTP 401
- 상태를 변경하는 운영 인증·결제·미디어 요청: not run

## 발견된 문제와 조치

Android 첫 진입에서 `/api/credits`가 HTTP 500을 반환했다. 추천 변경 원인이 아니라 동시 작업의 `CreditUsage.prompt_version` 모델과 로컬 DB 마이그레이션 불일치였다.

- 최초 실패: `UndefinedColumnError: credit_usages.prompt_version does not exist`
- 원인: 코드 헤드 `20260812_0024`, 로컬 DB `20260811_0023`
- 조치: 로컬 개발 DB에 `alembic upgrade head` 적용
- 재검증: DB `20260812_0024 (head)`, 크레딧 관련 4개 API 모두 HTTP 200

운영 유사 데이터의 최초 추천 쿼리는 전체 공개 게시글에 개인화 점수를 계산해 목표 지연을 넘었다.

- 최초 증상: 게시글 5만 건에서 첫 페이지 웜 중앙값 824.75ms, 다음 페이지 2,052.28ms
- 실행계획: 점수 계산 대상 49,390행, 추천 용어 22개, 쿼리 794.66ms
- 원인: 개인화 랭킹 전에 후보 생성 경계가 없어 전체 공개 게시글을 반복 평가
- 조치: 기존 제외 규칙을 먼저 적용한 최신 게시글 2,400개를 후보로 생성한 후 개인화 점수를 적용
- 재검증: 첫 페이지 웜 중앙값 66.90ms·최대 68.22ms, 다음 페이지 224.24ms

프런트 커서 페이지 병합은 게시글이 120개를 넘으면 `.slice(-120)`으로 앞에서 본 최신 페이지를 제거했다.

- 영향: 일곱 번째 20개 페이지를 불러온 뒤 상단 게시글이 사라지고 스크롤 위치가 점프할 수 있음
- 조치: 임의 캐시 절단을 제거하고 기존·신규 페이지 내 복합 게시물 ID 중복만 제거
- 회귀 검증: 120개 기존 게시글에 20개를 추가해 140개 순서 보존, 중복 제거 통과
- ID 충돌 검증: 서로 다른 작성자가 같은 원본 `post_id`를 가져도 작성자 복합 ID로 두 게시물 모두 유지

## 성능 관찰

격리 PostgreSQL에 사용자·캐릭터·공개 캐릭터 각 5,001개와 공개 게시글 50,000개, 팔로우 50개, 좋아요 100개, 차단 1개를 합성했다. 코드 헤드 마이그레이션을 적용하고 현재 `FeedRepository`를 직접 실행했다.

- 12페이지 연속 240개 게시글: 복합 게시물 키 중복 0건
- 페이지당 동일 작성자: 최대 2개
- 팔로잉·차단·비공개·운영정지 계정 노출: 0건
- 추천 사유: 검증 240개 모두 `interest`
- 12페이지 응답시간: p95 269.33ms, 최대 276.97ms
- 성능 목표: 각 페이지 300ms 이내, passed

합성 검증 DB `instarchat_recommendation_qa_019ff3d4`는 검증 후 삭제했고 존재 여부 0건을 확인했다. 실제 로컬 앱 DB는 삭제하지 않았다.

## 출시 판단

추천 백엔드, API 계약, 정적 프런트 결과, 운영 유사 규모 성능, Android unsigned Release와 iOS 배포 서명 IPA는 출시 후보 수준으로 통과했다. 현재 상태를 즉시 양쪽 스토어에 제출하거나 사용자에게 배포할 수는 없다.

1. 기존 Android 업로드 키를 `ALIVE_ANDROID_*` 환경변수 4종으로 제공하고 signed AAB를 생성·검증한다.
2. 스테이징 DB가 배포 전 마이그레이션 `20260812_0024` head인지 확인한다.
3. signed build 7을 실제 기기에 설치해 탭 숫자 제거, 로그인 복원, 미디어, 결제, 추천·팔로잉 커서를 확인한다.
4. 승인된 배포 시점에만 iOS build 7 IPA와 Android AAB를 스토어에 업로드한다.

새 UI 확인 절차는 [추천 피드 수동 검토 가이드](../guides/guide_feed-personalization-review_2026-08-12.md)를 따른다.
