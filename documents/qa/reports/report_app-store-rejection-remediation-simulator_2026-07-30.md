---
title: App Store 반려 대응 시뮬레이터 QA 보고서
created: 2026-07-30
status: partial
---

# App Store 반려 대응 시뮬레이터 QA 보고서

## 범위

App Store 심사 반려 항목 중 카메라 실행 크래시, iOS Google 로그인 표시 방식, Android 회귀 여부를 로컬 시뮬레이터와 에뮬레이터에서 확인했다.

## 환경

| 플랫폼 | 기기 | OS | 결과 |
|---|---|---|---|
| iOS | iPad Air 11-inch (M3) | iPadOS 26.3 | 통과 |
| Android | Pixel 9 | Android API 36-ext17 | 통과 |

심사 환경은 iPadOS 26.6이지만 로컬에 설치된 가장 가까운 런타임은 26.3이다.

## 구현 확인

- `Info.plist`에 `NSCameraUsageDescription`을 추가했다.
- 공식 `@capacitor/browser` 8.0.4를 iOS와 Android 네이티브 프로젝트에 동기화했다.
- iOS native Google 로그인만 `Browser.open()`을 사용한다.
- Android와 Web의 Google 로그인은 기존 `window.location.assign()` 흐름을 유지한다.
- OAuth 성공 콜백에서 인앱 브라우저를 닫고 기존 네이티브 세션 교환을 수행한다.
- 사용자 브라우저 취소와 중복 Google 로그인 요청을 처리한다.

## 시뮬레이터 시나리오

| 시나리오 | 관찰 결과 | 판정 |
|---|---|---|
| iPad에서 Google 버튼 선택 | 앱 위에 Safari View Controller가 표시됨 | 통과 |
| iOS 인증 화면의 주소 확인 | `accounts.google.com` 도메인과 닫기 버튼 표시 | 통과 |
| 캐릭터 프로필에서 이미지 편집 선택 | `Photo Library`, `Take Photo`, `Choose File` 메뉴 표시 | 통과 |
| `Take Photo` 선택 | 시스템 카메라 UI 표시, 앱 종료 없음 | 통과 |
| 카메라 취소 | 캐릭터 프로필로 복귀, 앱 유지 | 통과 |
| Android 로그인 화면 | Google 버튼만 표시되고 앱이 정상 실행됨 | 통과 |
| Android Google 버튼 선택 | 외부 Chrome이 최상위 Activity가 됨 | 통과 |
| Android 브라우저에서 뒤로 이동 | `com.ashwoodfriends.alive/.MainActivity`로 복귀 | 통과 |

## 자동 검사

| 검사 | 결과 |
|---|---|
| `plutil -lint ios/App/App/Info.plist` | 통과 |
| 프런트엔드 타입 검사 | 통과 |
| 프런트엔드 도메인 테스트 | 86개 통과 |
| 프런트엔드 프로덕션 빌드 | 통과 |
| Playwright 시나리오 목록 로드 | 5개 확인 |
| 백엔드 Python 컴파일 | 통과 |
| 백엔드 테스트 | 135개 통과 |
| iPad Simulator Debug 빌드 | 통과 |
| Android Debug APK 빌드 | 통과 |

## 남은 검증

다음 항목은 시뮬레이터만으로 승인할 수 없거나 외부 계정·배포 권한이 필요해 아직 완료하지 않았다.

- 실제 iPad와 iPhone에서 최초 카메라 권한 허용·거부, 촬영, 사진 사용 검증
- Google 로그인 완료 후 딥링크 복귀와 세션 생성 검증
- Google 로그인 취소, 동의 거부, 네트워크 오류 검증
- 심사용 Google 계정의 추가 인증 제거와 초기화 기기 독립 로그인 2회
- Apple 로그인과 계정 삭제 회귀 검증
- 빌드 번호 3 적용, Release 아카이브, TestFlight 설치본 검증
- App Store Connect 첨부 크래시 로그 심볼리케이션

따라서 현재 결과는 코드 및 시뮬레이터 단계 통과이며, App Store 재제출 최종 승인 결과는 아니다.
