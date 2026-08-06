---
title: App Store 심사 반려 대응 및 재제출 계획
author: black (black@ashwoodfriends.com)
created: 2026-07-30
updated: 2026-07-30
version: 1.1.0
status: in_progress
---

# App Store 심사 반려 대응 및 재제출 계획

## 1. 목적

App Store 심사에서 확인된 다음 세 항목을 재현 가능한 방식으로 해결하고, iPad를 포함한 실제 릴리스 환경에서 검증한 뒤 새 빌드로 재심사를 요청한다.

1. 사진 선택 메뉴에서 `Take Photo`를 누르면 앱이 종료되는 문제
2. Google 로그인 시 사용자가 기본 Safari 앱으로 이탈하는 문제
3. 심사용 Google 계정 로그인 중 추가 인증 코드가 필요해 심사가 중단되는 문제

이번 작업의 목표는 반려 사유를 없애는 것이다. 인증 시스템 전체 교체, 네이티브 카메라 기능 재작성, iPad 전용 UI 재설계는 포함하지 않는다.

## 2. 제출 및 조사 기준

| 항목 | 값 |
|---|---|
| Submission ID | `06e28e44-20ac-4ecc-99f2-066d49769f3a` |
| 심사일 | 2026-07-29 |
| 심사 기기 | iPad Air 11-inch (M3) |
| 심사 OS | iPadOS 26.6 |
| 심사 버전 | `1.0 (2)` |
| 스크린샷 | `/Users/ukdong/Downloads/Screenshot-0729-183540.png` |
| 현재 브랜치 | `main` |

스크린샷은 캐릭터 프로필의 `+ 그림 올리기`를 누른 뒤 iOS 시스템 메뉴에 `Photo Library`, `Take Photo`, `Choose File`이 표시된 상태다. 심사 문구에 따르면 이 메뉴에서 `Take Photo`를 누른 직후 앱이 종료됐다.

## 3. 조사 결과

### 3.1 사진 촬영 크래시

프런트엔드는 다음 위치에서 HTML 파일 입력을 사용한다.

| 기능 | 현재 경로 | 동작 |
|---|---|---|
| 프로필 헤더 | `apps/frontend/src/app/feed/FeedProfilePanel.tsx` | `accept="image/*"` |
| 프로필 인장 | `apps/frontend/src/app/feed/FeedProfilePanel.tsx` | `accept="image/*"` |
| 캐릭터 갤러리 | `apps/frontend/src/app/feed/FeedProfilePanel.tsx` | `accept="image/*" multiple` |
| DM 이미지 | `apps/frontend/src/app/dm/DmControls.tsx` | `accept="image/*"` |

iOS의 `Info.plist`에는 `NSCameraUsageDescription`이 없다. Apple은 카메라 API를 사용하는 앱이 이 키를 선언하지 않으면 런타임에 앱이 종료된다고 명시한다. 스크린샷과 심사 재현 절차가 현재 코드와 일치하므로 가장 가능성이 높은 직접 원인이다.

Apple이 첨부한 `.ips` 파일은 저장소에 없으므로 구현 전에 App Store Connect에서 내려받아 다음 문구를 확인한다.

- `NSCameraUsageDescription`
- `Privacy-sensitive data`
- `TCC`
- `This app has crashed because it attempted to access privacy-sensitive data`

이 문구가 확인되면 원인을 확정한다. 다른 예외가 있으면 아래 카메라 수정 전에 크래시 스택을 기준으로 범위를 다시 조정한다.

### 3.2 외부 브라우저 로그인

`apps/frontend/src/api/auth.ts`의 `signInWithOAuthProvider()`는 iOS Apple 로그인만 네이티브 플러그인을 사용하고, Google 로그인은 `window.location.assign()`으로 OAuth 시작 URL을 연다.

현재 프로젝트에는 다음 구현이 없다.

- `@capacitor/browser`
- `SFSafariViewController`
- `ASWebAuthenticationSession`
- Google Sign-In iOS SDK

따라서 Google 로그인이 기본 Safari로 이동했다는 심사 결과가 현재 코드와 일치한다.

### 3.3 심사용 인증 코드

현재 앱에는 자체 아이디·비밀번호 로그인이나 앱 자체 2단계 인증이 없다. 심사자에게 제공한 사용자명과 비밀번호는 Google 계정 자격 증명으로 판단된다. Apple이 요청한 인증 코드는 Google이 새 기기 로그인에 요구한 추가 인증이다.

백엔드의 `native_oauth_codes`는 OAuth 완료 후 앱 세션을 발급하기 위한 내부 일회용 코드다. 심사자가 입력하는 인증 코드가 아니므로 이 테이블이나 교환 API를 변경해서는 안 된다.

## 4. 확정 방향과 전제

### 4.1 권장안

| 영역 | 권장안 | 이유 |
|---|---|---|
| 카메라 | `Info.plist`에 명확한 카메라 사용 목적 추가 | 크래시 원인을 직접 제거하는 최소 변경 |
| 사진 보관함 | 기존 시스템 선택기를 유지하고 실제 기기에서 동작 확인 | 현재 반려와 크래시 증거는 카메라 접근에 한정됨 |
| Google 로그인 | 공식 `@capacitor/browser`로 OAuth URL을 연다 | iOS에서 `SFSafariViewController`를 사용하며 기존 백엔드와 딥링크를 재사용 가능 |
| Apple 로그인 | 현재 네이티브 `AppleSignIn` 흐름 유지 | 이미 앱 내부 인증 화면을 사용하므로 반려 원인이 아님 |
| OAuth 콜백 | 기존 `com.ashwoodfriends.alive://oauth/callback` 유지 | 백엔드의 네이티브 코드 교환 흐름을 재사용 |
| 심사용 계정 | 전용 Google 계정의 추가 인증을 해제하고 운영 데이터와 분리된 샘플 데이터를 준비 | 인증 백도어 없이 가장 작은 운영 변경 |
| 추가 인증 재발 | 재제출하지 말고 Apple의 통화 요청 절차 사용 | Google의 위험 기반 추가 인증은 앱에서 확실하게 우회할 수 없음 |
| 기기 범위 | iPhone 전용 설정을 유지하더라도 iPad 호환 모드에서 전 기능 검증 | iPhone 전용 앱도 iPad에서 실행·심사될 수 있음 |

### 4.2 구현 전 확인할 전제

- 현재 `ios/App/App.xcodeproj/project.pbxproj`에는 사용자가 만든 미커밋 변경이 있다.
  - 빌드 번호 `1`에서 `2`로 변경
  - `TARGETED_DEVICE_FAMILY`를 `"1,2"`에서 `1`로 변경
- 이 변경은 보존하며 자동으로 되돌리지 않는다.
- 재제출 빌드는 기존 `1.0 (2)`보다 큰 빌드 번호가 필요하므로 최종 단계에서 `1.0 (3)`으로 올린다.
- `TARGETED_DEVICE_FAMILY = 1`은 크래시 해결책으로 취급하지 않는다. 제품이 iPhone 전용이라는 결정만 표현한다.
- 운영 네이티브 빌드의 `VITE_API_BASE_URL`은 HTTPS 절대 URL이어야 한다.
- 앱 프로세스는 새로 시작하지 않는다. 이미 실행 중인 앱이나 사용자가 Xcode에서 실행한 릴리스 빌드로 검증한다.

## 5. 성공 기준

### 5.1 크래시

- iPad Air 또는 동급 실제 iPad에서 새 설치 후 `Take Photo`를 눌러도 앱이 종료되지 않는다.
- 최초 카메라 접근 시 앱 이름과 사용 목적이 포함된 권한 안내가 표시된다.
- 권한 허용 후 촬영, 촬영 취소, 사진 사용이 모두 정상 동작한다.
- 권한 거부 후 앱이 유지되고 다시 파일 선택 화면으로 돌아갈 수 있다.
- 헤더, 인장, 갤러리, DM 이미지 네 경로가 모두 같은 기준을 통과한다.

### 5.2 Google 로그인

- iOS와 iPadOS에서 Google 버튼을 누르면 앱 위에 `SFSafariViewController`가 표시된다.
- 주소와 보안 상태를 사용자가 확인할 수 있다.
- 로그인 성공 후 브라우저가 닫히고 앱으로 돌아와 기존 세션이 생성된다.
- 사용자가 `Done`으로 닫거나 Google 동의를 취소하면 무한 로딩 상태가 남지 않는다.
- 네트워크 오류와 잘못된 콜백은 복구 가능한 오류 메시지를 표시한다.
- 웹 빌드의 기존 Google 로그인과 iOS Apple 네이티브 로그인은 회귀하지 않는다.

### 5.3 심사 접근

- 심사용 계정을 초기화된 iPad 또는 Safari 개인정보 보호 세션에서 로그인해도 추가 인증을 요구하지 않는다.
- 심사용 계정에 캐릭터, 피드, 갤러리, DM 검증용 데이터가 준비되어 있다.
- Review Notes에 로그인 방법, 검증할 주요 기능, 수정된 반려 항목을 영어로 작성한다.
- 추가 인증이 다시 발생하면 최신 전화번호를 확인한 뒤 Apple 담당자 통화를 요청한다.

### 5.4 배포

- 프런트엔드 타입 검사, 도메인 테스트, 빌드, 백엔드 테스트가 통과한다.
- App Store용 Release 아카이브의 실제 `Info.plist`에 권한 문자열이 포함된다.
- Release 아카이브에 Capacitor Browser 플러그인이 포함된다.
- TestFlight에서 동일 시나리오를 다시 검증한 뒤 빌드 `3`을 심사에 제출한다.

## 6. 목표 구조

### 6.1 사진 선택 흐름

```text
[React <input type="file" accept="image/*">]
                      |
                      v
          [iOS 시스템 선택 메뉴]
             /        |        \
            /         |         \
 [Photo Library] [Take Photo] [Choose File]
        |              |
        |              +--> Info.plist의 카메라 목적 문자열 확인
        |                     |
        |                     +--> 최초 접근: 권한 안내
        |                     +--> 허용: 카메라 표시
        |                     +--> 거부: 앱 유지
        |
        v
       [File] --> [FileReader Data URL] --> [기존 이미지 상태 저장]
```

HTML 파일 입력과 기존 `FileReader` 처리는 유지한다. 이번 작업에서 Capacitor Camera 플러그인으로 교체하지 않는다.

### 6.2 iOS Google 로그인 흐름

```text
[Google로 계속]
       |
       v
[signInWithOAuthProvider("google")]
       |
       +--> Web
       |      |
       |      v
       |   기존 window.location.assign()
       |
       +--> iOS native
              |
              v
       [@capacitor/browser Browser.open]
              |
              v
       [iOS SFSafariViewController]
              |
              v
       [/api/auth/google/start]
              |
              v
       [Google OAuth]
              |
              v
       [/api/auth/google/callback]
              |
              v
[com.ashwoodfriends.alive://oauth/callback?code=...]
              |
              v
       [App appUrlOpen listener]
              |
              +--> Browser.close()
              +--> POST /api/auth/native/exchange
              +--> /api/auth/me
              |
              v
         [로그인 완료]
```

### 6.3 취소 및 오류 상태

```text
[브라우저 열림]
      |
      +--> Google 성공 --> 딥링크 수신 --> 세션 교환 --> 로그인 완료
      |
      +--> Google 오류 --> 오류 딥링크 --> 브라우저 닫기 --> 오류 표시
      |
      +--> 사용자가 Done --> browserFinished --> 로딩 해제 --> 로그인 화면 유지
      |
      +--> Browser.open 실패 --> 로딩 해제 --> 재시도 메시지
      |
      +--> 콜백 후 세션 교환 실패 --> 브라우저 닫기 --> 재로그인 메시지
```

## 7. 구현 단계

### Phase 0. 심사 증거 확보와 기준선 고정

#### 작업

1. App Store Connect에서 첨부된 `.ips` 크래시 로그를 내려받는다.
2. 제출한 빌드 `1.0 (2)`의 dSYM과 로그를 Xcode Organizer에서 연결한다.
3. 크래시 로그를 심볼리케이트한다.
4. 종료 사유가 카메라 개인정보 키 누락인지 확인한다.
5. 현재 미커밋 `project.pbxproj` 변경을 별도 메모하고 구현 과정에서 덮어쓰지 않는다.
6. 제출 빌드가 iPhone 호환 모드로 iPad에서 실행된 사실을 QA 기준에 기록한다.

#### 산출물

- `documents/qa/reports/report_ios-app-review-rejection-2026-07-30.md` (planned artifact)
  - 크래시 로그의 민감 정보는 제거한다.
  - 예외 유형, 종료 사유, 심볼리케이션 여부만 기록한다.

#### 완료 기준

- 크래시 원인이 `NSCameraUsageDescription` 누락으로 확인되거나, 다른 원인이면 해당 스택에 맞춰 계획을 갱신한다.

### Phase 1. 카메라 개인정보 선언

#### 수정 대상

- `ios/App/App/Info.plist`
- `apps/frontend/tests/domain/capacitor-config.test.js`

#### 작업

1. `NSCameraUsageDescription`을 추가한다.
2. 문구는 기능과 데이터 사용 목적을 구체적으로 설명한다.
   - 권장 문구: `캐릭터 프로필과 게시물, DM에 사용할 사진을 직접 촬영하기 위해 카메라 접근이 필요합니다.`
3. 앱이 시스템 사진 선택기로 사진을 읽고 사진 보관함에 직접 저장하지 않으므로, 증거 없이 `NSPhotoLibraryUsageDescription`이나 `NSPhotoLibraryAddUsageDescription`을 추가하지 않는다.
4. 실제 기기에서 `Photo Library`가 별도 권한 키 없이 정상 동작하는지 확인한다.
5. 사진 보관함 접근 관련 런타임 오류가 확인될 때만 `NSPhotoLibraryUsageDescription`을 추가하고 계획과 테스트를 갱신한다.
6. 마이크를 사용하지 않으므로 `NSMicrophoneUsageDescription`은 추가하지 않는다.
7. 도메인 테스트에서 `Info.plist`에 카메라 키와 비어 있지 않은 문자열이 존재하는지 검사한다.
8. `plutil -lint ios/App/App/Info.plist`로 문법을 검사한다.

#### 주의점

- Xcode Build Settings의 `INFOPLIST_KEY_*`와 `Info.plist` 양쪽에 중복 선언하지 않는다.
- 권한을 선제 요청하지 않는다. 사용자가 사진 촬영 또는 사진 선택을 선택한 시점에 iOS가 요청하도록 유지한다.
- 권한 거부를 앱 종료나 강제 설정 이동으로 처리하지 않는다.

#### 완료 기준

- 정적 테스트가 권한 키 삭제를 회귀로 잡는다.
- 실제 기기에서 최초 접근 권한 안내가 표시되고 앱이 유지된다.

### Phase 2. Google OAuth를 앱 내부 브라우저로 전환

#### 수정 대상

- `package.json`
- `package-lock.json`
- `apps/frontend/src/api/auth.ts`
- `apps/frontend/tests/domain/api-auth.test.js`
- `ios/App/CapApp-SPM/Package.swift` 또는 Capacitor 동기화가 생성하는 동등한 네이티브 설정

#### 작업

1. 현재 Capacitor 주 버전과 맞는 `@capacitor/browser` 8.x를 설치한다.
2. Capacitor 동기화를 통해 iOS SPM 의존성을 반영한다.
3. `signInWithOAuthProvider()`를 플랫폼별로 분기한다.
   - iOS native Google: `Browser.open()`
   - iOS native Apple: 현재 `signInWithNativeApple()`
   - Android와 Web Google/Apple: 현재 `window.location.assign()`
4. `Browser.open()`에는 반드시 HTTP 또는 HTTPS 절대 URL을 전달한다.
5. iOS 표현 방식은 `fullscreen`을 사용한다.
6. 기존 `appUrlOpen` 리스너에서 OAuth 콜백을 받으면 브라우저를 닫는다.
7. 브라우저 닫기 실패는 세션 교환을 막지 않도록 분리한다.
8. 딥링크의 `code`를 기존 `POST /api/auth/native/exchange`에 전달한다.
9. 교환 성공 후 기존 auth state listener를 호출해 `/auth/me`를 다시 읽는다.
10. 사용자가 `Done`으로 브라우저를 닫으면 `browserFinished`에서 로그인 로딩을 해제한다.
11. 프로그램이 성공 콜백 처리 중 `Browser.close()`를 호출해서 발생한 종료 이벤트와 사용자 취소를 구분한다.
12. 중복 Google 버튼 입력으로 여러 브라우저가 열리지 않도록 기존 `authLoading`과 네이티브 OAuth 진행 상태를 함께 사용한다.
13. Browser 플러그인 오류를 사용자용 한국어 메시지로 변환한다.
14. 기존 Apple credential monitoring과 리스너 정리 동작을 유지한다.

#### 권장 구현 규칙

- OAuth URL 생성, 브라우저 열기, 콜백 교환은 각각 20줄 이하의 단일 책임 함수로 나눈다.
- 테스트를 위해 플랫폼 판정과 URL 생성을 순수 함수로 분리하되, 한 번만 쓰는 과도한 클래스는 만들지 않는다.
- OAuth 토큰이나 인증 코드를 로그에 출력하지 않는다.
- Google OAuth를 일반 `WKWebView` 안에 직접 삽입하지 않는다.
- 백엔드 OAuth 엔드포인트와 데이터 모델은 변경하지 않는다.

#### 완료 기준

- iOS에서 로그인 화면을 벗어나지 않고 Google 인증 화면이 모달로 열린다.
- 성공, 사용자 취소, Provider 오류, 네트워크 오류가 모두 복구 가능하다.
- Apple 네이티브 로그인과 웹 OAuth가 기존대로 동작한다.

### Phase 3. 심사용 계정과 샘플 데이터 준비

#### 기본안

코드에 심사 전용 인증 우회나 고정 비밀번호를 추가하지 않는다. 별도의 Google 심사용 계정을 운영한다.

#### 작업

1. 개인·관리자 계정과 분리된 전용 Google 계정을 만든다.
2. 해당 계정에서 Google 2단계 인증, 보안 키, 패스키 전용 로그인 등 심사자를 막을 수 있는 조건을 제거한다.
3. 복구 이메일과 전화번호는 운영 담당자가 접근 가능한 값으로 유지한다.
4. Google Cloud OAuth 동의 화면에서 해당 계정이 허용되는지 확인한다.
5. 운영 앱에서 심사용 계정으로 로그인해 다음 샘플 데이터를 만든다.
   - 캐릭터 최소 1개
   - 프로필 헤더와 인장
   - 갤러리 이미지
   - 피드 게시물
   - 댓글 또는 상호작용
   - DM 대화
6. 초기화된 실제 iPad에서 저장된 Google 로그인 쿠키 없이 계정 로그인을 반복한다.
7. 최소 두 번의 독립 로그인에서 추가 인증이 없음을 확인한다.
8. App Store Connect의 App Review Information 전화번호를 최신 상태로 갱신한다.

#### 추가 인증이 계속 발생할 때

다음 순서로 대응한다.

1. 재제출을 멈춘다.
2. Google 계정의 최근 보안 활동과 로그인 제한을 확인한다.
3. Apple이 안내한 온라인 양식으로 담당자 통화를 요청한다.
4. 통화 중 일회성 코드를 제공한다.
5. Review Notes에 만료되는 코드를 미리 적어두지 않는다.

#### 장기 대안

통화 대응이 반복되거나 심사용 Google 계정을 안정적으로 유지할 수 없을 때만 완전한 데모 모드를 별도 프로젝트로 계획한다. 데모 모드는 캐릭터 생성, 피드, 댓글, DM, 신고, 계정 설정을 실제 기능과 같은 화면에서 보여줘야 하므로 이번 긴급 재심사 수정에 포함하지 않는다.

### Phase 4. 자동 테스트

#### 프런트엔드 도메인 테스트

`apps/frontend/tests/domain/capacitor-config.test.js`:

- `NSCameraUsageDescription` 존재
- 카메라 사용 목적 문자열이 비어 있지 않음
- 기존 Apple 플러그인 등록 유지

`apps/frontend/tests/domain/api-auth.test.js`:

- 웹 Google 로그인은 기존 브라우저 이동 유지
- iOS native Google 로그인은 `Browser.open()` 호출
- 네이티브 브라우저 URL은 HTTPS 절대 URL
- iOS native Apple 로그인은 Browser 플러그인을 사용하지 않음
- Android Google 로그인은 기존 동작 유지
- OAuth 콜백 성공 시 브라우저 닫기와 세션 교환 수행
- 오류 콜백 시 브라우저를 닫고 오류 표시
- 사용자가 브라우저를 닫으면 로딩 상태 해제
- Browser 열기 실패 시 오류 결과 반환
- 같은 로그인 요청을 빠르게 두 번 눌러도 한 흐름만 시작

#### 기존 전체 검사

```bash
npm run typecheck
npm run test:domain
npm run build
make backend-compile
make backend-test
```

앱 프로세스를 시작하는 명령은 실행하지 않는다. E2E 서버가 이미 실행 중인 경우에만 관련 Playwright 시나리오를 실행하고, 그렇지 않으면 아래 수동 검증 절차를 따른다.

### Phase 5. 실제 기기 및 릴리스 QA

#### 대상 기기

| 우선순위 | 기기 | 목적 |
|---|---|---|
| P0 | iPad Air 11-inch 또는 동급 실제 iPad, iPadOS 26.6 | 심사 환경 재현 |
| P0 | 실제 iPhone, 지원 중인 최신 iOS | 주 대상 기기 회귀 |
| P1 | iPad 시뮬레이터 | UI와 딥링크 보조 검증 |
| P1 | TestFlight 설치본 | App Store와 같은 서명·배포 경로 검증 |

카메라는 시뮬레이터만으로 승인하지 않는다. 실제 카메라가 있는 기기에서 통과해야 한다.

#### 카메라 매트릭스

각 이미지 입력 위치에서 다음을 반복한다.

| 시나리오 | 예상 결과 |
|---|---|
| 최초 `Take Photo` | 권한 안내 표시, 앱 유지 |
| 권한 허용 | 카메라 표시 |
| 촬영 취소 | 원래 화면 복귀, 기존 이미지 유지 |
| 촬영 후 사진 사용 | 미리보기 또는 이미지 반영 |
| 권한 거부 | 앱 유지, 재시도 가능 |
| 두 번째 촬영 | 권한 안내 없이 카메라 표시 |
| `Photo Library` 선택 | 사진 선택 후 반영 |
| `Photo Library` 취소 | 원래 화면 복귀 |
| `Choose File` 선택 | 지원 이미지 반영 |
| 고해상도 사진 | 메모리 종료 없이 반영 |
| 갤러리 다중 선택 | 선택한 이미지가 중복 없이 반영 |

#### Google 로그인 매트릭스

| 시나리오 | 예상 결과 |
|---|---|
| Google 버튼 | 앱 내부 Safari View Controller 표시 |
| 인증 화면 | 주소와 보안 상태 확인 가능 |
| 정상 로그인 | 앱 복귀, 세션과 캐릭터 로드 |
| `Done` 취소 | 앱 복귀, 버튼 재활성화 |
| Google 동의 거부 | 오류 안내 후 재시도 가능 |
| 네트워크 끊김 | 무한 로딩 없이 오류 안내 |
| 앱 백그라운드 후 복귀 | 진행 상태가 일관되게 유지 |
| 콜백 중복 수신 | 세션 코드가 한 번만 유효하게 처리 |
| 앱 강제 종료 후 재실행 | 저장된 세션이 있으면 복구 |
| Apple 로그인 | 기존 네이티브 인증 시트 정상 |

#### 계정 기능 회귀

- 신규 사용자 온보딩
- 기존 캐릭터 로드
- 로그아웃 후 재로그인
- 계정 및 모든 데이터 삭제
- 삭제 후 `/auth/me`가 인증되지 않은 상태 반환
- 개인정보처리방침, 이용약관, 계정 삭제 안내 URL 접근

### Phase 6. Release 아카이브 검증

#### 작업

1. 모든 구현과 QA가 끝난 뒤 `CURRENT_PROJECT_VERSION`을 `3`으로 올린다.
2. 프로덕션 API URL과 OAuth 환경 변수를 확인한다.
3. Capacitor 동기화 후 App Store Release 아카이브를 생성한다.
4. 아카이브 안의 최종 `Info.plist`를 직접 검사한다.
5. 다음 항목을 확인한다.
   - `CFBundleVersion = 3`
   - `NSCameraUsageDescription`
   - URL scheme `com.ashwoodfriends.alive`
   - `ITSAppUsesNonExemptEncryption = false`
6. 아카이브에 Browser 플러그인 네이티브 의존성이 포함됐는지 확인한다.
7. TestFlight에 업로드한다.
8. TestFlight 설치본에서 Phase 5의 P0 항목을 다시 수행한다.

#### 승인 기준

소스 파일에 키가 존재하는 것만으로 승인하지 않는다. App Store에 올릴 실제 `.xcarchive`의 최종 산출물을 검사해야 한다.

### Phase 7. App Store Connect 재심사

#### Review Notes 초안

```text
The issues from the previous review have been addressed in build 3.

1. Camera crash
We added the required iOS camera and photo-library purpose descriptions and verified the Take Photo flow on a physical iPad and iPhone. The app now displays the system permission prompt and remains stable when access is allowed, denied, or cancelled.

2. In-app Google sign-in
Google authentication is now presented inside the app using SFSafariViewController through the official Capacitor Browser plugin. The user can inspect the URL and security status without being sent to the standalone Safari app. Sign in with Apple continues to use the native Apple authorization sheet.

3. Review account
The review account below has no two-factor authentication requirement and contains sample characters, feed posts, images, and DM content.

Username: [REVIEW ACCOUNT]
Password: [REVIEW PASSWORD]

Suggested review path:
- Sign in with Google.
- Open the sample character.
- Tap Header Edit or + Upload Image.
- Choose Take Photo, Photo Library, or Choose File.
- Open Feed and DM to review the prepared sample content.

Account deletion is available in Home > Account Settings > Delete Account and All Data.

If Google unexpectedly requests an additional verification code, please contact the phone number in App Review Information so we can provide it immediately.
```

#### Resolution Center 답변 초안

```text
Hello,

Thank you for the review details.

We identified and fixed the crash that occurred after tapping Take Photo. The submitted build was missing the required camera purpose description. Build 3 includes the required privacy descriptions and has been tested on a physical iPad and iPhone.

We also changed Google sign-in so it is presented inside the app using SFSafariViewController instead of opening the standalone Safari app.

We updated the review account and Review Notes. The account has prepared sample content and should not require an additional authentication code. Our App Review contact phone number is also up to date in case Google requests unexpected verification.

Thank you.
```

#### 제출 전 확인

- Review Notes의 자리표시자를 실제 심사용 값으로 교체한다.
- 전화번호의 국가 코드와 수신 가능 시간을 확인한다.
- 심사용 계정 비밀번호를 제출 직전에 다시 검증한다.
- 새 빌드 `3`이 Processing 완료된 뒤 해당 빌드를 선택한다.
- 이전 빌드 `2`를 다시 선택하지 않는다.

## 8. 파일 영향 범위

| 파일 | 변경 유형 | 이유 |
|---|---|---|
| `ios/App/App/Info.plist` | 수정 | 카메라 사용 목적 선언 |
| `package.json` | 수정 | 공식 Capacitor Browser 의존성 |
| `package-lock.json` | 수정 | 의존성 잠금 |
| `apps/frontend/src/api/auth.ts` | 수정 | native Google OAuth를 앱 내부 브라우저로 실행 |
| `apps/frontend/tests/domain/api-auth.test.js` | 수정 | 플랫폼·성공·취소·오류 회귀 테스트 |
| `apps/frontend/tests/domain/capacitor-config.test.js` | 수정 | iOS 개인정보 키 정적 검사 |
| `ios/App/CapApp-SPM/Package.swift` | 생성 도구에 의한 수정 | Browser 플러그인 iOS 연결 |
| `ios/App/App.xcodeproj/project.pbxproj` | 제한적 수정 | 최종 빌드 번호 `3`; 기존 기기 설정 변경 보존 |
| `documents/qa/reports/report_app-store-rejection-remediation-simulator_2026-07-30.md` | 신규 | 시뮬레이터·에뮬레이터 QA 결과 |

백엔드 소스, 데이터베이스 모델, 마이그레이션은 변경하지 않는다.

## 9. 코드 경로 및 테스트 커버리지 계획

```text
CODE PATHS                                              USER FLOWS
[수정] Info.plist                                      [Take Photo]
  ├── [GAP][정적] Camera 목적 문자열                     ├── [GAP][실기기] 최초 허용
  └── [GAP][정적] Photo Library 목적 문자열              ├── [GAP][실기기] 거부
                                                        ├── [GAP][실기기] 취소
[수정] signInWithOAuthProvider()                        └── [GAP][실기기] 촬영 후 반영
  ├── [기존] iOS Apple -> native Apple
  ├── [GAP][단위] native Google -> Browser.open         [Google 로그인]
  └── [기존] web OAuth -> location.assign                 ├── [GAP][E2E] 성공과 앱 복귀
                                                          ├── [GAP][E2E] Done 취소
[수정] native OAuth callback                              ├── [GAP][E2E] Provider 거부
  ├── [GAP][단위] 성공 -> Browser.close -> exchange       ├── [GAP][E2E] 네트워크 오류
  ├── [GAP][단위] error -> close -> message                └── [GAP][E2E] 재실행 세션 복구
  ├── [GAP][단위] code 없음 -> 오류
  └── [GAP][단위] close 실패 -> exchange 계속            [심사용 접근]
                                                          ├── [GAP][수동] 깨끗한 iPad 로그인
[기존] backend OAuth + native exchange                    ├── [GAP][수동] 추가 인증 없음
  ├── [기존 테스트] state/redirect 검증                    └── [GAP][수동] 샘플 콘텐츠 확인
  └── [기존 테스트] 일회용 코드 소비
```

구현 전에는 새 경로가 모두 `GAP`이다. Phase 4와 Phase 5를 마친 뒤 각 항목을 테스트 파일 또는 QA 보고서의 근거로 교체한다.

## 10. 실패 모드

| 실패 모드 | 방지·처리 | 테스트 | 사용자 경험 |
|---|---|---|---|
| 카메라 목적 키 누락 | `Info.plist` 선언과 정적 회귀 테스트 | 도메인 + 실기기 | 권한 안내 후 카메라 |
| 권한 문자열이 빈 값 | 비어 있지 않은 문자열 검사 | 도메인 | 의미 있는 목적 표시 |
| 사용자가 카메라 거부 | 시스템 결과를 기존 파일 입력 취소로 처리 | 실기기 | 앱 유지, 재시도 가능 |
| 고해상도 사진으로 메모리 증가 | 실제 사진과 다중 선택 테스트 | 실기기 | 종료 없이 이미지 반영 |
| Browser에 상대 URL 전달 | 열기 전 절대 URL 변환 | 단위 | 인증 화면 정상 |
| Browser 플러그인 미동기화 | SPM 산출물과 아카이브 검사 | 정적 + 아카이브 | 플러그인 미구현 오류 방지 |
| 사용자가 `Done` 선택 | `browserFinished` 처리 | 단위 + 실기기 | 로딩 해제 |
| 성공 콜백과 종료 이벤트 경합 | 프로그램 종료 상태 구분 | 단위 | 로그인 화면 깜빡임 최소화 |
| `Browser.close()` 실패 | 세션 교환과 독립적으로 처리 | 단위 | 로그인은 계속 완료 |
| 딥링크 scheme 불일치 | 기존 scheme 정적·실기기 확인 | 도메인 + E2E | 앱으로 정상 복귀 |
| 일회용 코드 중복 소비 | 기존 서버 잠금·소비 로직 유지 | 기존 백엔드 테스트 | 두 번째 요청 거부 |
| 심사용 Google 계정 추가 인증 | 깨끗한 기기 사전 검증, 전화 대응 | 수동 | 심사 중단 최소화 |
| 심사용 샘플 데이터 삭제 | 제출 직전 내용 확인 | 수동 | 주요 기능 즉시 검토 가능 |
| 빌드 번호 중복 | 최종 단계에서 `3` 확인 | 아카이브 | App Store 업로드 가능 |

고해상도 사진 테스트에서 메모리 종료가 재현되면 이미지 리사이즈·압축을 별도 P1 수정으로 추가한다. 재현되지 않으면 이번 반려 대응에 포함하지 않는다.

## 11. 작업 순서와 병렬화

### 의존성

| 단계 | 모듈 | 선행 작업 |
|---|---|---|
| A. 크래시 로그 확인 | App Store/Xcode, `documents/qa` | 없음 |
| B. 개인정보 키와 정적 테스트 | `ios/App/App`, frontend domain tests | A |
| C. Browser 의존성과 OAuth 구현 | root package, frontend auth, iOS SPM | 없음 |
| D. 인증 자동 테스트 | frontend domain tests | C |
| E. 심사용 계정과 샘플 데이터 | App Store Connect, 운영 계정 | 없음 |
| F. 실제 기기 QA | iOS/iPadOS release app | B, C, D, E |
| G. 빌드 3 아카이브와 제출 | Xcode, App Store Connect | F |

### 병렬 레인

```text
Lane A: 크래시 로그 확인 -> 개인정보 키 -> 카메라 정적 테스트
Lane B: Browser 의존성 -> OAuth 구현 -> 인증 단위 테스트
Lane C: 심사용 계정 정리 -> 샘플 데이터 -> Review Notes 준비

Lane A + Lane B + Lane C 병렬 진행 가능
                |
                v
       통합 자동 테스트와 실제 기기 QA
                |
                v
         Release 아카이브와 재제출
```

Lane A와 Lane B 모두 iOS 네이티브 산출물에 영향을 줄 수 있다. `npx cap sync`는 Lane B 완료 후 한 번만 최종 실행해 생성 파일 충돌을 줄인다.

## 12. 롤백 전략

### Browser 변경 롤백

- 자동 테스트나 실제 기기에서 OAuth 콜백이 안정적으로 완료되지 않으면 빌드 번호를 올리지 않는다.
- `window.location.assign()`으로 되돌린 빌드는 외부 브라우저 반려가 다시 발생하므로 재제출하지 않는다.
- Capacitor Browser 방식이 실패하면 다음 대안은 직접 만든 `ASWebAuthenticationSession` Capacitor 플러그인이다.
- Google Sign-In iOS SDK 전환은 별도 client ID와 백엔드 토큰 검증 변경이 필요하므로 마지막 대안으로 둔다.

### 카메라 변경 롤백

- 개인정보 목적 문자열은 카메라 기능이 존재하는 동안 제거하지 않는다.
- 사진 촬영이 여전히 종료되면 크래시 로그의 두 번째 원인을 조사하고, 카메라 메뉴 자체를 숨기는 방식으로 우회하지 않는다.

### 제출 롤백

- TestFlight P0 시나리오가 하나라도 실패하면 심사 제출을 취소한다.
- 이미 제출한 뒤 운영 인증 장애가 발생하면 Resolution Center에 즉시 알리고 수정 빌드를 준비한다.

## 13. 이번 작업에서 제외

- Google Sign-In iOS SDK 전체 전환: 현재 백엔드 OAuth와 딥링크를 재사용하는 편이 변경 범위가 작다.
- 일반 `WKWebView`에 Google 로그인 삽입: Google의 embedded user-agent 정책과 맞지 않는다.
- Capacitor Camera 플러그인 도입: 현재 HTML 파일 입력을 유지해도 반려 원인을 해결할 수 있다.
- 전체 iPad 반응형 UI 재설계: 이번 목표는 iPad 호환 모드에서 기능과 안정성을 보장하는 것이다.
- 심사 전용 비밀번호, 고정 OTP, 숨겨진 인증 우회 API: 운영 환경에 보안 백도어를 만들 수 있다.
- 완전한 데모 모드: 심사용 계정과 통화 대응이 실패할 때 별도 계획으로 추진한다.
- 백엔드 OAuth 데이터 모델 변경: 이번 반려 사유와 무관하다.
- 계정 삭제 재구현: 앱 내 삭제 버튼과 API가 이미 존재한다.
- 이미지 저장 방식 전체 개편: 실제 기기에서 메모리 문제가 재현될 때만 별도 처리한다.

## 14. 구현 작업 목록

진행 상태는 2026-07-30 로컬 작업 결과를 기준으로 한다. 시뮬레이터에서 통과했더라도 실제 기기나 App Store Connect 권한이 필요한 항목은 완료 처리하지 않았다.

- [ ] **T1 (P1)** App Store Connect에서 빌드 `2`의 `.ips`와 dSYM을 확보하고 크래시 원인을 확정한다.
  - 검증: 심볼리케이트된 종료 사유를 QA 보고서에 기록
- [x] **T2 (P1)** `Info.plist`에 카메라 사용 목적을 추가한다.
  - 검증 완료: `plutil -lint` 통과, 도메인 정적 테스트 통과, Debug 앱 산출물에서 목적 문자열 확인
- [x] **T3 (P1)** `@capacitor/browser` 8.x를 설치하고 iOS 네이티브 의존성을 동기화한다.
  - 검증 완료: `@capacitor/browser` 8.0.4 설치, iOS SPM 및 Android Gradle 동기화, 양쪽 Debug 빌드 통과
  - 남은 확인: Release 아카이브 검사는 T9에서 수행
- [x] **T4 (P1)** native Google OAuth를 `Browser.open()`으로 전환한다.
  - 검증 완료: iPad Air 11-inch (M3) 시뮬레이터에서 앱 내부 Safari View Controller와 `accounts.google.com` 표시 확인
- [ ] **T5 (P1)** 성공·오류 딥링크와 사용자 브라우저 취소 상태를 완결한다.
  - 구현 완료: 성공 콜백 브라우저 종료, `browserFinished` 취소 처리, 중복 열기 방지, 닫기 실패와 세션 교환 분리
  - 남은 검증: 실제 기기에서 Google 성공·취소·Provider 오류·네트워크 오류 확인
- [x] **T6 (P1)** 카메라와 인증 회귀 테스트를 추가하고 전체 테스트를 통과시킨다.
  - 검증 완료: 타입 검사, 도메인 테스트 86개, 프런트 빌드, 백엔드 테스트 135개 통과
- [ ] **T7 (P1)** 실제 iPad와 iPhone에서 카메라·Google·Apple·계정 삭제를 검증한다.
  - 부분 완료: iPad 시뮬레이터에서 `Take Photo` 카메라 진입·취소·앱 복귀 통과
  - 부분 완료: Pixel 9 Android 에뮬레이터에서 기존 Chrome 로그인 이동과 앱 복귀 통과
  - 남은 검증: 실제 iPad·iPhone 전체 매트릭스
- [ ] **T8 (P1)** 심사용 Google 계정의 추가 인증을 제거하고 샘플 데이터를 준비한다.
  - 검증: 초기화된 iPad에서 두 번 독립 로그인
- [x] **T9 (P1)** 빌드 번호를 `3`으로 올리고 App Store Release 아카이브를 검사한다.
  - 검증 완료: iOS `1.0.0 (3)` Release 아카이브 생성, 최종 앱 `Info.plist`의 버전·카메라 권한 문자열 확인
  - 검증 완료: Capacitor 동기화에서 Browser 8.0.4 포함 확인, App Store Connect 업로드 성공
- [ ] **T10 (P1)** TestFlight P0 검증 후 Review Notes와 Resolution Center 답변을 제출한다.
  - 부분 완료: 빌드 `1.0.0 (3)`을 App Store Connect에 업로드했으며 Apple 처리 대기 중
  - 남은 검증: 처리 완료 후 TestFlight 설치본 P0 검증, Review Notes와 Resolution Center 답변 제출
  - 검증: 새 빌드 `3` 선택과 Review Notes 자리표시자 제거

## 15. 최종 출고 체크리스트

### 코드

- [x] `NSCameraUsageDescription` 존재
- [x] 권한 문구가 실제 기능을 설명
- [x] native Google은 `Browser.open()` 사용
- [x] web Google은 기존 흐름 유지
- [x] iOS Apple은 기존 네이티브 흐름 유지
- [x] 성공 콜백에서 브라우저 종료
- [x] 사용자 취소에서 로딩 해제
- [x] 토큰과 인증 코드를 로그에 남기지 않음

### 자동 검증

- [x] `npm run typecheck`
- [x] `npm run test:domain`
- [x] `npm run build`
- [x] `make backend-compile`
- [x] `make backend-test`
- [x] `plutil -lint ios/App/App/Info.plist`

### 시뮬레이터·에뮬레이터

- [x] iPad Air 11-inch (M3), iPadOS 26.3 앱 빌드·실행
- [x] iPad `Take Photo` 선택 후 카메라 표시
- [x] 카메라 취소 후 앱 복귀
- [x] iOS Google Safari View Controller 표시
- [x] Android Pixel 9, API 36 앱 빌드·실행
- [x] Android Google 로그인의 기존 Chrome 이동 유지
- [x] Android 브라우저에서 앱 복귀

### 실제 기기

- [ ] 실제 iPad `Take Photo`
- [ ] 실제 iPad `Photo Library`
- [ ] 실제 iPad `Choose File`
- [ ] 실제 iPhone 동일 시나리오
- [ ] Google 성공
- [ ] Google 사용자 취소
- [ ] Google 네트워크 오류
- [ ] Apple 로그인 회귀
- [ ] 세션 재실행 복구
- [ ] 계정 삭제

### 심사 운영

- [ ] 전용 심사용 계정
- [ ] 추가 인증 없음
- [ ] 샘플 캐릭터와 콘텐츠
- [ ] 전화번호 최신 상태
- [ ] Review Notes 영어 작성
- [ ] Resolution Center 답변
- [x] 빌드 `1.0.0 (3)` 업로드
- [ ] 처리 완료된 빌드 `1.0.0 (3)` 선택

## 16. 참고 자료

- Apple `NSCameraUsageDescription`: <https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription>
- Apple `SFSafariViewController`: <https://developer.apple.com/documentation/safariservices/sfsafariviewcontroller>
- Apple `ASWebAuthenticationSession`: <https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession>
- Apple App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Capacitor Browser v8: <https://capacitorjs.com/docs/apis/browser>
- Google OAuth 2.0 policies: <https://developers.google.com/identity/protocols/oauth2/policies>
- Google OAuth for iOS and installed apps: <https://developers.google.com/identity/protocols/oauth2/native-app>
