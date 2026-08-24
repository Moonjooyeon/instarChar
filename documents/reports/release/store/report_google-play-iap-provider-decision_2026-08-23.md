---
title: Google Play 인앱결제 검증 구조 및 RevenueCat 도입 판단
author: black (black@ashwoodfriends.com)
created: 2026-08-23
updated: 2026-08-23
version: 1.0.0
status: ready
---

# Google Play 인앱결제 검증 구조 및 RevenueCat 도입 판단

## 결론

현재 구현을 유지한다면 다음 두 값은 모두 필요하다.

```dotenv
GOOGLE_PLAY_IAP_SERVICE_ACCOUNT_JSON_PATH=/run/secrets/google-play/service-account.json
GOOGLE_PLAY_IAP_SUBJECT_HMAC_KEY=<32바이트 이상의 별도 랜덤 비밀값>
```

다만 이 환경변수 **이름 자체가 Google Play의 필수 규격인 것은 아니다.** 첫 번째 값은 현재 백엔드가 Google Play Developer API에 서비스 계정으로 인증하기 위해 선택한 방식이고, 두 번째 값은 ALIVE가 구매자와 로그인 사용자를 안전하게 연결하기 위해 자체적으로 선택한 방식이다.

RevenueCat을 사용하면 Lightsail의 위 두 환경변수 이름은 없어질 수 있다. 그러나 인증과 구매 검증이 없어지는 것은 아니다. Google 서비스 계정 JSON은 RevenueCat 대시보드에 등록해야 하고, ALIVE 백엔드 크레딧 원장을 계속 사용할 경우 RevenueCat 웹훅 인증 비밀값과 사용자 식별자 매핑이 새로 필요하다.

따라서 **두 환경변수를 피하려는 목적만으로 지금 RevenueCat으로 교체하지 않는다.** 현재 비공개 테스트는 직접 연동 구조를 마무리하는 편이 변경량과 중복 지급 위험이 가장 작다. RevenueCat은 Android와 iOS 결제를 하나의 공급자로 통합할지 결정할 때 별도 마이그레이션으로 검토한다.

## 질문에 대한 직접 답변

| 질문 | 답변 |
|---|---|
| Google Play 결제창만 띄우는 데 서비스 계정이 필요한가? | 아니다. Android 클라이언트는 Billing Library만으로 상품 조회와 결제창 호출이 가능하다. |
| 결제 결과를 백엔드 크레딧으로 안전하게 지급하는 데 Google 인증이 필요한가? | 필요하다. 현재 구현은 서비스 계정 JSON으로 구매 토큰을 Google 서버에 검증하고 소비 처리한다. |
| 클라이언트에서 바로 소비 처리하면 백엔드 인증 없이 가능한가? | 기술적으로 가능하지만 ALIVE에는 부적합하다. 변조된 클라이언트 요청, 다른 계정의 토큰 재사용, 중복 지급을 서버가 신뢰성 있게 막기 어렵다. |
| RevenueCat을 쓰면 Google 서비스 계정이 없어지는가? | 아니다. 파일을 Lightsail에 두는 대신 RevenueCat 프로젝트에 업로드하는 구조가 일반적이다. |
| `GOOGLE_PLAY_IAP_SUBJECT_HMAC_KEY`는 Google 필수값인가? | 아니다. 현재 ALIVE의 구매자 식별·점진 배포용 비밀값이다. RevenueCat App User ID나 영구 저장된 불투명 ID로 재설계할 수는 있지만 아무 대체 없이 삭제하면 안 된다. |
| 현재 코드에서 두 값을 빼도 되는가? | Google IAP 관련 기능 플래그를 모두 끈 경우에만 된다. 하나라도 활성화하면 앱 시작 시 현재 설정 검증이 실패한다. |

## 링크 글이 말하는 “간단함”의 범위

제시된 [RevenueCat Play Billing 8 마이그레이션 글](https://www.revenuecat.com/blog/engineering/play-billing-8-migration)은 Google Play Billing 7에서 8로 바뀐 클라이언트 API를 설명한다. 특히 이미 RevenueCat SDK를 사용하는 앱은 RevenueCat이 Billing Library 변경을 감싸므로 SDK 버전 업데이트 중심으로 대응할 수 있다는 내용이다.

이 글은 다음을 의미하지 않는다.

- 신규 일회성 상품의 전체 결제·지급 구조가 클라이언트 코드 몇 줄로 끝난다는 의미가 아니다.
- 백엔드 크레딧 지급을 클라이언트의 성공 콜백만 신뢰해도 된다는 의미가 아니다.
- RevenueCat을 쓰면 Google 서비스 계정과 서버 측 신뢰 체계가 필요 없다는 의미가 아니다.

또한 글은 Billing 8 마이그레이션을 다루지만, 현재 ALIVE Android 앱은 이미 `com.android.billingclient:billing:9.1.0`을 사용한다. Google 공식 릴리스 노트 기준 Billing Library 9.1.0은 2026-06-18에 공개된 버전이다.

참고 자료:

- [Google Play Billing Library 릴리스 노트](https://developer.android.com/google/play/billing/release-notes)
- [Google Play Billing 지원 중단 일정](https://developer.android.com/google/play/billing/deprecation-faq)

## ALIVE 현재 구현

### 런타임 분기

| 런타임 | 현재 선택되는 결제 경로 | 상태 |
|---|---|---|
| 앱인토스 | Toss IAP SDK → Toss 검증 API → 공통 크레딧 원장 | 기존 구현 유지 |
| Android 네이티브 | Google Play Billing 9.1.0 → Google Play Developer API → 공통 크레딧 원장 | 구현 및 테스트 존재 |
| iOS 네이티브 | 전용 StoreKit/RevenueCat 경로 없음 | 아직 iOS 결제 구현이 확인되지 않음 |
| 웹 | 스토어 결제 경로 없음 | 결제 비활성 |

Google Play 런타임 판정은 `runtime !== "apps-in-toss" && native && platform === "android"`로 제한되어 있으므로 앱인토스 결제와 Android 결제가 서로 호출되는 구조는 아니다.

다만 현재 `CreditStoreScreen`은 “Android이면 Google Play, 아니면 Toss”를 선택한다. iOS에서는 Toss 훅의 자체 런타임 가드 때문에 실제 Toss 결제가 실행되지는 않지만, 앞으로 iOS 결제를 추가할 때는 `toss | google-play | app-store | none`처럼 공급자를 명시적으로 선택하는 편이 안전하다.

### 구매와 지급 흐름

```text
Android 앱
  1. Google Play에서 실제 상품·현지 가격 조회
  2. 백엔드에서 사용자의 obfuscatedAccountId 조회
  3. Google Play 결제창 호출
  4. purchaseToken을 ALIVE 백엔드에 전달

ALIVE 백엔드
  5. 서비스 계정으로 Google Play Developer API 호출
  6. 패키지명·상품 ID·PURCHASED 상태·obfuscatedAccountId 검증
  7. purchaseToken을 고유 주문 키로 사용해 공통 크레딧 원장에 1회만 지급
  8. 지급 성공 후 Google Play에 소비 처리
```

Google 공식 문서도 구매 토큰을 안전한 백엔드로 보내 검증하고, 지급 후 소비성 상품을 소비 처리하는 구조를 권장한다.

- [Google Play Billing 통합 가이드](https://developer.android.com/google/play/billing/integrate)
- [Google Play Billing 보안 권장사항](https://developer.android.com/google/play/billing/security)
- [Google Play 백엔드 통합](https://developer.android.com/google/play/billing/backend)

### 현재 코드에서 각 설정이 하는 일

| 설정 | 현재 역할 | 제거 시 결과 |
|---|---|---|
| `GOOGLE_PLAY_IAP_SERVICE_ACCOUNT_JSON_PATH` | Google OAuth 액세스 토큰을 만들고 구매 조회·소비 API를 호출 | 구매 검증과 소비 처리 불가; 기능 활성화 상태에서는 서버 시작 검증 실패 |
| `GOOGLE_PLAY_IAP_SUBJECT_HMAC_KEY` | ALIVE 사용자 UUID를 Google에 노출하지 않는 고정 `obfuscatedAccountId`로 변환하고 점진 배포 버킷 계산 | 구매자-로그인 사용자 일치 검증 불가; 기능 활성화 상태에서는 서버 시작 검증 실패 |
| `GOOGLE_PLAY_IAP_PACKAGE_NAME` | 검증 대상 Android 패키지 고정 | 다른 앱 토큰과 대상 앱을 구분할 수 없음 |
| 상품 ID 5개 | Google 주문의 상품을 ALIVE 크레딧 상품에 매핑 | 누락·중복이면 서버 시작 검증 실패 |
| `GOOGLE_PLAY_IAP_*_ENABLED` | 카탈로그 노출과 구매 허용 제어 | 모두 꺼져 있으면 Google 전용 인증값 없이도 Toss·일반 앱 실행 가능 |

서비스 계정은 Google Play Developer API를 서버 간 호출하기 위한 주체다. 발급한 서비스 계정 이메일을 Play Console 사용자로 연결하고 필요한 앱 권한만 부여해야 한다. 광범위한 프로젝트 소유자 권한은 필요하지 않다.

- [Google Play Developer API 시작하기](https://developers.google.com/android-publisher/getting_started)
- [일회성 상품 소비 API](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/consume)

## 선택지 비교

| 선택지 | Lightsail JSON | 서버 측 검증 | ALIVE 변경량 | 판단 |
|---|---:|---:|---:|---|
| A. 현재 직접 연동 유지 | 필요 | Google API 직접 호출 | 가장 작음 | **현재 권장** |
| B. 직접 연동 + ADC/WIF | 경로 변수는 제거 가능 | Google API 직접 호출 | 인증 모듈·배포 구성 변경 | 장기 보안 개선 후보 |
| C. 클라이언트만으로 지급·소비 | 불필요 | 없음 | 겉보기에는 작음 | **사용 금지** |
| D. RevenueCat으로 이전 | Lightsail에는 불필요할 수 있으나 RevenueCat에 Google 자격증명 필요 | RevenueCat이 영수증 검증 | Android·백엔드·운영 설정 교체 | iOS 통합 결정 시 검토 |

### A. 현재 직접 연동 유지

현재 코드와 데이터 모델을 그대로 사용한다. 비공개 테스트를 가장 빨리 안정화할 수 있고, Toss 경로와 공통 크레딧 원장을 건드리지 않는다. 단점은 서비스 계정 키 파일을 안전하게 배포·회전해야 한다는 점이다.

### B. ADC 또는 Workload Identity Federation

`GOOGLE_PLAY_IAP_SERVICE_ACCOUNT_JSON_PATH`라는 경로 환경변수는 없앨 수 있다. 대신 Google Application Default Credentials 또는 Workload Identity Federation으로 인증해야 하므로 **인증 자체가 없어지는 것은 아니다.**

Lightsail은 EC2 인스턴스 프로파일과 같은 서비스 역할 연동을 직접 제공하지 않으므로 AWS 기반 Workload Identity Federation 구성은 단순한 대체가 아니다. AWS 자격증명, Google Workload Identity Pool·Provider·서비스 계정 위임 구성이 추가된다.

- [Google Cloud Workload Identity](https://docs.cloud.google.com/iam/docs/workload-identities)
- [AWS 워크로드의 Google Workload Identity Federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-clouds)
- [Google Application Default Credentials](https://docs.cloud.google.com/docs/authentication)
- [Lightsail의 IAM 지원 범위](https://docs.aws.amazon.com/lightsail/latest/userguide/security_iam_service-with-iam.html)

### C. 클라이언트만으로 처리

Google Billing Library는 클라이언트에서 구매 확인과 소비 호출도 제공한다. 그러나 ALIVE 크레딧은 백엔드 데이터이며 AI 사용 비용과 연결되는 유상 자산이다. 클라이언트가 “결제 성공”이라고 보낸 값만으로 서버 크레딧을 지급하면 변조, 토큰 재사용, 계정 바꿔치기, 중복 콜백에 취약해진다.

이 선택지는 데모 UI 확인에는 쓸 수 있어도 실제 크레딧 지급 구조로 채택하지 않는다.

### D. RevenueCat 도입

RevenueCat을 도입하면 Android와 iOS의 영수증 검증·스토어 차이를 하나의 SDK와 API로 감쌀 수 있다. 하지만 Google Play 앱을 연결하려면 [RevenueCat의 Google Play 서비스 자격증명 생성 절차](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials)에 따라 서비스 계정 JSON 키를 RevenueCat에 등록해야 한다. 현재 Google Cloud 조직 정책이 서비스 계정 키 생성을 막고 있다면 RevenueCat도 같은 정책 문제를 우회하지 못한다.

ALIVE 백엔드 크레딧 원장을 유지하는 권장 RevenueCat 구조는 다음과 같다.

```text
Android/iOS 앱 → RevenueCat SDK → Google Play/App Store
                          ↓
                  RevenueCat 영수증 검증
                          ↓ 인증된 웹훅
               ALIVE 공통 크레딧 원장에 1회 지급
```

이 경우 새로 필요한 운영 항목은 다음과 같다.

- RevenueCat 공개 SDK API 키
- ALIVE 사용자와 RevenueCat App User ID의 안정적인 매핑
- 웹훅 URL과 Authorization/HMAC 비밀값
- RevenueCat event ID 기반 멱등성
- 웹훅 지연·재시도·순서 역전을 견디는 처리
- Google Play 서비스 계정 JSON의 RevenueCat 등록
- iOS App Store Connect 자격증명 및 상품 연결

관련 자료:

- [RevenueCat Google Play 플랫폼 리소스](https://www.revenuecat.com/docs/platform-resources/google-platform-resources)
- [RevenueCat 비구독 상품](https://www.revenuecat.com/docs/platform-resources/non-subscriptions)
- [RevenueCat Virtual Currency](https://www.revenuecat.com/docs/offerings/virtual-currency)
- [기존 백엔드 잔액을 원장으로 유지하는 방식](https://www.revenuecat.com/docs/offerings/virtual-currency/faq/balance-source-of-truth)
- [RevenueCat 웹훅](https://www.revenuecat.com/docs/integrations/webhooks)
- [RevenueCat Capacitor 설치](https://www.revenuecat.com/docs/getting-started/installation/capacitor)

현재 공개 가격은 월 추적 매출(MTR) 미화 2,500달러까지 무료이고 그 이후 1%다. 비용뿐 아니라 공급자 종속성과 장애 경로가 하나 더 생긴다는 점도 함께 판단해야 한다. 최신 조건은 [RevenueCat 가격 페이지](https://www.revenuecat.com/pricing)에서 다시 확인한다.

## 최근 Google Play 구현을 RevenueCat으로 바꿀 때의 영향

이번 분석에서는 아래 파일을 수정하거나 삭제하지 않았다. RevenueCat을 실제로 채택할 때도 한 번에 제거하면 안 되고, 이중 지급 방지와 기존 미소비 주문 복구를 포함한 단계적 전환이 필요하다.

### 전환 후 대체·삭제 후보

- `android/app/src/main/java/com/ashwoodfriends/alive/GooglePlayBillingPlugin.java`
- `apps/frontend/src/api/googlePlayIap.ts`
- `apps/frontend/src/features/credits/useGooglePlayCreditPurchase.ts`
- `backend/app/services/google_play_api.py`
- `backend/app/services/google_play_purchases.py`
- `backend/app/services/google_play_rtdn.py`
- Google Play 직접 검증·RTDN 전용 라우트와 설정

이 파일들은 RevenueCat SDK, 웹훅 검증 서비스, 이벤트 멱등성 처리로 완전히 대체되고 미처리 주문이 없음을 확인한 뒤에만 삭제한다.

### 반드시 유지할 기반

- 공통 크레딧 원장과 잔액 모델
- 공급자와 주문 토큰을 기준으로 한 중복 지급 방지
- 상품 ID와 크레딧 상품의 서버 측 매핑
- 앱인토스 결제 경로와 런타임 분기
- 이미 적용된 데이터베이스 마이그레이션 이력

적용된 마이그레이션 파일은 롤백 목적으로 삭제하지 않는다. 스키마 변경이 필요하면 새 정방향 마이그레이션을 추가한다.

### 안전한 RevenueCat 전환 순서

1. RevenueCat을 별도 기능 플래그 뒤에 추가한다.
2. 테스트 사용자만 RevenueCat SDK 경로로 보내고 기존 직접 경로는 복구용으로 유지한다.
3. RevenueCat 웹훅 event ID와 스토어 transaction/purchase token을 공통 원장에서 멱등 처리한다.
4. 구매·재설치·보류 결제·환불·계정 전환을 검증한다.
5. 신규 구매를 RevenueCat으로 완전히 전환한다.
6. 기존 미소비·미처리 Google 주문이 없음을 확인한 뒤 직접 연동 코드를 제거한다.

## 현재 비공개 테스트에 필요한 운영 상태

### 서비스 계정 키를 아직 준비하지 못한 경우

서버를 정상 운영하면서 Toss 경로를 보존하려면 Google 기능을 활성화하지 않는다.

```dotenv
GOOGLE_PLAY_IAP_ENABLED=false
GOOGLE_PLAY_IAP_PURCHASE_ENABLED=false
GOOGLE_PLAY_IAP_PURCHASE_ROLLOUT_PERCENT=0
GOOGLE_PLAY_RTDN_ENABLED=false
```

현재 코드에서는 `GOOGLE_PLAY_IAP_ENABLED`, `GOOGLE_PLAY_IAP_PURCHASE_ENABLED`, `GOOGLE_PLAY_RTDN_ENABLED` 중 하나라도 참이면 서비스 계정 파일과 HMAC 키를 포함한 Google 설정을 시작 시 검증한다.

### 서비스 계정 키를 준비한 경우

1. Google Play Android Developer API가 활성화된 올바른 Google Cloud 프로젝트인지 확인한다.
2. 서비스 계정에 필요한 최소 권한을 Play Console의 해당 앱에 부여한다.
3. JSON을 소스 저장소나 Docker 이미지에 넣지 않고 Lightsail의 제한된 경로에 배포한다.
4. 컨테이너 안에서 설정한 경로로 읽히도록 읽기 전용 마운트한다.
5. 별도의 32바이트 이상 HMAC 키를 생성하고 `AUTH_SECRET_KEY`와 다르게 설정한다.
6. 서버를 재시작한 뒤 시작 로그에 Google 설정 검증 실패가 없는지 확인한다.
7. 비공개 테스트 설치 링크로 설치한 앱에서 상품 조회, 실제 테스트 결제, 1회 지급, 재진입 시 중복 미지급을 확인한다.

HMAC 예시 값은 문서나 채팅에 복사하지 않고 서버에서 직접 생성·보관한다.

```bash
openssl rand -hex 32
```

## 검증 결과

### 코드·구성 확인

- Android Billing Library: `9.1.0`
- Google Play 경로: 앱인토스가 아닌 Android 네이티브에서만 활성
- 서버 검증: 상품, 상태, 사용자 `obfuscatedAccountId`, 구매 토큰 확인
- 지급 멱등성: 공급자와 구매 토큰을 원장 고유 주문 기준으로 사용
- 소비 처리: 크레딧 지급 성공 후 서버에서 Google API 호출
- 미완료 구매 복구: 앱 재진입 시 현재 구매를 조회해 서버 지급 재시도
- 최근 Google Play IAP 커밋 이후 관련 파일 삭제 없음

### 자동 테스트

- 프런트엔드 도메인 테스트: `185 passed`
- 백엔드 Google Play IAP·크레딧 API·마이그레이션 테스트: `60 passed`
- 백엔드 경고: Starlette의 기존 deprecation warning 1건

### 이번 분석에서 하지 않은 검증

- Play Console 비공개 테스트 승인 상태 확인
- 실제 테스트 계정의 결제창·구매 완료 확인
- Lightsail 컨테이너 내부의 JSON 마운트와 환경변수 값 확인
- 실제 Google Play Developer API 권한 호출
- 환불/보류 결제 RTDN 종단 간 검증

자동 테스트 통과는 실제 Play 권한과 서버 배포 구성이 올바르다는 뜻이 아니므로 위 항목은 출시 전 운영 검증이 필요하다.

## 최종 권고

1. 현재 비공개 테스트에서는 직접 Google Play 연동을 유지한다.
2. 서비스 계정 키 생성 차단 정책은 프로젝트 범위 예외 또는 조직 관리자 승인으로 해결한다.
3. JSON은 Lightsail 비밀 파일 마운트로 보관하고 별도 HMAC 키를 설정한다.
4. 실제 구매·중복 지급·복구까지 확인한 뒤 공개 테스트로 진행한다.
5. iOS 결제 구현 착수 전에 RevenueCat 도입 여부를 다시 결정한다. 이때 목표는 “환경변수 두 개 제거”가 아니라 “Android/iOS 구매 검증 운영을 하나로 통합할 가치가 있는가”여야 한다.

