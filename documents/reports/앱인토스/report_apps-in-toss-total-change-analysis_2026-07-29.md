---
title: ALIVE 앱인토스 전환 전체 변경 범위 분석
author: black (black@ashwoodfriends.com)
created: 2026-07-29
updated: 2026-07-29
version: 1.0.0
status: draft
---

# ALIVE 앱인토스 전환 전체 변경 범위 분석

## 결론

`alive`를 앱인토스로 출시하는 일은 기존 iOS·Android 독립 앱을 대체하는 작업이 아니다. 공통 도메인(캐릭터, 피드, DM, 관계, 신고, 서버 저장)은 재사용하고, **앱인토스 전용 WebView 빌드·라이트 UI·토스 로그인·AI 안전 표시·검수용 운영 흐름**을 별도로 추가하는 작업이다.

현재 코드에는 서버 저장, 계정 삭제, 신고·차단, 약관 동의, 콘텐츠 안전 검사라는 좋은 기반이 있다. 반면, 앱인토스 필수 요건인 토스 로그인, mTLS, 라이트 모드, AI 결과물 표시, 미니앱 내 완결성은 아직 준비되지 않았다.

> 분석 기준일: 2026-07-29. 이 문서는 코드 변경 전 갭 분석이며, 정책의 최종 해석과 AI 캐릭터 DM의 서비스 분류는 앱인토스 채널톡 사전 검토 결과를 따른다.

## 현재 상태 요약

| 영역 | 현재 구현 | 앱인토스 적합도 | 판단 |
| --- | --- | --- | --- |
| 프런트엔드 | React 18 + Vite + Capacitor 8 | 부분 적합 | WebView SDK 전용 빌드 추가 필요 |
| 독립 앱 로그인 | Google OAuth, Apple OAuth, 네이티브 Apple 로그인 | 미니앱 부적합 | 미니앱에서 비노출·비호출 필요 |
| 서버 세션 | FastAPI 쿠키 세션과 자체 PostgreSQL | 재사용 가능 | 토스 로그인 세션 발급 추가 필요 |
| 사용자 모델 | `google`, `apple` 공급자 | 부분 적합 | `toss` 공급자와 DB 마이그레이션 필요 |
| 캐릭터·피드·DM | 자체 DB와 API | 재사용 가능 | AI 표시·안전 검증 보강 필요 |
| 신고·차단·약관 동의 | API·UI·운영자 검토 API 존재 | 좋은 기반 | SLA·AI 안전 운영 절차 보강 필요 |
| 콘텐츠 안전 | 일부 정규식 차단 | 부족 | 문맥 기반 입력·출력 안전 및 자해 대응 필요 |
| UI | 다크 테마, 자체 CSS 약 1,025줄 | 미니앱 부적합 위험 | 라이트 테마와 TDS 기준 UI 필요 |
| 법률 문서 | 개인정보처리방침·약관·계정 삭제 안내 존재 | 부분 적합 | 토스 로그인·AI 표시·데이터 흐름 내용 갱신 필요 |
| 배포·테스트 | Capacitor·Playwright 중심 | 부분 적합 | `.ait` 번들·토스 샌드박스 QA 추가 필요 |

## 변경 전략

### 유지할 것

다음은 버리지 않고 공통 기반으로 유지한다.

- FastAPI + PostgreSQL, 캐릭터·프로필·피드·댓글·DM·관계 데이터 모델
- 생성형 AI 호출, 자동 게시 스케줄러, 사용량 제한
- 신고, 차단, 콘텐츠 신고 큐, 운영자 제재 API
- 계정 삭제와 정책 동의 저장 구조
- 캐릭터 생성·피드·DM의 핵심 도메인 로직
- 독립 앱의 Capacitor 설정과 Google·Apple 로그인

### 앱인토스에서만 변경할 것

- 로그인 제공자와 로그인 UI
- SDK 초기화, `.ait` 번들 생성, 앱인토스 라우팅·내비게이션
- 라이트 테마와 TDS 기반 컴포넌트
- AI 고지·AI 생성 배지·안전 응답
- 외부 링크·공유·결제·광고의 허용 범위
- CORS, mTLS, 토스 로그인 계정과 세션

### 초기 MVP에서 비노출 또는 보류할 것

- Google·Apple 로그인과 외부 OAuth 리디렉션
- App Store·Google Play 다운로드 링크, 앱 설치 혜택, 외부 가입 유도
- 외부 결제, 외부 PG, 외부 광고 네트워크
- 유료 구독·프리미엄 기능, 인앱 광고, 토스 포인트 프로모션
- 실제 이용자 간 공개 프로필 DM, 랜덤 연결, 만남·소개팅으로 해석될 여지가 있는 기능
- 기존 독립 앱과 토스 계정을 자동으로 병합하는 기능

## 변경·추가·비노출 상세 목록

### 1. 빌드와 실행 환경

| 구분 | 조치 | 현재 영향 위치 | 규모 | 출시 전 필수 |
| --- | --- | --- | --- | --- |
| 변경 | 앱인토스 WebView SDK와 TDS 의존성 추가 | `apps/frontend/package.json` | 중 | 예 |
| 추가 | `granite.config.ts`와 앱인토스 전용 빌드 명령 | `apps/frontend/` | 중 | 예 |
| 추가 | 독립 앱·웹·앱인토스 런타임을 구분하는 어댑터 | 새 프런트엔드 런타임 모듈 | 중 | 예 |
| 변경 | 앱인토스 실행 시 자체 상단·하단 내비게이션의 충돌 제거 | `App.tsx`, 라우트 컴포넌트, `appStyles.ts` | 중 | 예 |
| 유지 | `capacitor.config.json`, `ios/`, `android/` | 독립 앱 배포 경로 | 없음 | 예, 유지 |

현재 앱은 Capacitor 네이티브 여부로 OAuth 리디렉션과 Apple 로그인 동작을 결정한다. 앱인토스는 iOS·Android에서 실행되더라도 Capacitor 독립 앱이 아니므로, 플랫폼 OS가 아니라 **배포 런타임**으로 분기해야 한다.

출처: [기존 웹 프로젝트 SDK 연동](https://developers-apps-in-toss.toss.im/tutorials/webview.html), [앱인토스 실행 환경](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%98%EA%B2%BD%20%ED%99%95%EC%9D%B8/runtime-environment.html)

### 2. 인증과 계정

| 구분 | 조치 | 현재 영향 위치 | 규모 | 출시 전 필수 |
| --- | --- | --- | --- | --- |
| 비노출 | Google·Apple 버튼과 OAuth 시작을 토스 빌드에서 제거 | `features/auth/AuthScreens.tsx`, `api/auth.ts` | 소 | 예 |
| 추가 | 토스 로그인 버튼·세션 확인·연결 해제 처리 | 새 토스 인증 프런트엔드 모듈, 인증 화면 | 중 | 예 |
| 변경 | `UserProvider`에 `toss` 추가 | `backend/app/models/entities.py` | 소 | 예 |
| 추가 | 사용자 공급자 enum 변경 Alembic 마이그레이션 | `backend/migrations/versions/` | 소 | 예 |
| 추가 | 토스 로그인 API 호출, 응답 복호화, 사용자 생성/조회, 세션 발급 | 새 백엔드 서비스·라우터·스키마 | 큼 | 예 |
| 변경 | 환경 변수, mTLS 인증서·키, 복호화 키 설정 | `core/config.py`, `.env.example`, 배포 비밀 저장소 | 중 | 예 |
| 유지 | Google·Apple OAuth와 네이티브 Apple 로그인 | 독립 앱·웹 빌드 | 없음 | 예, 유지 |

토스 미니앱은 토스 로그인만 사용할 수 있다. 토스 로그인 API는 mTLS가 필요하며, 사업자 등록이 없으면 토스 로그인을 사용할 수 없다. 기존 Google·Apple 사용자와 토스 사용자는 제공자 식별자가 다르므로, 이메일만으로 자동 병합하면 안 된다. 계정 연결이나 데이터 이전은 토스 운영 채널의 허용 흐름 확인 후에만 설계한다.

출처: [서비스 오픈 정책 — 로그인](https://developers-apps-in-toss.toss.im/intro/guide.html), [토스 로그인](https://developers-apps-in-toss.toss.im/login/intro.html), [mTLS API 연동](https://developers-apps-in-toss.toss.im/development/integration-process.html)

### 3. UI·디자인·브랜딩

| 구분 | 조치 | 현재 영향 위치 | 규모 | 출시 전 필수 |
| --- | --- | --- | --- | --- |
| 변경 | 다크 UI를 라이트 모드 기반의 토스 전용 테마로 분리 | `apps/frontend/src/appStyles.ts` | 큼 | 예 |
| 변경 | 주요 화면의 여백, 버튼, 입력, 목록, 모달을 TDS 기준으로 교체 | 인증·캐릭터 설정·홈·피드·DM 화면 | 큼 | 예 |
| 변경 | 토스 UX 라이팅에 맞춰 문구를 해요체로 정리 | 모든 노출 문구 | 중 | 예 |
| 변경 | 앱인토스 기본 내비게이션과 중복되는 UI 제거 | 라우트·상단 바·하단 탭 | 중 | 예 |
| 추가 | 콘솔의 앱 이름·로고·브랜드 색상과 같은 값의 `granite.config.ts` 브랜드 설정 | 새 설정 파일 | 소 | 예 |
| 추가 | 라이트 화면에 맞는 접근성·대비·텍스트 크기 QA | 디자인·QA 산출물 | 중 | 예 |
| 유지 | `ALIVE` 자체 로고·브랜드 정체성 | 단, 토스와 혼동되지 않게 표시 | 소 | 예 |

현재 앱은 다크 보라·핑크 팔레트와 자체 카드·모달 중심 CSS를 사용한다. 앱인토스는 현재 라이트 모드 기준으로 출시하도록 안내하며, TDS 사용을 권장한다. 따라서 CSS 변수만 뒤집는 작업으로 끝나지 않고, 인증·캐릭터 생성·피드·DM의 핵심 다섯 화면을 토스용으로 다시 설계해야 한다.

앱 로고는 600×600px 각진 정사각형과 배경이 필요하다. 현재 `documents/store-assets/app-icon-master.png`는 디자인 원본으로 활용할 수 있지만, 콘솔 업로드용 600×600 사본과 라이트·다크 진입점에서의 가독성 확인이 필요하다.

출처: [UI/UX 가이드](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide.html), [디자인 도구·TDS](https://developers-apps-in-toss.toss.im/design/prepare/design.html), [앱인토스 FAQ — 다크 모드·TDS](https://developers-apps-in-toss.toss.im/faq.html)

### 4. 생성형 AI, UGC, 안전 운영

| 구분 | 조치 | 현재 영향 위치 | 규모 | 출시 전 필수 |
| --- | --- | --- | --- | --- |
| 추가 | 최초 AI 사용 고지 | 인증 후 첫 진입 또는 첫 생성 흐름 | 소 | 예 |
| 추가 | 피드·댓글·DM·AI 이미지의 `AI 생성` 라벨 | 피드·DM·캐릭터 설정 화면 | 중 | 예 |
| 변경 | AI 입력과 출력 모두의 안전 검사 | 생성 API, 피드·DM 생성 훅, 백엔드 서비스 | 큼 | 예 |
| 추가 | 자해·자살 감지 시 생성 중단과 안전 안내 | AI 응답 처리·UI | 중 | 예 |
| 추가 | 위험 요청 거절 응답과 모델·프롬프트 변경 검토 절차 | AI 서비스·운영 문서 | 중 | 예 |
| 변경 | 신고·차단 결과가 AI 콘텐츠·공개 콘텐츠 화면에 일관되게 반영되도록 점검 | `api/safety.ts`, 피드·DM·공개 캐릭터 UI | 중 | 예 |
| 유지 | 신고 사유, 차단 API, 운영자 신고 큐, 약관 동의 저장 | `moderation.py`, `SafetyModals.tsx` 등 | 없음 | 예, 유지 |

현재 `content_safety.py`는 일부 위험 표현만 정규식으로 차단하고, 저장되는 게시물·DM·공개 캐릭터에 적용한다. 이는 최소 보호 장치지만, 토스가 AI 채팅·상담 서비스에 요구하는 문맥 판단, 우회 요청 차단, 자해 안전 응답, 부적절한 모델 출력의 즉시 차단을 충족한다고 보기 어렵다.

또한 현재 피드 신고 대상에 `AI 생성 게시물`이라는 운영상 라벨은 있지만, 사용자가 모든 AI 결과물을 즉시 인지할 수 있는 일관된 UI 배지는 확인되지 않았다. 생성형 AI 고지와 표시를 별도 기능으로 추가해야 한다.

출처: [서비스 오픈 정책 — 생성형 AI](https://developers-apps-in-toss.toss.im/intro/guide.html), [서비스별 주의사항 — AI 채팅·상담·민감 콘텐츠](https://developers-apps-in-toss.toss.im/intro/caution.html)

### 5. 공개 기능, DM, 외부 링크

| 구분 | 조치 | 현재 영향 위치 | 규모 | 출시 전 필수 |
| --- | --- | --- | --- | --- |
| 보류 | 공개 캐릭터 탐색, 팔로우, 공유 캐릭터, 공유 DM의 토스 출시 범위 확정 | Discover·공개 팔로우·공유 API | 중 | 예 |
| 비노출 | 실제 이용자 간 메시지, 랜덤 연결, 만남을 연상시키는 진입점 | 해당 기능이 있다면 토스 빌드 | 중 | 예 |
| 변경 | 공유 링크를 토스 앱 딥링크로 변경 | 공유 UI·링크 생성 로직 | 중 | 조건부 |
| 유지·검토 | 개인정보처리방침·이용약관·계정 삭제 외부 링크 | `HomeScreen.tsx`, `SafetyModals.tsx` | 소 | 예 |
| 비노출 | 앱마켓·자사 웹·외부 가입·외부 결제 유도 링크 | 토스 빌드 전체 | 소 | 예 |

현재 공개 캐릭터와 공유 DM 관련 모델·API가 있어, 토스에서 실제 이용자 간 소통으로 해석될 수 있는지 확인해야 한다. 초기 MVP는 사용자가 자신의 AI 캐릭터를 만들고 관리하는 경험으로 범위를 제한하는 것이 가장 안전하다. 법률상 필수 고지 링크는 허용 가능성이 있으나, 현재 법률 문서와 계정 삭제 화면의 외부 도메인·메일 링크는 검수 전 목적별로 확인해야 한다.

출처: [서비스 오픈 정책 — 외부 링크](https://developers-apps-in-toss.toss.im/intro/guide.html), [외부 링크 가이드라인](https://developers-apps-in-toss.toss.im/checklist/miniapp-external-link.html), [서비스별 주의사항 — 채팅·만남](https://developers-apps-in-toss.toss.im/intro/caution.html)

### 6. 법률 문서·개인정보·운영

| 구분 | 조치 | 현재 영향 위치 | 규모 | 출시 전 필수 |
| --- | --- | --- | --- | --- |
| 변경 | 개인정보처리방침에 토스 로그인, 토스 제공 정보, AI 처리 데이터 흐름을 추가 | `backend/app/legal/privacy.html` | 중 | 예 |
| 변경 | 이용약관에 AI 결과물 표시, 금지 콘텐츠, 제재·신고·운영 기준을 명확히 반영 | `backend/app/legal/terms.html` | 중 | 예 |
| 변경 | 계정 삭제 안내에 토스 로그인 연결 해제·탈퇴 연동 정책을 반영 | `backend/app/legal/account-deletion.html` | 소 | 예 |
| 추가 | AI 안전 운영정책, 신고 처리 SLA, 모델·프롬프트 변경 기록 | `documents/` 운영 문서 | 중 | 예 |
| 추가 | 고객 문의 대응자·긴급 차단 책임자·인시던트 기록 | 운영 프로세스 | 중 | 예 |
| 유지 | 정책 문서 제공 API와 계정 삭제 API | `backend/app/main.py`, 인증 API | 없음 | 예, 유지 |

현재 개인정보처리방침은 Google·Apple 인증과 생성형 AI 처리 서비스를 언급한다. 토스용 로그인, 토스 회원 정보 처리, 사용자 식별자, 연결 해제와 AI 결과물 표시 기준을 추가하지 않으면 실제 동작과 정책 문서가 불일치한다.

### 7. 네트워크·저장소·배포·QA

| 구분 | 조치 | 현재 영향 위치 | 규모 | 출시 전 필수 |
| --- | --- | --- | --- | --- |
| 변경 | 앱인토스 도메인을 CORS 허용 목록에 추가 | `core/config.py`, 배포 환경 변수 | 소 | 예 |
| 변경 | 토스 WebView의 API URL·쿠키·세션 동작 검증 | `api/client.ts`, 인증 API | 중 | 예 |
| 유지 | 캐릭터·피드·DM의 서버 저장 | PostgreSQL·FastAPI API | 없음 | 예, 유지 |
| 비노출 | 토스 빌드에서 로컬 저장소를 영구 데이터의 원본으로 사용하는 흐름 | `useAliveLocalPersistence.ts` | 소 | 예 |
| 추가 | 토스 샌드박스 QA, QR 테스트, 오류 로그 확인 | QA 절차·테스트 시나리오 | 중 | 예 |
| 추가 | 앱인토스 E2E/통합 테스트와 토스 로그인 모킹 | 프런트·백엔드 테스트 | 중 | 예 |
| 추가 | `.ait` 번들 검증과 100MB 제한 검사 | CI 또는 출시 체크리스트 | 소 | 예 |

앱인토스 Storage는 앱 삭제·기기 변경 후 유지되지 않을 수 있어, 현재처럼 PostgreSQL에 핵심 데이터를 저장하는 방향은 맞다. 다만 기존 로컬 저장소 복구 기능이 토스 계정 데이터보다 우선하지 않도록 런타임별 동작을 확인해야 한다. 브라우저 테스트만으로는 충분하지 않으며, 검수 요청 전에 토스 샌드박스 테스트가 필요하다.

출처: [앱인토스 FAQ — CORS·Storage·샌드박스·번들](https://developers-apps-in-toss.toss.im/faq.html)

## 파일 영향도

### 반드시 수정할 가능성이 높은 기존 파일

- `apps/frontend/package.json`
- `apps/frontend/vite.config.ts`
- `apps/frontend/src/main.tsx`
- `apps/frontend/src/api/auth.ts`
- `apps/frontend/src/api/client.ts`
- `apps/frontend/src/features/auth/AuthScreens.tsx`
- `apps/frontend/src/features/home/HomeScreen.tsx`
- `apps/frontend/src/app/feed/FeedTimeline.tsx`
- `apps/frontend/src/app/dm/DmMessages.tsx`
- `apps/frontend/src/appStyles.ts`
- `apps/frontend/src/domain/app/legal.ts`
- `backend/app/core/config.py`
- `backend/app/models/entities.py`
- `backend/app/models/__init__.py`
- `backend/app/schemas/auth.py`
- `backend/app/api/v1/auth.py`
- `backend/app/services/oauth.py` 또는 토스 전용 인증 서비스
- `backend/app/legal/privacy.html`
- `backend/app/legal/terms.html`
- `backend/app/legal/account-deletion.html`
- `.env.example`

### 새로 추가할 가능성이 높은 파일

- 앱인토스 설정 파일 `apps/frontend/granite.config.ts`
- 앱인토스 런타임 감지·플랫폼 어댑터 모듈
- 토스 로그인 프런트엔드 API 모듈
- AI 최초 고지·AI 생성 배지 UI 컴포넌트
- 토스 로그인 서버 서비스와 mTLS HTTP 클라이언트
- 토스 사용자 공급자 enum 마이그레이션
- 토스 로그인·AI 표시·안전 응답·런타임 분기 테스트
- 앱인토스 운영정책·QA 시나리오·계정 이전 결정 문서

### 삭제하지 말고 토스 빌드에서만 비노출할 것

- Capacitor iOS·Android 프로젝트와 네이티브 Apple 로그인 코드
- Google·Apple OAuth 백엔드 구현
- 기존 스토어 결제·배포 설정
- 독립 앱의 다크 테마
- 기존 공개·탐색 기능의 코드 자체

이 코드들은 독립 앱 배포에 계속 필요하다. 공통 코드에서 삭제하면 App Store·Google Play 출시 기능을 깨뜨릴 수 있으므로, 빌드·런타임 분리로 처리한다.

## 권장 토스 MVP 범위

### 포함

1. 토스 로그인
2. 캐릭터 생성·수정
3. AI 캐릭터 피드 생성·수정·삭제
4. 사용자와 AI 캐릭터의 대화
5. 서버 저장, 계정 삭제, 신고·차단
6. AI 고지·`AI 생성` 표시·기본 안전 필터
7. 라이트 모드와 TDS 기반의 다섯 핵심 화면

### 제외

1. 실제 이용자 간 채팅·랜덤 연결
2. 공개 캐릭터 탐색·팔로우·공유 기능
3. 결제·구독·광고·프로모션
4. 독립 앱 계정과 토스 계정의 자동 이전·병합
5. 독립 앱 설치 홍보와 외부 웹 유도

이 범위라면 토스에서 약속한 기능을 미니앱 안에서 완결적으로 제공하면서, 채팅·소개팅·결제·광고의 추가 운영 리스크를 초기에는 피할 수 있다.

## 규모 추정

| 작업 묶음 | 예상 변경 폭 | 난이도 |
| --- | --- | --- |
| 앱인토스 SDK·번들·런타임 분리 | 프런트엔드 4~7개 파일과 설정 파일 | 중 |
| 토스 로그인·mTLS·사용자 마이그레이션 | 백엔드 7~12개 파일, DB 마이그레이션, 인증 테스트 | 중~큼 |
| 라이트 테마·TDS 핵심 화면 | 프런트엔드 8~15개 파일, CSS 대폭 수정 | 큼 |
| AI 표시·안전 강화·운영 | 프런트·백엔드·테스트·운영 문서 전반 | 큼 |
| 법률·운영·콘솔·자산·QA | 문서·콘솔·샌드박스·테스트 작업 | 중 |

한 명의 개발자가 위 MVP를 정책 검토와 함께 진행하면 대략 3~6주의 집중 작업으로 보는 것이 현실적이다. 토스 로그인 사업자 등록, mTLS 발급, AI 캐릭터 DM의 사전 검토 결과, 라이트 UI 재설계 범위에 따라 일정은 달라진다. 결제·광고·공개 소셜 기능을 초기 범위에서 제외하는 것이 가장 큰 범위 절감 요소다.

## 작업 순서와 차단 조건

### 0단계 — 코드 변경 전

- [ ] 채널톡에 AI 캐릭터 대화·UGC·공개 기능·계정 이전 계획을 보내 사전 분류를 받는다.
- [ ] 토스 로그인 사용을 결정하고 사업자 등록 가능 여부를 확인한다.
- [ ] 토스 MVP에서 공개·탐색·공유 기능을 제외할지 결정한다.
- [ ] `ALIVE` 브랜드의 라이트 모드 디자인 방향을 앱빌더 또는 Figma TDS로 확정한다.

### 1단계 — 플랫폼 기반

- [ ] 앱인토스 SDK, TDS, `granite.config.ts`, 런타임 분기를 추가한다.
- [ ] 토스 전용 라이트 테마와 인증 화면을 구현한다.
- [ ] CORS·API URL·쿠키 동작을 토스 샌드박스에서 확인한다.

### 2단계 — 인증과 데이터

- [ ] mTLS 인증서·키·복호화 키를 배포 비밀 저장소에 넣는다.
- [ ] 토스 로그인과 세션 발급, 사용자 공급자 마이그레이션, 연결 해제 처리를 구현한다.
- [ ] 독립 앱 Google·Apple 로그인 회귀 테스트를 통과시킨다.

### 3단계 — AI와 안전

- [ ] AI 최초 고지, 결과물 라벨, 안전 필터, 자해 안전 응답을 구현한다.
- [ ] 신고·차단·운영자 제재·콘텐츠 로그 정책을 검증한다.
- [ ] AI 모델·프롬프트 변경 승인 절차를 운영 문서에 확정한다.

### 4단계 — 검수 준비

- [ ] 약관·개인정보처리방침·계정 삭제 안내를 토스용 동작에 맞춘다.
- [ ] 로고·세로 스크린샷 3장·가로 스크린샷 1장을 실제 출시 UI 기준으로 확정한다.
- [ ] 샌드박스에서 로그인, 첫 캐릭터 생성, AI 생성, DM, 신고, 삭제, 오류 복구를 테스트한다.
- [ ] `.ait` 번들을 업로드하고 출시 검수를 요청한다.

## 출시 차단 조건

아래 중 하나라도 미해결이면 출시 검수 요청을 미룬다.

- 토스 미니앱에서 Google·Apple 또는 외부 로그인·외부 가입이 가능한 상태
- AI 사용 최초 고지 또는 AI 결과물 표시가 없는 상태
- 자해·성적·폭력·불법 요청에 대한 생성 제한과 운영 대응이 없는 상태
- 다크 모드만 있는 UI 또는 토스 내비게이션과 충돌하는 UI
- 외부 앱 설치·앱마켓·외부 결제·자사 웹 유도 링크가 남아 있는 상태
- 토스 로그인용 mTLS·서버 인증서 보관·연결 해제 처리가 없는 상태
- 브라우저만 테스트하고 토스 샌드박스에서 확인하지 않은 상태
- AI 캐릭터 DM·공개 기능 분류가 불명확한 상태

## 공식 참고 자료

- [서비스 오픈 정책](https://developers-apps-in-toss.toss.im/intro/guide.html)
- [서비스별 주의사항](https://developers-apps-in-toss.toss.im/intro/caution.html)
- [기존 웹 프로젝트 SDK 연동](https://developers-apps-in-toss.toss.im/tutorials/webview.html)
- [토스 로그인](https://developers-apps-in-toss.toss.im/login/intro.html)
- [UI/UX 가이드](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide.html)
- [디자인 도구와 TDS](https://developers-apps-in-toss.toss.im/design/prepare/design.html)
- [앱인토스 FAQ](https://developers-apps-in-toss.toss.im/faq.html)
- [mTLS API 연동 절차](https://developers-apps-in-toss.toss.im/development/integration-process.html)
