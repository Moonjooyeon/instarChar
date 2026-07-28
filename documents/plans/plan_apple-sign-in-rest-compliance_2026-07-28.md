---
title: Apple 로그인 REST API 및 운영 요건 구현 계획
author: black (black@ashwoodfriends.com)
created: 2026-07-28
updated: 2026-07-28
version: 1.1.0
status: implemented-local
---

# Apple 로그인 REST API 및 운영 요건 구현 계획

## 1. 목적

iOS 앱에서 Apple 네이티브 인증 화면을 열고, Apple REST API를 통해 인증 코드를 검증한 뒤 기존 `alive` 세션을 발급한다. 로그인만 동작하는 수준에 그치지 않고 Apple 계정 연결 해제, 앱 계정 삭제, 서버 간 알림까지 처리하여 App Store 운영 요건을 충족한다.

이번 작업은 현재 구현을 교체하지 않는다. 이미 작성된 AuthenticationServices 기반 iOS 플러그인, `POST /api/auth/apple/native`, Apple 공개 키 기반 ID 토큰 검증을 유지하고 빠진 연결과 운영 흐름을 보완한다.

## 2. 성공 기준

- iOS에서 Apple 공식 디자인의 로그인 버튼을 누르면 Apple 인증 화면이 열린다.
- Apple이 반환한 인증 코드와 ID 토큰을 운영 백엔드가 검증하고 기존 세션 쿠키를 발급한다.
- nonce 불일치, ID 토큰 사용자 불일치, 만료된 코드, Apple API 장애를 각각 거부한다.
- Apple client secret을 장기 문자열로 수동 관리하지 않고 서버에서 짧은 수명의 JWT로 생성한다.
- Apple refresh token은 평문이 아닌 암호문으로 저장되며 재로그인 시 안전하게 갱신된다.
- Apple 계정 사용자가 앱 계정을 삭제하면 Apple 토큰을 먼저 폐기한 뒤 로컬 데이터를 삭제한다.
- Apple 서버 간 알림의 서명을 검증하고 중복 알림을 한 번만 처리한다.
- Apple 로그인 취소와 일시적인 네트워크 실패가 사용자에게 복구 가능한 메시지로 표시된다.
- 백엔드 자동 테스트, 프런트엔드 도메인 테스트, iOS 시뮬레이터 QA를 통과하고 실제 기기에서 최종 로그인과 계정 삭제를 확인한다.

## 3. 범위와 전제

### 3.1 확정 방향

- iOS 인증 UI와 자격 증명 발급은 Apple `AuthenticationServices`를 사용한다.
- 웹 브라우저 기반 Apple 로그인으로 iOS 네이티브 흐름을 우회하지 않는다.
- 기존 `/api/auth/apple/native`와 `OAuthService`의 코드 교환·JWT 검증 흐름을 재사용한다.
- Apple 버튼은 제3자 npm 패키지를 추가하지 않고 Apple이 제공하는 공식 버튼 리소스를 사용한다.
- 네이티브 앱의 client ID는 번들 ID인 `com.ashwoodfriends.alive`를 사용한다.
- 웹 Apple 로그인용 Services ID와 iOS 앱용 번들 ID는 서로 다른 client ID로 유지한다.
- Apple refresh token과 access token은 서버에서만 암호화하여 보관한다.
- 계정 삭제 중 Apple의 일시적 장애가 발생하면 로컬 계정을 먼저 지우지 않는다. 토큰 폐기를 재시도할 수 있도록 삭제 요청을 실패 처리한다.

### 3.2 단계 분리

전체 범위는 여러 계층과 마이그레이션을 포함하므로 두 개의 배포 가능한 단위로 나눈다.

| 배포 단위 | 포함 범위 | 완료 시 사용자에게 생기는 변화 |
|---|---|---|
| Release A | iOS 플러그인 등록, 공식 버튼, client secret 생성, 로그인 테스트 | iOS Apple 로그인이 실제로 동작한다. |
| Release B | 암호화 토큰 저장, 계정 삭제 시 폐기, 서버 간 알림, 운영 모니터링 | 계정 삭제와 Apple 측 계정 변경까지 운영 요건에 맞게 처리한다. |

Release B까지 완료해야 App Store 제출 준비가 끝난 것으로 판정한다.

## 4. 현재 구현과 재사용 범위

| 현재 구현 | 경로 | 계획 |
|---|---|---|
| AuthenticationServices 기반 Apple 인증 플러그인 | `ios/App/App/AppleSignIn.swift` | 유지하고 Capacitor 브리지 등록과 credential 상태 처리를 추가한다. |
| Apple 네이티브 로그인 호출 및 nonce 생성 | `apps/frontend/src/api/auth.ts` | 유지하고 오류 분류와 중복 요청 방지를 보완한다. |
| Apple 네이티브 인증 API | `backend/app/api/v1/auth.py` | 기존 경로를 유지한다. |
| 인증 코드 교환 | `backend/app/services/oauth.py` | `/auth/token` 호출을 유지하고 동적 client secret과 토큰 저장 결과를 연결한다. |
| Apple 공개 키 기반 ID 토큰 검증 | `backend/app/services/oauth.py` | issuer, audience, 서명, nonce, subject 검증을 유지한다. |
| 사용자 생성 및 세션 발급 | `backend/app/repositories/users.py`, `backend/app/core/security.py` | 그대로 재사용한다. |
| 계정 삭제 API | `DELETE /api/auth/account` | Apple 사용자는 토큰 폐기 후 삭제하도록 확장한다. |
| Apple 로그인 백엔드 테스트 | `backend/tests/test_auth_api.py` | 성공·실패 분기를 확장한다. |
| iOS Apple 로그인 QA 결과 | `documents/qa/report_ios-apple-login_2026-07-28.md` | 플러그인 등록 회귀 테스트의 기준으로 사용한다. |

## 5. 목표 구조

### 5.1 로그인 흐름

```text
[React 로그인 화면]
        |
        | Apple 공식 버튼 클릭
        v
[Capacitor AppleSignIn 플러그인]
        |
        | ASAuthorizationAppleIDProvider
        v
[Apple 인증 화면]
        |
        | authorization code + ID token + 최초 1회 이름
        v
[POST /api/auth/apple/native]
        |
        +--> 기기 ID 토큰 서명·issuer·audience·nonce 검증
        |
        +--> 짧은 수명의 client secret JWT 생성
        |
        +--> POST https://appleid.apple.com/auth/token
        |
        +--> 서버 응답 ID 토큰 검증 및 기기 subject와 비교
        |
        +--> 사용자 생성 또는 조회
        |
        +--> refresh/access token 암호화 저장
        |
        v
[alive 세션 쿠키 발급]
```

### 5.2 계정 삭제 흐름

```text
[DELETE /api/auth/account]
        |
        +--> Google 사용자: 기존 삭제 흐름
        |
        +--> Apple 사용자
                |
                +--> 저장된 refresh token 복호화
                +--> POST https://appleid.apple.com/auth/revoke
                |
                +--> 성공 또는 이미 무효
                |       |
                |       v
                |   로컬 사용자 데이터 삭제
                |
                +--> 네트워크·Apple 5xx
                        |
                        v
                    503 반환, 계정과 토큰 유지
```

### 5.3 서버 간 알림 흐름

```text
[Apple server-to-server notification]
        |
        v
[POST /api/auth/apple/notifications]
        |
        +--> payload JWS 서명·issuer·audience·발급 시각 검증
        +--> 알림 고유 ID 중복 확인
        +--> 공식 event type 분기
        |       +--> consent revoked
        |       +--> account deleted
        |       +--> private relay email 상태 변경
        +--> 처리 결과와 시각 저장
        |
        v
[2xx 응답 또는 검증 실패 4xx]
```

## 6. 데이터 모델

### 6.1 `apple_oauth_credentials`

사용자 테이블에 Apple 전용 컬럼을 섞지 않고 Apple 자격 증명 테이블을 추가한다.

| 컬럼 | 타입 | 규칙 |
|---|---|---|
| `id` | UUID | 기본 키 |
| `user_id` | UUID | `users.id` 참조, 사용자 삭제 시 함께 삭제 |
| `client_id` | VARCHAR(255) | 토큰을 발급받은 Services ID 또는 번들 ID |
| `subject` | VARCHAR(255) | 검증된 Apple `sub` |
| `refresh_token_encrypted` | TEXT | 필수, 서버 암호화 키로 암호화 |
| `access_token_encrypted` | TEXT | Apple이 반환한 경우 저장 |
| `access_token_expires_at` | TIMESTAMPTZ | 응답 `expires_in`으로 계산 |
| `last_validated_at` | TIMESTAMPTZ | refresh token 상태 확인 시각 |
| `created_at` | TIMESTAMPTZ | 생성 시각 |
| `updated_at` | TIMESTAMPTZ | 갱신 시각 |

제약조건:

- `user_id + client_id`에 unique constraint를 둔다.
- `subject + client_id`에 index를 둔다.
- refresh/access token은 로그, 예외 메시지, API 응답에 포함하지 않는다.
- ID 토큰은 검증 후 장기 저장하지 않는다. 로그인에 필요한 식별자는 기존 `users.provider_subject`와 위 `subject`로 보존한다.

### 6.2 `apple_account_events`

서버 간 알림의 중복 처리와 운영 추적을 위한 최소 기록을 추가한다.

| 컬럼 | 타입 | 규칙 |
|---|---|---|
| `id` | UUID | 기본 키 |
| `event_id` | VARCHAR(255) | 검증된 payload 고유 ID, unique |
| `event_type` | VARCHAR(64) | Apple 공식 event type |
| `subject` | VARCHAR(255) | 대상 Apple 사용자 |
| `payload_hash` | VARCHAR(64) | 원문을 저장하지 않는 감사용 SHA-256 |
| `status` | VARCHAR(32) | `processed`, `ignored`, `failed` |
| `processed_at` | TIMESTAMPTZ | 처리 시각 |

알림 payload 전체는 개인정보와 토큰 노출을 피하기 위해 DB에 저장하지 않는다.

## 7. 설정과 비밀값

### 7.1 추가 설정

| 환경 변수 | 용도 | 저장 위치 |
|---|---|---|
| `APPLE_TEAM_ID` | client secret의 `iss` | 운영 비밀값 |
| `APPLE_KEY_ID` | JWT 헤더의 `kid` | 운영 비밀값 |
| `APPLE_PRIVATE_KEY` | Apple `.p8` 개인 키 | secret manager 또는 읽기 전용 secret 파일 |
| `APPLE_CLIENT_ID` | 웹 Services ID | 기존 값 유지 |
| `APPLE_NATIVE_CLIENT_ID` | `com.ashwoodfriends.alive` | 기존 값 유지 |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | 저장 토큰 암·복호화 | 운영 비밀값 |
| `APPLE_NOTIFICATION_AUDIENCE` | 서버 알림 audience 검증 | Apple 설정에 맞는 client ID |

### 7.2 client secret 정책

- ES256으로 서명하고 Apple 요구 claim인 `iss`, `iat`, `exp`, `aud`, `sub`를 생성한다.
- `aud`는 `https://appleid.apple.com`, `sub`는 요청에 사용한 client ID다.
- 만료 시간은 Apple 허용 최대치보다 짧게 설정하고 프로세스 안에서 짧게 캐시한다.
- 웹과 네이티브 요청은 각각 자신의 client ID를 `sub`로 사용한다.
- 전환 기간에는 기존 `APPLE_CLIENT_SECRET`, `APPLE_NATIVE_CLIENT_SECRET`을 비상 fallback으로만 허용하고 검증 완료 후 제거한다.
- `.p8` 키와 암호화 키는 `.env.example`에 값 없이 변수명만 문서화하고 Git에는 포함하지 않는다.

## 8. 단계별 작업

### Phase A1. iOS 플러그인 등록 복구

- [ ] `CAPBridgeViewController`를 상속한 앱 전용 ViewController를 추가한다.
- [ ] `capacitorDidLoad()`에서 `AppleSignIn` 인스턴스를 등록한다.
- [ ] 스토리보드의 ViewController class와 module을 앱 전용 클래스로 변경한다.
- [ ] Xcode target Sources에 새 Swift 파일이 포함되는지 확인한다.
- [ ] 로그인 진행 중 두 번째 호출은 기존대로 거부하고 완료·취소 후 `pendingCall`이 항상 해제되는지 확인한다.

완료 조건:

- iOS 시뮬레이터에서 `"AppleSignIn" plugin is not implemented on ios` 오류가 재현되지 않는다.
- Apple 로그인 버튼을 누르면 Apple 인증 화면이 열린다.

### Phase A2. Apple 공식 버튼 적용

- [ ] Apple REST button API가 생성한 공식 SVG 또는 PNG를 앱 자산으로 추가한다.
- [ ] 버튼 자산의 비율, 여백, 로고, 문구를 임의로 수정하지 않는다.
- [ ] 기존 React 버튼의 클릭·비활성화·로딩 동작은 유지한다.
- [ ] 공식 자산을 감싼 실제 `<button>`에 접근성 이름과 focus 상태를 제공한다.
- [ ] iOS가 아닌 환경에서의 표시 정책은 기존 로그인 정책과 일치시키고 Google 버튼은 수정하지 않는다.

완료 조건:

- 로그인 화면에서 Apple 공식 버튼 디자인이 보인다.
- 느린 네트워크나 오프라인 상태에서도 버튼이 사라지지 않도록 자산을 앱 번들에서 불러온다.
- 제3자 Apple 로그인 패키지가 새로 추가되지 않는다.

### Phase A3. 동적 client secret 생성

- [ ] Apple client secret 생성을 인증 코드 교환과 분리된 작은 서비스로 구현한다.
- [ ] Team ID, Key ID, client ID, `.p8` 키로 ES256 JWT를 생성한다.
- [ ] 만료 임박 전까지만 메모리 캐시하고 프로세스 재시작 시 다시 생성한다.
- [ ] 웹 Services ID와 네이티브 번들 ID 각각에 올바른 `sub`를 적용한다.
- [ ] 설정 누락과 잘못된 개인 키를 외부에 비밀값을 노출하지 않는 설정 오류로 처리한다.
- [ ] `/auth/token` 요청의 `client_secret`에 생성된 JWT를 사용한다.

완료 조건:

- JWT 헤더와 claim 단위 테스트가 통과한다.
- 만료된 사전 생성 secret을 운영자가 수동 교체하지 않아도 로그인 코드 교환이 가능하다.

### Phase A4. 로그인 오류 및 회귀 테스트

- [ ] 네이티브 플러그인 취소, 중복 실행, 토큰 누락을 테스트한다.
- [ ] 백엔드에서 nonce 불일치, 잘못된 audience/issuer, subject 불일치, 코드 재사용을 거부한다.
- [ ] Apple `/auth/token` timeout, 4xx, 5xx를 내부 오류 유형으로 구분하고 사용자에게 재시도 가능한 메시지를 제공한다.
- [ ] 성공 시 세션 쿠키가 발급되고 `/api/auth/me`가 Apple 사용자를 반환하는지 검증한다.

완료 조건:

- 기존 Google 로그인과 웹 Apple 로그인 테스트가 함께 통과한다.
- 운영 API 로그에 authorization code, ID token, client secret이 남지 않는다.

### Phase B1. Apple 토큰 암호화 저장

- [ ] `apple_oauth_credentials` 모델과 Alembic 마이그레이션을 추가한다.
- [ ] `cryptography`를 직접 의존성으로 명시하고 인증된 암호화 방식을 사용한다.
- [ ] 키 버전을 암호문에 포함하여 향후 키 교체가 가능하도록 한다.
- [ ] 로그인 코드 교환 성공 시 refresh/access token을 암호화하여 upsert한다.
- [ ] 재로그인 응답에 refresh token이 없으면 기존 refresh token을 지우지 않는다.
- [ ] DB 저장 실패 시 세션만 발급되는 부분 성공을 허용하지 않고 트랜잭션을 rollback한다.

완료 조건:

- DB와 로그에서 Apple 원문 토큰을 찾을 수 없다.
- 같은 사용자의 재로그인이 자격 증명 행을 중복 생성하지 않는다.
- 암호화 키가 틀리거나 누락되면 안전하게 실패한다.

### Phase B2. 계정 삭제 전 Apple 토큰 폐기

- [ ] Apple 사용자 삭제 시 저장된 refresh token을 조회하고 복호화한다.
- [ ] 동적 client secret으로 `POST https://appleid.apple.com/auth/revoke`를 호출한다.
- [ ] 폐기 성공과 이미 만료·무효인 토큰은 로컬 삭제를 계속 진행한다.
- [ ] timeout과 Apple 5xx에서는 `503`을 반환하고 계정과 자격 증명을 유지한다.
- [ ] Apple 자격 증명이 없는 기존 Apple 사용자의 정책을 명시한다. 기본값은 폐기할 토큰이 없으므로 로컬 삭제를 허용하고 경고 로그를 남기는 것이다.
- [ ] UI에서 삭제 실패 이유와 다시 시도할 수 있음을 표시한다.

완료 조건:

- Apple 테스트 계정 삭제 후 해당 토큰을 다시 사용할 수 없다.
- 폐기 실패 시 로컬 계정이 사라지지 않아 재시도가 가능하다.
- Google 사용자의 기존 계정 삭제 동작은 바뀌지 않는다.

### Phase B3. Apple 서버 간 알림

- [ ] `POST /api/auth/apple/notifications` 공개 endpoint를 추가한다.
- [x] 요청 모델에서 `payload` JWS 이외의 입력을 거부한다.
- [x] Apple 공개 키로 서명, issuer, audience, 발급 시각을 검증한다.
- [x] Apple 공식 문서의 현재 event type과 claim 이름을 구현 시점에 다시 대조한다.
- [x] `consent-revoked`, `account-deleted`, `email-enabled`, `email-disabled` 이벤트를 각각 처리한다.
- [ ] `apple_account_events.event_id` unique constraint로 같은 알림의 재처리를 막는다.
- [ ] 유효한 미지원 이벤트는 `ignored`로 기록하고 2xx를 반환한다.
- [ ] 유효하지 않은 서명은 4xx로 거부하며 사용자 존재 여부를 응답으로 노출하지 않는다.

완료 조건:

- 정상 알림, 위조 알림, 만료 알림, 중복 알림 테스트가 통과한다.
- Apple Developer 설정의 서버 알림 URL이 운영 endpoint를 가리킨다.
- 알림 실패율과 event type을 비밀값 없이 운영 로그에서 확인할 수 있다.

### Phase B4. 자격 증명 상태와 운영 점검

- [x] 앱 활성화 시 `ASAuthorizationAppleIDProvider.getCredentialState`를 호출한다.
- [x] `revoked`, `notFound`, `transferred` 상태에서 로컬 세션을 안전하게 정리하고 재로그인을 안내한다.
- [x] `ASAuthorizationAppleIDProvider.credentialRevokedNotification`을 앱 실행 중 감지한다.
- [x] 서버 refresh token 주기 확인은 현재 필요하지 않다고 결정했다. 네이티브 자격 상태와 서버 알림을 사용한다.
- [x] 토큰 폐기와 알림 처리에 비밀값을 포함하지 않는 운영 로그를 추가한다.

완료 조건:

- Apple 권한이 취소된 사용자가 유효한 연결로 오인되지 않는다.
- 운영자가 token exchange, revoke, notification 실패를 구분할 수 있다.

## 9. 테스트 계획

### 9.1 백엔드 단위 및 API 테스트

| 대상 | 필수 테스트 |
|---|---|
| client secret 생성 | `alg`, `kid`, `iss`, `aud`, `sub`, `iat`, `exp`, client ID별 분리, 캐시 만료 |
| ID 토큰 검증 | 정상, 잘못된 서명, issuer, audience, 만료, nonce, subject 불일치 |
| 인증 코드 교환 | 정상, 코드 재사용, token 응답 누락, timeout, Apple 4xx/5xx |
| 자격 증명 저장 | 최초 insert, 재로그인 upsert, refresh token 미반환, 암호화 키 오류, rollback |
| 토큰 폐기 | 성공, 이미 무효, 자격 증명 없음, timeout, Apple 4xx/5xx |
| 계정 삭제 | Apple 폐기 후 삭제, 폐기 실패 시 보존, Google 기존 경로 |
| 서버 알림 | 정상, 위조, 만료, 잘못된 audience, 중복, 미지원 event type, 없는 사용자 |

예상 테스트 파일:

- `backend/tests/test_apple_client_secret.py`
- `backend/tests/test_apple_oauth_credentials.py`
- `backend/tests/test_apple_notifications.py`
- `backend/tests/test_auth_api.py`
- `backend/tests/test_migrations.py`

### 9.2 프런트엔드 테스트

| 대상 | 필수 테스트 |
|---|---|
| 플랫폼 분기 | iOS만 네이티브 Apple 플러그인 사용, 웹은 기존 backend OAuth 사용 |
| 버튼 상태 | 로딩 중 재클릭 차단, 공식 이미지 alt/접근성 이름, 비활성화 |
| 오류 표시 | 사용자 취소, 네트워크 실패, 서버 검증 실패, 계정 삭제 폐기 실패 |
| 회귀 | Google 로그인, 세션 복구, 일반 계정 삭제 요청 |

예상 테스트 파일:

- `apps/frontend/tests/domain/api-auth.test.js`
- `apps/frontend/tests/domain/app-styles.test.js`
- 필요 시 Apple 버튼 렌더링 전용 테스트

### 9.3 iOS QA

```text
[Apple 버튼 클릭]
      |
      +--> 취소 ------------------------> 취소 안내, 재시도 가능
      |
      +--> 인증 성공
              |
              +--> API 실패 ------------> 오류 안내, 세션 없음
              |
              +--> API 성공 ------------> 홈 진입, 앱 재실행 후 세션 유지
                                              |
                                              +--> 계정 삭제
                                                      |
                                                      +--> revoke 실패: 계정 유지
                                                      +--> revoke 성공: 로그아웃 및 데이터 삭제
```

- 시뮬레이터에서 플러그인 등록, 인증 화면 표시, 취소 흐름을 우선 확인한다.
- Apple ID 상태에 따라 시뮬레이터의 실제 인증이 제한될 수 있으므로 실제 기기 테스트를 최종 필수 조건으로 둔다.
- 테스트용 Apple 계정으로 신규 로그인, 재로그인, Apple 권한 취소, 앱 계정 삭제를 확인한다.
- 운영 백엔드와 연결할 때 실제 사용자 데이터가 아닌 테스트 계정을 사용한다.

## 10. 실패 모드와 대응

| 실패 모드 | 서버 처리 | 사용자 경험 | 검증 |
|---|---|---|---|
| iOS 플러그인 미등록 | 네이티브 호출 전 실패 | 재시도 가능한 오류 | 시뮬레이터 회귀 테스트 |
| Apple 로그인 취소 | API 호출 없음 | 취소 안내 후 로그인 화면 유지 | 프런트엔드·iOS 테스트 |
| nonce 또는 subject 불일치 | 4xx 거부, 세션 미발급 | 로그인 실패 안내 | 백엔드 단위 테스트 |
| 인증 코드 재사용·만료 | Apple 4xx를 로그인 실패로 변환 | 다시 Apple 인증 요청 | API 테스트 |
| Apple token endpoint timeout | 제한된 timeout 후 실패 | 잠시 후 재시도 안내 | httpx mock 테스트 |
| 토큰 암호화·DB 저장 실패 | 트랜잭션 rollback, 세션 미발급 | 로그인 실패 안내 | repository 테스트 |
| 계정 삭제 중 revoke timeout | 로컬 삭제 중단 | 계정 유지 및 재시도 안내 | API 통합 테스트 |
| 서버 알림 중복 수신 | 기존 event ID 확인 후 2xx | 사용자 영향 없음 | 중복 알림 테스트 |
| 서버 알림 위조 | 4xx 거부 | 사용자 영향 없음 | JWT 검증 테스트 |
| 암호화 키 유실 | 토큰 복호화 실패, 삭제 중단 | 지원 문의와 재시도 안내 | 운영 비밀값 백업 절차 |

## 11. Apple Developer 및 운영 준비

### 11.1 사용자가 준비할 값

- Apple Developer Team ID
- Sign in with Apple Key ID
- 해당 Key ID의 `.p8` 개인 키
- 웹 로그인을 유지할 경우 Services ID
- Apple Developer에 등록할 웹 Return URL
- Apple Developer에 등록할 서버 간 알림 URL
- Apple 로그인이 가능한 실제 테스트 기기와 테스트 Apple ID

개인 키 원문은 채팅이나 Git으로 전달하지 않고 운영 secret 저장소에 직접 설정한다.

### 11.2 Apple Developer 설정

- App ID `com.ashwoodfriends.alive`에 Sign in with Apple capability를 활성화한다.
- Xcode target의 entitlement와 provisioning profile을 같은 App ID로 맞춘다.
- 웹 로그인용 Services ID와 Return URL이 `https` 운영 주소를 사용하도록 설정한다.
- 서버 간 알림 URL을 `https://alive.imagebgremover.net/api/auth/apple/notifications`로 등록한다.
- 대한민국 개발자 계정에 적용되는 최신 서버 간 알림 등록 요구사항을 제출 직전에 다시 확인한다.

## 12. 배포 순서

1. Apple Developer App ID, Key, Services ID, Return URL, 알림 URL을 준비한다.
2. Release A의 iOS 브리지 등록과 공식 버튼을 적용한다.
3. 동적 client secret을 구현하고 운영 secret을 설정한다.
4. 백엔드 테스트 후 Release A 백엔드를 배포한다.
5. iOS 시뮬레이터와 실제 기기에서 로그인 성공을 확인한다.
6. Release B의 토큰 테이블과 이벤트 테이블 마이그레이션을 먼저 배포한다.
7. 토큰 저장, revoke, 서버 알림 코드를 배포한다.
8. 테스트 Apple 계정으로 로그인·재로그인·권한 취소·계정 삭제를 확인한다.
9. 운영 로그와 알림 endpoint 상태를 확인한 후 App Store 빌드를 만든다.

운영 마이그레이션과 배포는 별도 승인 후 실행한다. 이 계획서 작성 단계에서는 운영 환경을 변경하지 않는다.

## 13. 롤백 전략

- 데이터베이스 마이그레이션은 기존 로그인 데이터와 호환되는 추가 테이블만 생성한다.
- Release A 문제 시 앱을 이전 로그인 UI로 되돌릴 수 있지만 Apple 로그인을 숨긴 상태로 App Store 제출하지 않는다.
- 동적 client secret 전환 중에는 기존 정적 secret fallback을 잠시 유지한다.
- Release B 코드 롤백 시 새 테이블은 보존하여 저장된 refresh token과 알림 처리 기록을 잃지 않는다.
- 토큰 암호화 키는 배포와 독립적으로 백업하며, 키 교체 전 기존 암호문 복호화 검증을 완료한다.

## 14. 병렬 작업 전략

| 작업 흐름 | 모듈 | 선행 조건 |
|---|---|---|
| Lane A: 네이티브 플러그인과 버튼 | `ios/`, `apps/frontend/` | Apple 공식 버튼 자산 확정 |
| Lane B: client secret과 토큰 교환 | `backend/app/services/`, `backend/app/core/` | Team ID, Key ID, `.p8` 준비 |
| Lane C: 토큰 저장과 폐기 | `backend/app/models/`, `backend/app/repositories/`, `backend/migrations/` | Lane B 계약 확정 |
| Lane D: 서버 간 알림 | `backend/app/api/`, `backend/app/services/`, `backend/app/models/` | notification audience와 공식 payload 확인 |

Lane A와 Lane B는 병렬 진행할 수 있다. Lane C는 Lane B의 client secret 인터페이스가 확정된 뒤 진행한다. Lane D는 Lane C와 모델 영역 충돌 가능성이 있으므로 마이그레이션 번호와 모델 변경을 조율하거나 순차 진행한다.

## 15. 예상 파일 영향

### iOS

- `ios/App/App/AliveBridgeViewController.swift` 신규
- `ios/App/App/AppleSignIn.swift`
- `ios/App/App/Base.lproj/Main.storyboard`
- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App/App.entitlements`

### 프런트엔드

- `apps/frontend/src/api/auth.ts`
- `apps/frontend/src/features/auth/AuthScreens.tsx`
- `apps/frontend/src/appStyles.ts`
- Apple 공식 버튼 이미지 자산
- `apps/frontend/tests/domain/api-auth.test.js`
- `apps/frontend/tests/domain/app-styles.test.js`

### 백엔드

- `backend/app/core/config.py`
- `backend/app/services/oauth.py`
- Apple client secret·자격 증명·알림 처리용 소규모 서비스
- `backend/app/api/v1/auth.py`
- `backend/app/models/entities.py`
- `backend/app/models/__init__.py`
- `backend/app/repositories/users.py`
- Apple 자격 증명 repository
- 신규 Alembic migration
- `backend/requirements.txt`
- 관련 백엔드 테스트
- `.env.example`

## 16. NOT in scope

- Google 로그인 구조 변경: Apple 운영 요건과 무관하고 현재 회귀 테스트 대상으로만 둔다.
- iOS Apple 로그인을 웹 OAuth 또는 Apple JavaScript SDK로 교체: 네이티브 AuthenticationServices가 현재 앱 구조에 더 적합하다.
- 제3자 Apple 로그인 npm 패키지 도입: 공식 UI와 네이티브 인증을 이미 직접 사용할 수 있어 의존성만 늘어난다.
- 로그인 화면 전체 재디자인: 공식 Apple 버튼 적용에 필요한 범위만 수정한다.
- Android에 Apple 로그인 추가: 현재 요구사항은 iOS 필수 로그인 제공이다.
- 운영 배포와 운영 DB 마이그레이션 실행: 구현·검증 완료 후 별도 승인 대상으로 둔다.

## 17. 구현 전 확인 항목

- [ ] Apple 웹 로그인을 계속 제공할지 확정한다. 유지하면 Services ID와 Return URL이 필요하다.
- [ ] Apple Developer Team ID, Key ID, `.p8` 키가 준비되었는지 확인한다.
- [ ] 서버 알림 payload의 최신 claim과 event type을 Apple 공식 문서에서 다시 확인한다.
- [ ] 운영 secret 저장 방식을 확정한다. 권장안은 Docker에 읽기 전용 secret 파일을 mount하는 방식이다.
- [ ] 토큰 암호화 키의 생성·백업·교체 책임자를 정한다.
- [ ] 실제 기기와 테스트 Apple ID를 준비한다.

## 18. 참고 문서

- [Sign in with Apple REST API](https://developer.apple.com/documentation/signinwithapplerestapi)
- [Generate and validate tokens](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens)
- [Fetch Apple public keys](https://developer.apple.com/documentation/signinwithapplerestapi/fetch-apple%27s-public-key-for-verifying-token-signature)
- [Revoke tokens](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens)
- [TN3194: Account deletion and token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Processing account changes](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts)
- [ASAuthorizationAppleIDButton](https://developer.apple.com/documentation/authenticationservices/asauthorizationappleidbutton)
- [Apple REST button API](https://developer.apple.com/documentation/signinwithapplerestapi/get-a-sign-in-with-apple-button-that-is-left-aligned)

## 19. 리뷰 상태

`/plan-eng-review`의 정식 대화형 검토는 계획 작성 시점에 필수 의사결정 도구가 없어 완료하지 못했다. 이후 단계별 구현과 자동 검증을 완료했으며, 운영 반영과 실제 Apple 계정 검증만 별도 작업으로 남겨 두었다.

## 20. 구현 결과

| 단계 | 커밋 | 결과 |
|---|---|---|
| A1 | `2d1930e` | Capacitor 네이티브 Apple 플러그인 등록과 iOS entitlement 연결 |
| A2 | `a20e128` | Apple 공식 REST 버튼 이미지를 앱에 번들하고 접근 가능한 버튼으로 적용 |
| A3·A4 | `39abaee` | 네이티브 authorization code 교환, 짧은 수명 ES256 client secret 생성 |
| B1 | `e15ea79` | Apple OAuth 토큰 암호화 저장과 `20260728_0007` 마이그레이션 |
| B2 | `9228768` | Apple 토큰 폐기 성공 후 계정 삭제, 일시 장애 시 계정 보존 |
| B3 | `a9239b3` | 서버 간 알림 검증·중복 방지·계정 상태 반영과 `20260728_0008` 마이그레이션 |
| B4 | 이 문서와 함께 커밋 | 앱 활성화·취소 알림 기반 자격 상태 확인과 운영 로그 |

최종 로컬 검증 결과:

- 프런트 도메인 테스트: 81개 통과
- 프런트 TypeScript 검사: 통과
- 프런트 Vite 프로덕션 빌드: 통과
- 백엔드 테스트: 131개 통과
- Alembic head: `20260728_0008`
- iOS 시뮬레이터 Debug 빌드: 통과
- Git whitespace 검사: 통과

운영 반영 전 남은 외부 작업:

- Apple Developer Team ID, Key ID, `.p8` 키와 토큰 암호화 키를 운영 secret으로 설정한다.
- Apple Developer의 서버 알림 URL과 허용 audience를 운영 도메인에 맞게 등록한다.
- 운영 DB에는 승인 후 `20260728_0007`, `20260728_0008` 마이그레이션을 적용한다.
- 실제 기기와 테스트 Apple ID로 로그인, 권한 취소, 계정 삭제를 최종 확인한다.
