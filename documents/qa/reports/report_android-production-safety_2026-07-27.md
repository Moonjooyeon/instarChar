---
title: Android 운영 백엔드 연동 QA 보고서
author: black (black@ashwoodfriends.com)
created: 2026-07-27
updated: 2026-07-27
version: 1.0.0
status: partial
---

# Android 운영 백엔드 연동 QA 보고서

- 테스트 일시: 2026-07-27 (KST)
- 브랜치 / 커밋: `main` / `fd3891b`
- 앱 패키지: `app.instarcharacterbot.alive`
- 기기: Android Emulator `emulator-5554` (Pixel 9, 1080×2424)
- 운영 API: `https://alive.imagebgremover.net`
- 빌드 설정: `CAP_API_URL=https://alive.imagebgremover.net`

## 결과 요약

Android 앱의 운영 빌드, 설치, 실행 및 운영 백엔드 인증 연동은 정상이다. 신고 UI, 신고 사유 선택, 계정 삭제 확인 및 취소 흐름도 정상 동작했다. 테스트 중 앱 크래시나 관련 WebView/Capacitor 오류는 발견되지 않았다.

스토어 제출 전에 해결해야 할 높은 우선순위 문제가 1건 있다. 앱에서 제공하는 개인정보처리방침, 이용약관, 계정 삭제 안내 URL이 운영 서버에서 모두 `404 Not Found`를 반환한다.

## 통과 항목

| 항목 | 결과 | 확인 내용 |
| --- | --- | --- |
| Android 운영 빌드 | PASS | Vite 빌드, Capacitor sync, Gradle 빌드 성공 |
| 에뮬레이터 설치 및 실행 | PASS | APK 설치 후 앱 정상 실행 |
| 운영 데이터 로드 | PASS | 기존 로그인 계정과 캐릭터·피드 데이터 로드 |
| 안전 약관 동의 상태 API | PASS | `GET /api/safety/consent` → `200`, `accepted=true`, `termsVersion=2026-07-24` |
| 차단 목록 API | PASS | `GET /api/safety/blocks` → `200`, `user_ids=[]` |
| 신고 진입 | PASS | 게시물의 `신고` 액션으로 신고 모달 진입 |
| 신고 사유 | PASS | 성적·음란, 괴롭힘·위협, 혐오·차별, 폭력적 콘텐츠, 자해·자살 조장, 불법 행위, 사칭, 개인정보 침해, 저작권 침해, 스팸, 기타 노출 |
| 신고 취소 | PASS | 운영 신고를 접수하지 않고 모달 취소 후 피드 복귀 |
| 계정 삭제 보호 흐름 | PASS | 영구 삭제 경고와 취소 버튼 확인, 취소 후 계정 유지 |
| 앱 안정성 | PASS | 테스트 구간에 앱 크래시 및 관련 런타임 오류 없음 |

## 발견된 문제

### HIGH — 법적 문서 URL이 모두 404

다음 운영 URL이 모두 HTTP `404`와 `{"detail":"Not Found"}`를 반환한다.

- `https://alive.imagebgremover.net/privacy/`
- `https://alive.imagebgremover.net/terms/`
- `https://alive.imagebgremover.net/account-deletion/`

앱에서 개인정보처리방침 링크를 누르면 Chrome에 `{"detail":"Not Found"}`가 표시된다. 개인정보처리방침과 계정 삭제 안내 URL은 앱 스토어 등록 및 심사에 직접 사용되므로, 공개 접근 가능한 문서 URL을 연결한 뒤 재검증해야 한다.

## 제한된 테스트 범위

- 실제 신고 접수는 운영 데이터 변경을 피하기 위해 수행하지 않았다.
- 실제 계정 삭제는 되돌릴 수 없어 수행하지 않았다.
- 공개 캐릭터 탐색 결과가 `DB 불러옴 0개 · 표시 0개`여서 다른 사용자 차단 UI와 차단 후 콘텐츠 숨김은 검증하지 못했다.
- 현재 계정이 약관 버전 `2026-07-24`에 이미 동의한 상태라 최초 동의 모달은 검증하지 못했다.

## 재검증 조건

1. 세 법적 문서 URL을 공개 접근 가능한 페이지로 배포한다.
2. 테스트용 공개 사용자 또는 캐릭터를 준비한다.
3. 운영 데이터에 영향을 주지 않는 테스트 계정으로 신고 접수, 차단, 차단 해제, 콘텐츠 숨김을 검증한다.
