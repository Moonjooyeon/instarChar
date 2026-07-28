---
title: Mobile Store Release Readiness
author: black (black@ashwoodfriends.com)
created: 2026-07-24
updated: 2026-07-24
version: 0.3.0
status: review
---

# 모바일 스토어 출시 준비 현황

## 출시 대상

| 항목 | 값 |
|---|---|
| 앱 이름 | ALIVE |
| 패키지·번들 ID | `com.ashwoodfriends.alive` |
| Android 버전 | `1.0.0` (`versionCode` 1) |
| iOS 버전 | `1.0.0` (`build` 1) |
| Android 대상 API | 36 |
| iOS 최소 버전 | 15.0 |
| 기본 API | `https://alive.imagebgremover.net/api` |

## 완료

- [x] Google Play 2026년 신규 앱 기준인 Android API 36 적용
- [x] Android App Bundle 릴리스 서명 환경 변수 연결
- [x] iOS App Store 아카이브 명령 추가
- [x] iOS 수출 규정용 비면제 암호화 미사용 선언
- [x] Android 앱 데이터 백업 비활성화
- [x] 앱 계정과 연결 데이터를 영구 삭제하는 API 및 앱 내 메뉴 추가
- [x] 공유 DM에서 삭제 사용자가 포함된 대화 데이터 제거
- [x] 계정 삭제 프론트·백엔드 테스트 추가
- [x] 기본 Capacitor 아이콘을 ALIVE 전용 아이콘으로 교체
- [x] Google Play 512×512 아이콘과 1024×500 피처 그래픽 생성
- [x] Android 서명 없는 릴리스 컴파일 성공
- [x] iOS 서명 없는 App Store용 아카이브 성공
- [x] 개인정보처리방침, 이용약관, 계정 삭제 안내 페이지 작성
- [x] 앱 홈에 개인정보처리방침, 이용약관, 계정 삭제 안내 링크 노출
- [x] 법률 페이지 운영 주체와 문의 이메일 반영
- [x] 최초 커뮤니티 이용약관 동의와 버전 기록 구현
- [x] 공개 캐릭터, 게시물, 댓글, 공유 DM, AI 생성물 앱 내 신고 구현
- [x] 사용자 차단과 양방향 탐색·공유 DM 제한 구현
- [x] 공개 게시 전 유해 콘텐츠 기본 필터 구현
- [x] 운영자 신고 큐, 상태 전이, 콘텐츠 삭제, 계정 정지·차단 API 구현
- [x] 운영 CLI와 72시간 내 일반 신고 대응 절차 문서화

## 심사 전 필수

- [ ] 개인정보처리방침 공개 URL 배포 및 접속 확인
- [ ] Google Play 계정 삭제 요청 공개 URL 배포 및 접속 확인
- [ ] 운영 환경에 `20260724_0006` 데이터베이스 마이그레이션 적용
- [ ] 운영 환경에 `MODERATION_API_KEY`, `MODERATION_ACTOR`, `TERMS_VERSION` 설정
- [ ] 실제 운영 담당자와 신고 큐 점검 일정을 확정
- [ ] Apple Developer 팀과 배포 인증서를 Xcode에 연결
- [ ] Android 업로드 키 생성 또는 기존 키 연결
- [ ] App Store Connect와 Play Console 앱 레코드 생성 확인
- [ ] 실제 릴리스 빌드로 최종 스크린샷 촬영
- [ ] 스토어 개인정보·데이터 보안 설문 작성
- [ ] 심사용 테스트 계정과 리뷰 메모 준비

## 필요한 사용자 정보

- 선택 사항: 개인정보보호 담당자명, 사업자 주소, 지원 전화번호
- Apple Developer Team ID 또는 Xcode 계정 연결
- Google Play Console 접근 권한
- Android 업로드 키를 새로 만들지, 기존 키를 사용할지 결정

## 법률 페이지 URL

- 개인정보처리방침: `https://alive.imagebgremover.net/privacy/`
- 이용약관: `https://alive.imagebgremover.net/terms/`
- 계정 삭제 안내: `https://alive.imagebgremover.net/account-deletion/`

기본 도메인은 `VITE_LEGAL_BASE_URL`로 교체할 수 있다. 현재 문서는 주식회사 애쉬우드프렌즈와 `ashwoodfriends@ashwoodfriends.com`을 기준으로 작성한 출시 준비용 초안이다.

## 릴리스 명령

Android 서명 환경 변수를 설정한 뒤 실행한다.

```bash
export ALIVE_ANDROID_KEYSTORE_PATH="/absolute/path/to/alive-upload.jks"
export ALIVE_ANDROID_KEY_ALIAS="alive-upload"
export ALIVE_ANDROID_STORE_PASSWORD="..."
export ALIVE_ANDROID_KEY_PASSWORD="..."
make android-bundle-release
```

iOS는 Xcode에 배포 계정과 팀을 연결한 뒤 실행한다.

```bash
make ios-archive-release
```

## 정책 근거

- [Apple 앱 내 계정 삭제](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Apple 사용자 생성 콘텐츠 심사 지침](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play 계정 삭제](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play 사용자 생성 콘텐츠](https://support.google.com/googleplay/android-developer/answer/9876937)
- [Google Play AI 생성 콘텐츠](https://support.google.com/googleplay/android-developer/answer/13985936)
- [Google Play 대상 API 요구사항](https://developer.android.com/google/play/requirements/target-sdk)
