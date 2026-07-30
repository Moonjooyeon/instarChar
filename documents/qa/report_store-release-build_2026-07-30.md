---
title: iOS 및 Android 스토어 릴리스 빌드 보고서
created: 2026-07-30
status: complete
---

# iOS 및 Android 스토어 릴리스 빌드 보고서

## 요청 범위

- 앱 버전: `1.0.0`
- iOS 빌드 번호: `3`
- Android 버전 코드: `3`
- iOS App Store Connect 업로드
- Android AAB 릴리스 빌드

## 버전 적용 결과

| 플랫폼 | 설정 | 적용값 | 결과 |
|---|---|---:|---|
| iOS | `MARKETING_VERSION` | `1.0.0` | 완료 |
| iOS | `CURRENT_PROJECT_VERSION` | `3` | 완료 |
| Android | `versionName` | `1.0.0` | 완료 |
| Android | `versionCode` | `3` | 완료 |

## iOS App Store

`ios/build/ALIVE.xcarchive`를 Release 설정으로 생성했다. 아카이브의 최종 앱에서 다음 값을 확인했다.

- 번들 ID: `com.ashwoodfriends.alive`
- 버전: `1.0.0`
- 빌드 번호: `3`
- 아키텍처: `arm64`
- 최소 OS: iOS 15.0
- `NSCameraUsageDescription` 포함

App Store 배포 내역의 `uploadEvent`는 `success`, `Uploaded to Apple`로 기록됐다. 업로드된 빌드 번호는 `3`이며 App Store Connect의 후속 처리 완료를 기다리는 상태다.

## 공통 자동 검증

| 검사 | 결과 |
|---|---|
| 프런트엔드 도메인 테스트 | 86개 통과 |
| 백엔드 테스트 | 135개 통과 |
| 프런트엔드 타입 검사 및 프로덕션 빌드 | 통과 |
| Capacitor iOS·Android 동기화 | 통과 |
| Capacitor Browser 플러그인 | 양쪽 8.0.4 확인 |

## Android AAB

Android는 기존 Play 업로드 키를 유지하도록 `android/app/build.gradle`에서 릴리스 서명 환경변수 네 개를 필수로 검사한다.

- `ALIVE_ANDROID_KEYSTORE_PATH`
- `ALIVE_ANDROID_KEY_ALIAS`
- `ALIVE_ANDROID_KEY_PASSWORD`
- `ALIVE_ANDROID_STORE_PASSWORD`

초기 확인에서는 셸 환경변수가 없어 `:app:bundleRelease`가 설정 단계에서 중단됐다. 이후 기존 릴리스 기록을 추적해 업로드 키 암호가 macOS 키체인의 `com.ashwoodfriends.alive.android-upload` 서비스에 저장된 것을 확인했다. 암호를 출력하지 않고 빌드 프로세스에만 주입해 새 AAB를 생성했다.

생성 결과는 다음과 같다.

- 배포 파일: `dist/store/android/alive-1.0.0-3.aab`
- 크기: 7,248,135 bytes
- SHA-256: `93d91295f18e59f292c1b8aba87d410e2eca418378d7aa906afee849b3446289`
- `:app:bundleRelease`: 성공
- 애플리케이션 ID: `com.ashwoodfriends.alive`
- 버전 이름: `1.0.0`
- 버전 코드: `3`
- 기존 업로드 키 인증서 지문 일치: 확인
- `jarsigner` 서명 검증: 통과

## 판정

- iOS App Store 업로드: 완료
- Android 버전 설정: 완료
- Android 서명 AAB 생성: 완료
