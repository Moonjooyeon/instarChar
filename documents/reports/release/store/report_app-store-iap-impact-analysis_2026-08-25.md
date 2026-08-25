---
title: iOS App Store 인앱결제 구조 및 기존 결제 영향 분석
author: black (black@ashwoodfriends.com)
created: 2026-08-25
updated: 2026-08-25
version: 1.0.0
status: ready
---

# iOS App Store 인앱결제 구조 및 기존 결제 영향 분석

## 결과

독립 iOS 앱에 StoreKit 2 기반 소비성 크레딧 결제를 추가할 수 있다. 현재 Apps in Toss와 Google Play는 공급자별 클라이언트·서버 어댑터가 분리되어 있고, 구매 지급은 공통 크레딧 원장을 사용하므로 iOS를 세 번째 공급자로 추가하는 구조가 적합하다. iOS 기능을 기본 비활성화하고 런타임 분기, API, 환경 변수, 알림 처리와 롤아웃을 공급자별로 격리하면 운영 중인 Toss와 Google Play의 신규 구매 경로를 변경하지 않을 수 있다.

다만 프런트엔드 상품 화면, 서버 카탈로그, 공통 구매 원장은 세 공급자가 함께 사용하는 코드다. 따라서 "기존 결제에 영향이 없다"는 것은 구현만으로 자동 보장되는 것이 아니라, 기존 API 계약 보존과 Toss·Google 회귀 테스트를 iOS 활성화 조건으로 삼을 때 보장할 수 있다.

## 목적과 범위

이 문서는 다음 내용을 정리한다.

- 현재 Toss·Google Play 결제 구조와 독립 iOS 결제의 부재
- StoreKit 2 직접 연동 권장 구조
- 운영 중인 Toss·Google Play에 영향을 주지 않기 위한 격리 원칙
- 프런트엔드, iOS 네이티브, FastAPI, PostgreSQL, App Store Connect 변경 범위
- 구매 복구, 중복 지급 방지, 환불과 서버 알림 처리 원칙
- 안전한 개발·배포 순서와 완료 기준

코드 구현, App Store Connect 상품 생성, Sandbox 결제와 TestFlight 배포는 이 분석의 범위가 아니다.

## 가정

- iOS에서는 RevenueCat이 아니라 StoreKit 2와 Apple App Store Server Library를 직접 연동한다.
- 현재 다섯 개 크레딧 팩과 첫 구매 10% 보너스 정책을 유지한다.
- 크레딧은 App Store의 소비성 상품으로 판매한다.
- ALIVE 백엔드 원장이 잔액과 지급 여부의 최종 기준이다.
- Apps in Toss와 독립 Android 앱의 운영 설정과 구매 API는 그대로 유지한다.
- 독립 iOS 앱의 번들 ID는 `com.ashwoodfriends.alive`다.

## 현재 상태

### 런타임별 결제 경로

| 런타임 | 현재 결제 경로 | iOS 추가 후 목표 경로 |
|---|---|---|
| Apps in Toss Android/iOS | Toss IAP SDK → Toss 검증 API → 공통 원장 | 변경 없음 |
| 독립 Android | Google Play Billing → Google Play Developer API → 공통 원장 | 변경 없음 |
| 독립 iOS | 전용 결제 경로 없음 | StoreKit 2 → Apple JWS 검증 → 공통 원장 |
| 웹 | 결제 없음 | 변경 없음 |

현재 크레딧 화면은 독립 Android이면 Google Play 훅을 선택하고, 그 외에는 Toss 훅을 선택한다. iOS에서는 Toss 훅의 런타임 가드 때문에 실제 결제가 실행되지 않지만, 세 번째 공급자를 추가하기 전 명시적인 공급자 선택으로 바꾸어야 한다.

근거 코드:

- [크레딧 화면 결제 훅 선택](../../../../apps/frontend/src/features/credits/CreditStoreScreen.tsx)
- [Google Play 런타임 판정](../../../../apps/frontend/src/api/googlePlayIap.ts)
- [Apps in Toss 런타임 판정](../../../../apps/frontend/src/api/tossIap.ts)
- [iOS 로컬 Capacitor 플러그인 등록](../../../../ios/App/App/AliveBridgeViewController.swift)

### 재사용 가능한 공통 기반

현재 공통 구매 원장은 다음 기능을 제공한다.

- `(provider, provider_order_id)` 복합 고유 키를 이용한 중복 지급 방지
- 공급자 주문을 크레딧 상품 정책에 매핑한 뒤 한 번만 지급
- 구매 크레딧, 무료 크레딧과 환불 부채의 분리
- 환불 시 잔액 차감 또는 부족분 부채 전환
- ALIVE 사용자별 첫 구매 보너스 중복 방지
- 계정 삭제 후 구매 기록 보존과 운영 감사

근거 코드:

- [CreditPurchase 모델](../../../../backend/app/models/entities.py)
- [공통 구매 원장](../../../../backend/app/repositories/credit_purchases.py)
- [Google Play 구매 서비스](../../../../backend/app/services/google_play_purchases.py)
- [Apps in Toss 구매 서비스](../../../../backend/app/services/credit_purchases.py)

이 기반은 `provider="app_store"`, Apple `transactionId`, Apple 상품 ID와 사용자 식별값을 전달하는 방식으로 재사용할 수 있다.

## 권장 런타임 분기

결제 공급자를 boolean이 아니라 다음 명시적 타입으로 선택한다.

```ts
type PurchaseProvider =
  | "apps_in_toss"
  | "google_play"
  | "app_store"
  | "none";
```

판정 순서는 다음과 같이 고정한다.

```text
VITE_ALIVE_RUNTIME === apps-in-toss → apps_in_toss
그 외 네이티브 Android               → google_play
그 외 네이티브 iOS                   → app_store
그 외                                → none
```

Apps in Toss는 Toss 앱 안에서 Android와 iOS 모두 실행될 수 있으므로 플랫폼보다 Apps in Toss 런타임을 먼저 판정해야 한다. 플랫폼을 먼저 판정하면 iOS Toss 미니앱이 App Store 결제로 잘못 분기될 수 있다.

## 권장 iOS 구매 흐름

```text
사용자: 독립 iOS 크레딧 상품 선택
→ CreditStoreScreen이 app_store 공급자 선택
→ 서버에서 구매 가능 여부와 appAccountToken 조회
→ StoreKit 2에서 실제 상품과 지역화 가격 조회
→ Product.purchase(options: [.appAccountToken(...)])
→ 검증된 Transaction의 jwsRepresentation 획득
→ POST /api/credits/purchases/app-store/grant
→ Apple 서명·앱·상품·사용자·거래 상태 검증
→ (app_store, transactionId) 기준 원장 예약 및 중복 방지
→ 크레딧 지급과 잔액 커밋
→ 서버가 granted 응답
→ iOS가 Transaction.finish() 호출
→ 잔액과 구매 내역 갱신
```

StoreKit이 반환한 거래 성공값만 클라이언트에서 신뢰해 크레딧을 지급하지 않는다. 클라이언트는 Apple이 서명한 `jwsRepresentation`을 서버로 보내고, FastAPI 서버가 Apple 공식 App Store Server Library로 다시 검증한다.

서버가 지급 성공을 응답하기 전에 `Transaction.finish()`를 호출하지 않는다. 서버 장애나 앱 종료로 지급이 끝나지 않은 거래는 `Transaction.unfinished`와 `Transaction.updates`를 통해 재처리한다. 같은 거래가 앱 복구와 Apple 서버 알림으로 동시에 도착해도 공통 원장의 복합 고유 키로 한 번만 지급한다.

Apple 공식 근거:

- [StoreKit `purchase(options:)`](https://developer.apple.com/documentation/storekit/product/purchase%28options%3A%29)
- [`appAccountToken`](https://developer.apple.com/documentation/StoreKit/Product/PurchaseOption/appAccountToken%28_%3A%29)
- [StoreKit JWS 서버 검증](https://developer.apple.com/documentation/storekit/verificationresult)
- [`Transaction.unfinished`](https://developer.apple.com/documentation/storekit/transaction/unfinished)
- [`Transaction.finish()`](https://developer.apple.com/documentation/storekit/transaction/finish%28%29)
- [Apple App Store Server Python Library](https://github.com/apple/app-store-server-library-python)

## 변경 범위

### iOS 네이티브

기존 `AppleSignIn.swift`처럼 로컬 Capacitor 플러그인을 추가한다. 별도 서드파티 결제 SDK는 필요하지 않다.

예상 파일과 책임:

- `ios/App/App/AppStoreBillingPlugin.swift`: 상품 조회, 구매, 미완료 거래 조회, 거래 finish와 업데이트 관찰
- `ios/App/App/AliveBridgeViewController.swift`: App Store 결제 플러그인 등록
- `ios/App/App.xcodeproj/project.pbxproj`: Swift 소스 등록과 빌드 설정

브리지는 다음 계약을 제공하는 것이 적합하다.

- `getProducts(productIds)`
- `purchase(productId, appAccountToken)`
- `getUnfinishedTransactions()`
- `finish(transactionId)`
- `success`, `pending`, `userCancelled`, `unverified` 결과 구분
- 성공 거래의 `transactionId`, `productId`, `jwsRepresentation` 반환

현재 iOS deployment target은 15.0이므로 StoreKit 2 도입 기반은 충족한다.

### 프런트엔드

예상 추가·변경 파일:

- `apps/frontend/src/api/appStoreIap.ts`
- `apps/frontend/src/features/credits/useAppStoreCreditPurchase.ts`
- `apps/frontend/src/features/credits/CreditStoreScreen.tsx`
- `apps/frontend/src/features/credits/creditPurchaseTypes.ts`
- `apps/frontend/src/api/credits.ts`
- 관련 도메인 테스트

서버 카탈로그에는 기존 필드를 삭제하거나 이름을 바꾸지 않고 다음 필드를 추가한다.

```ts
app_store_product_id: string;
app_store_payment_available: boolean;
```

상품 화면은 StoreKit이 반환한 `displayPrice`를 우선 표시한다. 서버의 `price_krw`는 상품 정책과 한국 원화 보조 표시값이며, 다른 storefront의 실제 결제 가격으로 사용하지 않는다.

### FastAPI 서버

예상 설정:

```dotenv
APP_STORE_IAP_ENABLED=false
APP_STORE_IAP_PURCHASE_ENABLED=false
APP_STORE_IAP_PURCHASE_ROLLOUT_PERCENT=0
APP_STORE_BUNDLE_ID=com.ashwoodfriends.alive
APP_STORE_APP_APPLE_ID=
APP_STORE_ROOT_CERTIFICATES_DIR=/run/secrets/app-store/certificates
APP_STORE_IAP_PRIVATE_KEY_PATH=/run/secrets/app-store/SubscriptionKey.p8
APP_STORE_IAP_KEY_ID=
APP_STORE_IAP_ISSUER_ID=
APP_STORE_IAP_CREDIT_5000_PRODUCT_ID=
APP_STORE_IAP_CREDIT_10000_PRODUCT_ID=
APP_STORE_IAP_CREDIT_30000_PRODUCT_ID=
APP_STORE_IAP_CREDIT_50000_PRODUCT_ID=
APP_STORE_IAP_CREDIT_100000_PRODUCT_ID=
```

`APP_STORE_IAP_ENABLED=false`일 때 Apple 인증서와 API 키가 없어도 기존 서버가 정상 기동해야 한다. Toss와 Google 설정 검증은 현재와 동일하게 유지한다.

예상 서버 구성:

- `app_store_accounts`: `app_account_token`과 ALIVE 사용자의 안정적인 매핑
- `app_store_notification_events`: Apple `notificationUUID` 중복 제거와 처리 상태
- `POST /credits/purchases/app-store/context`: 구매 가능 여부와 `appAccountToken` 제공
- `POST /credits/purchases/app-store/grant`: signed transaction 검증과 지급
- `POST /credits/purchases/app-store/notifications`: App Store Server Notifications V2 수신
- Apple 거래 검증·구매 처리·알림 처리 서비스와 단위 테스트

서버는 signed transaction에서 최소 다음 값을 검증한다.

- Apple JWS 서명과 인증서 체인
- Production 또는 Sandbox 환경
- `bundleId`와 Production의 `appAppleId`
- `productId`와 서버에 등록한 다섯 상품 매핑
- 소비성 상품 유형
- `transactionId`
- `appAccountToken`과 현재 로그인 사용자
- 환불·취소 여부
- 이미 처리한 거래인지 여부

초기 거래 JWS 검증 자체는 Apple API 개인키 없이 공식 검증 라이브러리와 Apple 루트 인증서로 처리할 수 있다. API 개인키는 알림 테스트, 누락 알림 조회, 거래 조회와 소비 정보 전송 등 운영 API를 사용할 때 필요하다.

### PostgreSQL과 공통 원장

기존 `credit_purchases` 테이블과 지급 원장은 유지한다. 필요한 변경은 iOS 계정·알림 매핑을 위한 새 테이블과, 실제 App Store 가격·통화를 보존하기로 결정한 경우의 추가 컬럼이다.

현재 `price_krw`만으로는 해외 storefront의 실제 결제 가격과 통화를 정확하게 보존하지 못한다. 한국 storefront만 판매할지, Apple 거래의 `price`·`currency`·`storefront`를 별도 저장할지 구현 계획에서 결정해야 한다. 이 결정은 크레딧 지급량에는 영향을 주지 않지만 정산·고객 지원·환불 감사에 영향을 준다.

## App Store Server Notifications V2

Apple 서버 알림은 V2만 사용한다. V1은 deprecated 상태다.

최소 처리 이벤트:

| 이벤트 | 처리 원칙 |
|---|---|
| `ONE_TIME_CHARGE` | 앱 지급 요청이 유실되어도 검증 후 멱등 지급 |
| `REFUND` | 기존 지급분 차감, 잔액 부족분은 부채 전환 |
| `REFUND_REVERSED` | 이전 환불 차감을 다시 복구 |
| `CONSUMPTION_REQUEST` | 사용자 동의와 개인정보 고지를 확인한 뒤 Apple에 사용량 제공 여부 결정 |
| `TEST` | 알림 URL과 JWS 검증 연결 확인 |

현재 공통 원장은 `REFUND`를 처리할 수 있지만 이미 환불한 거래를 다시 복구하는 `REFUND_REVERSED` 전이가 없다. iOS 구현 시 공통 원장에 환불 취소 재지급을 추가해야 한다. 이 변경은 기존 Toss·Google 환불 처리를 수정하지 않고 별도 메서드와 테스트로 추가한다.

`CONSUMPTION_REQUEST` 응답은 사용자 동의가 필요하고 Apple은 알림 수신 후 12시간 이내 응답을 안내한다. 초기 구매·환불 무결성과 분리해 두 번째 운영 단계로 도입할 수 있다.

Apple 공식 근거:

- [App Store Server Notifications V2 수신](https://developer.apple.com/documentation/appstoreservernotifications/receiving-app-store-server-notifications)
- [소비성 구매·환불 알림 유형](https://developer.apple.com/documentation/appstoreservernotifications/notificationtype?changes=_7)
- [Send Consumption Information](https://developer.apple.com/documentation/appstoreserverapi/send-consumption-information)

## App Store Connect 상품

다섯 상품은 `Consumable`로 등록한다. App Store Connect에 생성한 실제 상품 ID를 서버 설정과 동일하게 사용한다.

| ALIVE 상품 | 권장 App Store 제품 ID | 지급량 |
|---|---|---:|
| `credit-5000` | `ALIVE_CREDITS_500` | 500C |
| `credit-10000` | `ALIVE_CREDITS_1000` | 1,000C |
| `credit-30000` | `ALIVE_CREDITS_3150` | 3,150C |
| `credit-50000` | `ALIVE_CREDITS_5500` | 5,500C |
| `credit-100000` | `ALIVE_CREDITS_11500` | 11,500C |

필요한 콘솔·운영 준비:

- Paid Apps Agreement와 세금·은행 정보
- 상품 이름, 설명, 심사용 스크린샷과 심사 메모
- 기준 국가, 가격 포인트와 판매 지역
- Sandbox tester
- Production과 Sandbox Server Notifications V2 URL
- TestFlight 빌드와 심사 테스트 계정

공식 등록 절차는 [소비성 또는 비소비성 상품 생성](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases/)을 기준으로 한다.

## Toss·Google Play 비영향 원칙

### 변경하지 않는 계약

- Apps in Toss SDK 호출, 로그인 요구 조건과 Toss 서버 검증 API
- Google Play Billing 플러그인과 Developer API 검증·소비 처리
- `TOSS_IAP_*`, `GOOGLE_PLAY_IAP_*`, `GOOGLE_PLAY_RTDN_*` 환경 변수 의미
- 기존 `/credits/purchases/grant`와 `/credits/purchases/google-play/*` API
- 기존 카탈로그의 `sku`, `payment_available`, `google_play_product_id`, `google_play_payment_available` 필드
- `(provider, provider_order_id)` 멱등성 규칙
- 이미 적용된 마이그레이션 이력과 기존 구매 데이터

### 새 iOS 경계

- iOS 전용 API 경로와 `APP_STORE_*` 환경 변수 사용
- `provider="app_store"`로 기존 공급자와 거래 키 분리
- iOS 기능 플래그 기본값 `false`
- Apps in Toss 런타임 판정을 iOS 플랫폼 판정보다 우선
- 독립 iOS 앱에서만 StoreKit 브리지 등록·호출
- Apple 서버 알림 전용 JWS 검증과 이벤트 중복 제거

### 회귀 위험

| 위험 | 예방 조건 |
|---|---|
| iOS Toss 미니앱이 App Store 결제로 분기 | Apps in Toss 런타임을 플랫폼보다 먼저 판정 |
| iOS 기능 비활성 상태에서 서버 기동 실패 | Apple 설정 검증을 `APP_STORE_IAP_ENABLED` 뒤로 격리 |
| 카탈로그 계약 변경으로 기존 앱 오류 | 기존 필드를 보존하고 iOS 필드만 추가 |
| 공급자 간 거래 ID 충돌 | 기존 `(provider, provider_order_id)` 고유 키 유지 |
| 공통 환불 변경으로 기존 결제 회귀 | `REFUND_REVERSED`를 별도 상태 전이와 테스트로 추가 |
| StoreKit 성공 후 서버 미지급 | 서버 지급 성공 전 `Transaction.finish()` 금지 |
| Apple 알림과 앱 요청의 이중 지급 | 동일 `transactionId`에 대한 DB 멱등 처리 |

## 직접 연동과 RevenueCat

현재는 StoreKit 2 직접 연동을 권장한다. Google Play 직접 검증·소비·RTDN과 공통 원장이 이미 구현되어 있으므로 RevenueCat 도입은 iOS 추가를 넘어 Android 결제 아키텍처 이전과 이중 지급 방지 마이그레이션까지 요구한다.

구독, 복잡한 오퍼, 다수 국가의 상품 운영 또는 스토어 서버 운영 비용이 커질 때 RevenueCat을 별도 결정으로 재검토한다. 기존 분석은 [Google Play 인앱결제 검증 구조 및 RevenueCat 도입 판단](report_google-play-iap-provider-decision_2026-08-23.md)을 참고한다.

## 안전한 개발·배포 순서

1. `apps_in_toss | google_play | app_store | none` 공급자 판정과 단위 테스트를 추가한다.
2. iOS 설정, 상품 카탈로그, 새 DB 테이블과 서버 검증 코드를 모두 비활성 플래그로 배포한다.
3. 운영 Apps in Toss 상품 조회, 구매, 지급 완료와 복구를 확인한다.
4. 운영 Google Play 상품 조회, 구매, 지급, 소비와 RTDN을 확인한다.
5. StoreKit 2 브리지와 iOS 구매 훅을 구현한다.
6. App Store Connect Sandbox에서 정상 구매, 취소, Ask to Buy, 앱 강제 종료와 재진입 복구를 검증한다.
7. 중복 grant, Apple `ONE_TIME_CHARGE`, `REFUND`, `REFUND_REVERSED`를 검증한다.
8. TestFlight 사용자에게만 iOS 구매를 활성화한다.
9. iOS 기능 플래그와 rollout 비율만 점진적으로 올린다.

즉시 롤백은 `APP_STORE_IAP_PURCHASE_ENABLED=false`, `APP_STORE_IAP_PURCHASE_ROLLOUT_PERCENT=0`으로 신규 iOS 구매만 닫는 방식으로 설계한다. 이미 기록된 Apple 거래와 환불 알림은 삭제하지 않고 계속 재조정한다.

## 다음 구현의 성공 조건

- [ ] Apps in Toss Android와 iOS에서 Toss 결제 경로만 선택된다.
- [ ] 독립 Android에서 Google Play 결제 경로만 선택된다.
- [ ] 독립 iOS에서 App Store 결제 경로만 선택된다.
- [ ] 웹에서는 모든 스토어 결제가 비활성화된다.
- [ ] iOS 기능 플래그가 꺼진 서버는 Apple 비밀값 없이 정상 기동한다.
- [ ] Apple이 서명하지 않은 거래, 다른 앱·상품·사용자의 거래는 지급하지 않는다.
- [ ] 같은 Apple `transactionId`를 여러 번 제출해도 한 번만 지급한다.
- [ ] 서버 지급 실패 거래는 finish되지 않고 다음 앱 진입에서 복구된다.
- [ ] `ONE_TIME_CHARGE`, `REFUND`, `REFUND_REVERSED` 중복과 순서 역전에도 최종 원장이 일치한다.
- [ ] 기존 Toss·Google Play 테스트와 운영 스모크 테스트가 그대로 통과한다.
- [ ] iOS Sandbox와 TestFlight에서 실제 지역화 가격과 다섯 상품을 확인한다.
- [ ] iOS 신규 구매만 독립적으로 비활성화할 수 있다.

## 검증 결과

- `npm run test:domain -w apps/frontend`: **failed** — 185개 중 184개 통과, 결제 로직과 무관한 모바일 빌드 번호 정렬 테스트 1개 실패
- `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_google_play_iap.py backend/tests/test_toss_iap.py backend/tests/test_credits_api.py backend/tests/test_credit_purchases.py -q`: **passed** — 61개 통과, 기존 Starlette deprecation warning 1건
- 현재 Android `versionCode`: `9`
- 현재 iOS `CURRENT_PROJECT_VERSION`: `8`
- StoreKit 네이티브 빌드: **not run** — 구현 전이며 앱 프로세스를 새로 시작하지 않음
- App Store Connect와 Sandbox 거래: **not run** — 콘솔·기기 검증 환경이 없음

## 검증하지 못한 것

- App Store Connect의 Paid Apps Agreement, 세금·은행 정보와 상품 ID 사용 가능 여부
- Production/Sandbox Server Notifications V2 URL 설정
- 실제 StoreKit 상품 조회, 결제, Ask to Buy, 환불과 환불 취소
- TestFlight 빌드의 StoreKit 동작
- Apple API 키와 루트 인증서의 실제 배포 경로
- 한국 외 storefront 판매 여부와 거래 가격·통화 저장 정책

## 남은 위험

1. iOS 빌드 번호를 Android와 같은 9로 정렬했다. TestFlight 업로드 전 새 빌드 번호가 App Store Connect의 업로드 이력보다 큰지 다시 확인해야 한다.
2. 공통 원장에 `REFUND_REVERSED` 전이가 없으므로 Apple 환불 취소 처리 설계가 필요하다.
3. `price_krw`만으로는 해외 App Store 거래의 실제 가격과 통화를 보존할 수 없다.
4. 서로 다른 ALIVE 로그인 계정으로 Android와 iOS를 사용하면 지갑이 분리된다. 계정 연결은 별도 범위다.
5. Apple `CONSUMPTION_REQUEST` 응답에는 사용자 동의와 개인정보 고지가 필요하다.

## 다음 추천 작업

1. 이 분석을 기준으로 `documents/plans/release/store/`에 단계별 iOS App Store 소비성 결제 구현 계획을 작성한다.
2. 계획에서 상품 ID 사용 가능 여부, 판매 국가, 가격·통화 저장 정책과 `CONSUMPTION_REQUEST` 1차 포함 여부를 확정한다.
3. 구현 완료 조건에 Toss·Google Play 회귀 테스트와 iOS 독립 롤백 증거를 필수로 포함한다.
