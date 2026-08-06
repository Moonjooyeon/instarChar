---
title: iOS Apple 로그인 시뮬레이터 QA
author: black (black@ashwoodfriends.com)
created: 2026-07-28
updated: 2026-07-28
version: 1.0.0
status: review
---

# iOS Apple 로그인 시뮬레이터 QA

## 테스트 환경

- 기기: iPhone 17 Pro Max 시뮬레이터
- OS: iOS 26.3
- 앱 ID: `com.ashwoodfriends.alive`
- 앱 버전: `1.0.0 (1)`
- 범위: 로그인 화면에서 Apple 네이티브 인증 시작

## 결과

Apple 로그인 버튼은 정상적으로 노출되고 입력도 받지만, 인증 시트가 열리지 않는다.
두 번 연속 실행했을 때 모두 다음 오류가 화면에 표시됐다.

```text
"AppleSignIn" plugin is not implemented on ios
```

Apple 인증 정보가 생성되지 않아 운영 백엔드의 `/api/auth/apple/native` 요청까지는 도달하지 못했다.

## 원인 확인

`AppleSignIn` Swift 클래스는 앱 바이너리에 컴파일되어 있지만 Capacitor 브리지에 등록되지 않았다.

- JavaScript는 `AppleSignIn` 이름으로 네이티브 플러그인을 호출한다.
- 앱의 스토리보드는 기본 `CAPBridgeViewController`를 사용한다.
- 생성된 Capacitor 플러그인 목록에는 `AppPlugin`만 포함된다.
- 별도의 `capacitorDidLoad()` 등록 코드가 없다.

따라서 Capacitor가 `AppleSignIn` 구현을 찾지 못하고 미구현 오류를 반환한다.

## 판정

| 항목 | 결과 |
|------|------|
| 로그인 화면 표시 | 통과 |
| Apple 버튼 입력 | 통과 |
| 네이티브 플러그인 호출 | 실패 |
| Apple 인증 시트 표시 | 차단 |
| 운영 백엔드 인증 교환 | 미실행 |

상태: **BLOCKED**
