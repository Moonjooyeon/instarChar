---
title: Android Google Play 소비성 일회성 크레딧 결제 구현 계획
author: black (black@ashwoodfriends.com)
created: 2026-08-21
updated: 2026-08-21
version: 0.3.0
status: in-progress
---

# Android Google Play 소비성 일회성 크레딧 결제 구현 계획

## 목표

독립 Android 앱에서 Google Play의 소비성 일회성 제품으로 크레딧을 판매한다. 구매 토큰은 서버에서 검증하고, 크레딧은 한 번만 지급하며, 지급 성공 뒤 서버가 소비 처리한다. 대기 구매, 앱 재시작, 취소, 환불도 서버 원장과 일치해야 한다.

## 가정

- 이번 작업의 대상은 `com.ashwoodfriends.alive` 독립 Android 앱뿐이다.
- 현재 크레딧 팩 다섯 개와 첫 구매 10% 보너스 정책은 유지한다.
- Android 사용자는 기존 Google 로그인으로 ALIVE 계정에 로그인한다.
- Play Console, Google Payments 프로필, Google Cloud 프로젝트와 서비스 계정 권한은 배포 담당자가 제공한다.
- Apps in Toss 결제는 이미 운영 중인 별도 공급자이며 기능과 설정을 변경하지 않는다.

## 범위

1. Google Play Console에 소비성 일회성 제품과 내부 테스트 배포를 준비한다.
2. Android 매니페스트, 공식 Play Billing Library, Capacitor Android 브리지를 추가한다.
3. Android 런타임에서만 Play 상품을 조회하고 구매를 시작하는 프런트엔드 어댑터를 추가한다.
4. Google Play 구매 토큰을 검증·지급·소비하는 FastAPI 서버 경로와 저장 모델을 추가한다.
5. Google RTDN과 Voided Purchases 처리로 구매 취소·환불을 원장에 반영한다.
6. 토스와 Google Play 공급자를 구분한 출시 기록과 테스트 증거를 남긴다.

## 제외 범위

- iOS StoreKit 또는 App Store 결제 구현
- 웹 결제와 외부 결제 링크
- Apps in Toss SDK, 토스 로그인, 토스 IAP 정책의 변경
- Google/Apple/Toss 계정 연결 또는 지갑 통합
- 구독, 렌트, 할인 오퍼, 다중 수량 구매

## 현재 상태

- Android에는 Billing 권한, 공식 Play Billing Library, Capacitor 브리지가 반영되어 있다.
- 크레딧 카탈로그는 토스 SKU와 Google Play 제품 ID를 별도 필드로 반환한다.
- `credit_purchases`는 공급자+구매 ID 복합 유니크 키와 Google 소비 완료 시각을 사용한다.
- Google Play 결제와 RTDN은 기본 비활성 상태이며, 서비스 계정 파일·제품 활성화·내부 테스트 AAB·Pub/Sub 푸시 인증 설정이 있어야 켤 수 있다.
- Android AAB 생성 경로와 서명 검증은 존재한다. 새 결제 기능은 내부 테스트 트랙부터 검증한다.

## 제품 카탈로그 초안

제품 ID는 Play Console에서 생성 후 변경하거나 재사용할 수 없으므로, 가격이 아니라 지급 크레딧을 기준으로 고정한다. 실제 활성화 전에는 제품명·설명·원화 가격을 Play Console 화면과 서버 정책으로 대조한다.

| offer_id | Google Play 제품 ID | 기본 지급량 | 현재 표시 가격 |
|---|---|---:|---:|
| `credit-5000` | `alive.credits.500` | 500C | 5,390원 |
| `credit-10000` | `alive.credits.1000` | 1,000C | 10,890원 |
| `credit-30000` | `alive.credits.3150` | 3,150C | 32,450원 |
| `credit-50000` | `alive.credits.5500` | 5,500C | 54,450원 |
| `credit-100000` | `alive.credits.11500` | 11,500C | 108,900원 |

- 유형: 소비성 일회성 제품
- 구매 옵션: `Buy`
- 제공 유형: Digital content
- 첫 구매 보너스: Play 상품 가격이나 상품 ID가 아니라 서버의 기존 원장 정책으로 계산한다.
- 초기에는 다중 수량 구매를 비활성화한다.

## 영향 경로

```text
사용자: Android 크레딧 구매 선택
→ CreditStoreScreen / Google Play 구매 어댑터
→ Capacitor Android Billing 브리지
→ Google Play 결제창과 purchase token
→ POST /api/credits/purchases/google-play/grant
→ Google Play Developer API 상태 검증
→ CreditPurchase 원장 예약·중복 방지·크레딧 지급
→ Google Play consume
→ 잔액과 구매 내역 갱신

Google RTDN 또는 앱 재시작의 미처리 구매 조회
→ 서버 구매 상태 재검증
→ 지급, 취소, 환불 또는 부채 정산
```

## 구현 단계

### 1. 콘솔 및 배포 사전 조건

1. Play Console 앱 레코드의 패키지명과 Android 서명 키가 현재 앱과 일치하는지 확인한다.
2. Google Payments 프로필 연결과 판매 국가·세금·사업자 정보를 확인한다.
3. `BILLING` 권한과 Play Billing Library가 포함된 Android AAB를 새 `versionCode`로 내부 테스트 트랙에 업로드한다.
4. 라이선스 테스터와 내부 테스트 옵트인 URL을 준비한다.
5. 결제 기능이 포함된 AAB가 Play Console에 인식된 뒤에만 제품을 생성·활성화한다.

완료 기준: 내부 테스트 트랙에서 설치 가능한 새 AAB와 테스트 계정이 준비되어 있다.

### 2. Play Console 제품 등록

1. 일회성 제품 다섯 개를 위 제품 ID로 생성한다.
2. 각 상품에 정확한 이름·설명·아이콘·지역별 가격을 입력한다.
3. 각 상품에 `Buy` 구매 옵션을 만들고 `Active` 상태로 전환한다.
4. 초기에 다중 수량, 렌트, 할인 오퍼, 사전 주문은 사용하지 않는다.
5. 콘솔의 제품 ID·가격·상태·스크린샷을 릴리스 기록에 남긴다.

완료 기준: 내부 테스트에서 Play Billing Library가 다섯 활성 상품을 모두 반환한다.

### 3. Android 네이티브 결제 경계

1. `android/app/src/main/AndroidManifest.xml`에 `com.android.vending.BILLING` 권한을 선언한다.
2. `android/app/build.gradle`에 구현 시점의 지원되는 공식 Play Billing Library를 고정 버전으로 추가한다.
3. `MainActivity`와 분리된 Capacitor 플러그인으로 상품 조회, 구매 시작, 미처리 구매 조회를 제공한다.
4. `PurchasesUpdatedListener`에서 성공, 취소, 오류, `PENDING`을 구분해 웹 레이어로 전달한다.
5. `queryProductDetailsAsync`로 최신 상품과 지역화 가격을 받고, 장기 캐시하지 않는다.
6. 구매 시작 시 현재 ALIVE 사용자를 식별할 수 있는 서버 생성 난독화 계정 식별자를 Play에 전달한다.

완료 기준: Android 앱이 활성 Play 상품의 이름·가격을 표시하고, 테스트 결제 결과를 purchase token과 함께 프런트엔드에 전달한다.

### 4. 프런트엔드 런타임 분리

1. `apps-in-toss`, `android-capacitor`, `ios-capacitor`, `web` 런타임을 한 곳에서 판별한다.
2. 기존 `useTossCreditPurchase`를 변경하지 않고 Google Play 전용 구매 어댑터를 추가한다.
3. `CreditStoreScreen`은 현재 런타임의 어댑터만 사용하고, 상품 가격은 해당 스토어 응답을 우선 표시한다.
4. Android 외 런타임에서는 Google Play 구매 버튼과 관련 오류 문구를 노출하지 않는다.
5. 구매 중, 대기 중, 지급 완료, 복구 중, 실패 상태를 사용자에게 구분해 표시한다.

완료 기준: Android만 Play 결제창을 열고, 앱인토스는 기존 토스 결제 흐름을 유지한다.

### 5. 서버 검증 및 원장 일반화

1. Google Play Developer API용 서비스 계정과 키를 서버 시크릿에만 설정한다. 키를 앱 번들, 저장소, 로그에 넣지 않는다.
2. Google Play 구매 토큰을 입력으로 받는 전용 API를 만든다. 클라이언트가 보낸 가격, 지급량, 구매 상태는 신뢰하지 않는다.
3. Google Play API에서 패키지명, 제품 ID, 구매 상태, 소비 상태, 난독화 계정 식별자를 검증한다.
4. 공급자를 `google_play`로 기록하고, 공급자와 구매 토큰의 복합 유니크 키로 멱등성을 보장한다.
5. 거래 식별자와 원장 멱등 키에 공급자를 포함한다. 토스 주문 ID와 Google 구매 토큰이 충돌하지 않게 한다.
6. `provider_order_id` 및 API 입력 길이를 Google의 가변 길이 토큰을 수용하도록 확장한다.
7. 서버 검증과 크레딧 지급이 성공한 뒤에만 Google Play Developer API로 소비 처리한다.
8. 소비 호출 실패는 재시도 대상으로 남기고, 이미 지급한 크레딧을 중복 지급하지 않는다.

완료 기준: 동일 토큰을 여러 번 보내도 한 번만 지급되고, 서버 검증 실패·대기 상태에는 지급되지 않는다.

### 6. 복구, 취소, 환불 및 RTDN

1. 앱 시작과 크레딧 화면 진입에서 미처리 Play 구매를 조회해 서버에 재전송한다.
2. Google Cloud Pub/Sub와 Play Console RTDN을 연결하고, FastAPI 수신 경로에서 Pub/Sub 인증과 `messageId` 멱등성을 검증한다.
3. RTDN을 받은 뒤 반드시 Google Play Developer API로 실제 상태를 재조회한다.
4. `ONE_TIME_PRODUCT_PURCHASED`, 대기 구매 취소, Voided Purchase를 처리한다.
5. 환불된 지급분은 기존 지갑의 차감·부채 정책으로 정산하고 감사 로그를 남긴다.
6. 기존 토스 재조정 스케줄러를 공급자별로 분리하거나 공통화하되, 토스 재조정 주기와 장애 격리를 보존한다.

완료 기준: 앱이 꺼진 동안의 구매 완료·환불도 서버 원장과 잔액에 반영되고, 중복 RTDN은 영향이 없다.

### 7. 품질 검증과 출시

1. Android·프런트엔드·백엔드 단위 테스트로 상품 매핑, 상태 전이, 토큰 재전송, 멱등성, 부채 정산을 검증한다.
2. 라이선스 테스터로 정상 구매, 취소, 지연 승인, 지연 취소, 앱 강제 종료 후 복구를 검증한다.
3. Google Play 내부 테스트에서 실제 Play 결제창과 서버 잔액 반영을 확인한다.
4. 내부 테스트 통과 뒤 폐쇄 테스트, 프로덕션 순으로 진행한다.
5. 새 Android AAB의 버전과 해시, 활성 상품, 서비스 계정 권한, RTDN 구독 상태를 릴리스 기록에 남긴다.

완료 기준: 모든 필수 시나리오가 통과하고, 미처리 구매·환불·재시도에 운영자가 대응할 수 있다.

## 성공 조건

- Android 앱이 Play Console의 다섯 소비성 상품을 정확한 가격으로 표시한다.
- 구매 성공은 서버 검증된 토큰에 대해서만 한 번 지급된다.
- 소비 처리 후 같은 상품을 다시 구매할 수 있다.
- `PENDING`, 취소, 서버 실패, 앱 재시작, 토큰 재전송이 중복 지급으로 이어지지 않는다.
- 환불·무효 구매가 RTDN과 서버 재검증을 거쳐 지갑에 반영된다.
- Apps in Toss 결제와 로그인 흐름에 회귀가 없다.
- Android 내부 테스트 트랙에서 최신 AAB로 위 흐름을 수동 검증한다.

## 검증 계획

| 구분 | 검증 | 기준 |
|---|---|---|
| 정적 | `npm run typecheck -w apps/frontend` | 통과 |
| 프런트엔드 | `npm run test:domain -w apps/frontend` | Google Play와 토스 런타임 분리 테스트 통과 |
| 백엔드 | `make backend-test` | 토큰 검증·멱등성·환불·기존 토스 테스트 통과 |
| Android | `make android-bundle-release` | 새 AAB 생성 및 매니페스트 권한 확인 |
| Play Console | 내부 테스트·라이선스 테스터 | 다섯 상품 조회와 결제창 표시 |
| 기기 | 실제 Android 기기 | 성공·취소·대기·재시작·재구매·환불 확인 |
| 운영 | Pub/Sub RTDN 테스트 알림 | 수신 인증, 메시지 중복 제거, 상태 재검증 |

프로젝트 규칙에 따라 프런트엔드·백엔드 프로세스는 새로 시작하지 않는다. 기기 검증은 이미 실행 중인 프로세스 또는 Play 내부 테스트 앱에서만 진행한다.

## 위험과 롤백

| 위험 | 완화 | 롤백 |
|---|---|---|
| 토큰을 신뢰해 크레딧을 위조 지급 | 서버의 Google API 검증과 멱등 키 사용 | Google Play 판매 기능 플래그 비활성화 |
| 지급 전에 소비하거나 두 번 지급 | 지급 완료 후 소비, DB 트랜잭션과 재시도 상태 보존 | 미처리 거래를 `review`로 보류하고 수동 재조정 |
| 환불 후 이미 사용한 크레딧 | 환불 원장과 부채 정산, RTDN 처리 | 해당 상품 구매 옵션 비활성화, 영향 거래 감사 |
| 토스 흐름 회귀 | 공급자별 어댑터·API·테스트 분리 | Google Play 코드와 플래그만 비활성화 |
| 콘솔 가격과 앱 문구 불일치 | 출시 전 콘솔·서버 카탈로그 대조 | 제품 구매 옵션 비활성화 후 수정 |
| RTDN 수신 장애 | 재시도·중복 제거·주기적 감사 | Google API 재조정 작업으로 누락 거래 복구 |

## 토스 운영을 보존하는 안전 배포 순서

첫 배포의 목적은 Play Console이 결제 권한이 포함된 AAB를 인식하게 하는 것이다. Google Play 판매를 활성화하는 배포가 아니다.

1. 서버와 DB 마이그레이션을 배포하되 `GOOGLE_PLAY_IAP_ENABLED=false`, `GOOGLE_PLAY_IAP_PURCHASE_ENABLED=false`, `GOOGLE_PLAY_RTDN_ENABLED=false`를 유지한다. 이 상태에서는 서비스 계정 파일, Google 상품 ID, Google HMAC 키, Pub/Sub 값이 없어도 서버가 기동하며 Android 화면에 Play 구매 가능 상품을 내보내지 않는다.
2. 기존 토스 환경 변수와 토스 스케줄러 값은 변경하지 않는다. 배포 직후 앱인토스 로그인, 상품 조회, 결제 시작, 기존 주문 복구를 운영 체크리스트로 재확인한다.
3. 현재 Play Console의 가장 높은 `versionCode`보다 큰 새 Android `versionCode`로 서명 AAB를 만들고 내부 테스트 트랙에만 업로드한다. 현재 소스의 값은 7이므로 Console에 이미 7 이상이 있다면 먼저 증가시킨다.
4. Play Console에서 일회성 제품을 등록하고, 서버 시크릿·서비스 계정 권한·내부 테스터를 준비한다. Pub/Sub 푸시 구독은 `POST /api/credits/purchases/google-play/rtdn`에 OIDC 인증을 사용하고, `GOOGLE_PLAY_RTDN_AUDIENCE`와 푸시 서비스 계정 이메일을 서버에만 설정한다. 이 단계까지도 Google Play 기능 플래그는 끈다.
5. 별도 내부 테스트 배포에서만 Google 통합·RTDN을 켜고 `GOOGLE_PLAY_IAP_PURCHASE_ROLLOUT_PERCENT=0`으로 시작한다. RTDN 테스트 알림이 204를 받는 것을 먼저 확인한 뒤 지정 테스터로만 1% 이상을 열기 전 구매·취소·대기·재시작·재구매·환불을 확인한다.
6. Google 문제 시 세 Google 기능 플래그를 즉시 `false`로 되돌린다. Apps in Toss 코드·설정·결제 경로에는 이 롤백이 영향을 주지 않는다.

DB 마이그레이션 `20260821_0031`은 기존 구매 ID를 삭제하거나 수정하지 않는다. 구매 ID 길이를 확장하고, 기존 단일 유니크 제약을 공급자+구매 ID 유니크 제약으로 교체하며, nullable 소비 시각과 빈 기본값의 원장 참조를 추가한다. 다만 유니크 제약 교체에는 짧은 테이블 잠금이 필요할 수 있으므로 운영 트래픽이 낮은 시간에 실행하고, 실행 전 백업과 마이그레이션 소요 시간 확인이 필요하다.

## 외부 선행 작업

- Play Console 개발자 계정과 Google Payments 프로필 연결 확인
- 내부 테스트 트랙 접근 권한과 라이선스 테스터 이메일 준비
- Google Cloud 프로젝트, Pub/Sub 토픽·구독, 서비스 계정 생성 권한 준비
- Google Play Developer API가 서버 서비스 계정에서 호출되도록 Console 권한 부여
- 제품 ID, 제품명, 설명, 한국 판매 가격과 판매 국가 최종 승인

## 참고

- [Google Play Billing 시작하기](https://developer.android.com/google/play/billing/getting-ready)
- [일회성 제품 생성과 활성화](https://support.google.com/googleplay/android-developer/answer/16430488)
- [일회성 구매 수명주기](https://developer.android.com/google/play/billing/lifecycle/one-time)
- [서버 백엔드 통합](https://developer.android.com/google/play/billing/backend)
- [RTDN 수명주기](https://developer.android.com/google/play/billing/lifecycle)
- [Play Billing 테스트](https://developer.android.com/google/play/billing/test)

## 구현 및 검증 결과

- Android: `com.android.vending.BILLING` 권한, Play Billing Library 9.1.0, Capacitor `GooglePlayBilling` 브리지를 추가했다. 상품 조회, 구매 시작, 미처리 구매 조회, `PENDING` 전달을 구현했다.
- 프런트엔드: Android Capacitor 런타임에서만 Google Play 상품 가격·구매 흐름을 사용하고, Apps in Toss는 기존 `useTossCreditPurchase` 경로를 유지한다.
- 서버: Google Play Developer API의 `productsv2` 구매 토큰 검증, 난독화 계정 ID 대조, 공급자+토큰 멱등성, 서버 지급 뒤 소비 처리 경로를 추가했다. RTDN은 Pub/Sub OIDC 발신자·audience를 검증하고, `messageId` 중복을 제거하며, 구매 완료/취소는 Developer API 재조회 후 반영하고 무효 구매는 기존 원장을 환불 처리한다. 기본 기능 플래그는 모두 꺼져 있다.
- 데이터: Google의 가변 길이 구매 토큰을 수용하도록 구매 ID 길이와 유니크 키를 확장하고, Google 원장 키는 토큰 해시를 사용해 토스 키와 충돌하지 않게 했다.
- 자동 검증: `npm run typecheck -w apps/frontend`, `npm run test:domain -w apps/frontend`, Google Play 관련 백엔드 테스트, Android debug 컴파일을 통과했다.
- Play Console 실제 상태 확인: not run — 콘솔 접근 권한이 없다.
- Android 기기·내부 테스트 구매: not run — 새 서명 AAB, 제품 등록, 서비스 계정 권한이 아직 없다.

## 검증하지 못한 것

- 실제 Play Console 제품 생성 가능 여부와 Google Payments 프로필 상태
- 서비스 계정의 Google Play Developer API 권한
- Pub/Sub 푸시 인증 및 RTDN 수신
- 실제 구매·소비·환불의 스토어 동작

## 남은 위험

- 계정 연결을 구현하지 않는 한 Android Google 로그인 지갑과 앱인토스 토스 로그인 지갑은 서로 분리된다.
- Play Console에 입력하는 실제 가격과 현재 토스 기준 가격은 자동으로 동기화되지 않는다.
- RTDN 없이 출시하면 환불과 기기 밖 상태 변경을 즉시 반영하지 못한다.

## 다음 추천 작업

1. Play Console의 현재 최고 Android `versionCode`를 확인한 뒤 새 번호를 정한다.
2. Google 기능 플래그를 끈 상태로 서버·DB를 먼저 안전 배포하고 토스 운영 스모크 테스트를 한다.
3. 서명된 새 내부 테스트 AAB를 업로드해 Play Console의 제품 등록 조건을 충족한다.
3. 그 다음 단계에서 서버 검증·소비·RTDN을 포함한 Google Play 결제 구현을 시작한다.
