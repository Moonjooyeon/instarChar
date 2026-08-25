---
title: App Store 소모성 크레딧 인앱 결제 구현 계획
author: black (black@ashwoodfriends.com)
created: 2026-08-25
updated: 2026-08-25
version: 1.1.0
status: implemented-local
---

# App Store 소모성 크레딧 인앱 결제 구현 계획

## 목표

iOS 네이티브 앱에서 StoreKit 2로 소모성 크레딧을 구매하고, 서버가 Apple 서명 거래를 검증한 뒤 기존 `credit_purchases`·원장에 안전하게 지급한다. 토스 및 Google Play 구매 경로와 설정값은 변경하지 않는다.

## 가정

- App Store Connect에 아래 소모성 상품이 생성되어 있으며 한국 기준 가격은 고객 결제 금액이다. 앱은 StoreKit이 반환한 현지 통화 표시 금액을 그대로 사용한다.
- 출시 전에는 모든 `APP_STORE_IAP_*` 플래그가 `false` 또는 출시 비율 `0`으로 유지된다.
- App Store Server Notifications V2 URL과 App Store Connect API 키는 배포 환경에서만 설정한다.

| 기존 오퍼 | App Store 상품 ID | 크레딧 | 한국 가격 |
| --- | --- | ---: | ---: |
| `credit-5000` | `ALIVE_CREDITS_500` | 500C | ₩4,900 |
| `credit-10000` | `ALIVE_CREDITS_1000` | 1,000C | ₩9,900 |
| `credit-30000` | `ALIVE_CREDITS_3150` | 3,150C | ₩29,500 |
| `credit-50000` | `ALIVE_CREDITS_5500` | 5,500C | ₩49,500 |
| `credit-100000` | `ALIVE_CREDITS_11500` | 11,500C | ₩99,000 |

## 범위

- StoreKit 2 Capacitor 플러그인: 상품 조회, `appAccountToken` 결제, 미완료 거래 복구, 서버 지급 성공 후 `finish()`.
- FastAPI: Apple 거래 JWS 검증, 사용자별 `appAccountToken` 저장, 구매 지급, App Store Server Notifications V2 중복 방지 및 환불 반영.
- PostgreSQL: Apple 계정 매핑·알림 이벤트 테이블과 필요한 결제 감사 정보 마이그레이션.
- 프런트: iOS 런타임에서만 iOS 상품 ID·StoreKit 표시 금액·구매/복구 훅을 선택.
- 테스트와 운영 환경 변수 예시 및 분석 보고서의 실제 상품 ID 갱신.

## 제외 범위

- 토스/Google Play 결제 코드, 상품 ID, 가격 표시, 롤아웃 정책 변경.
- App Store Connect의 심사용 스크린샷·Review Notes 제출과 실제 심사 제출.
- Apple의 `CONSUMPTION_REQUEST` 응답 자동화. 개인정보 동의·소비 이력 보관 정책이 정해진 뒤 별도 작업으로 처리한다.

## 영향 경로

```text
iOS 크레딧 화면
  -> useAppStoreCreditPurchase
  -> AppStoreBilling (StoreKit 2)
  -> POST /credits/purchases/app-store/grant (transaction JWS)
  -> Apple 서명·bundle ID·environment·appAccountToken 검증
  -> CreditPurchaseRepository.apply
  -> credit_purchases / credit_ledger_entries / credit_accounts
  -> 지급 성공 후 StoreKit Transaction.finish()

Apple App Store Server Notification V2
  -> POST /credits/purchases/app-store/notifications
  -> 알림 JWS 검증·notificationUUID 중복 제거
  -> 동일 거래 재검증·환불 또는 환불 취소 반영
```

## 구현 단계

1. App Store 상품 매핑과 `APP_STORE_IAP_*` 설정·검증을 추가한다. 기존 `CREDIT_PRODUCTS`의 토스/Google 가격은 유지하고 iOS 전용 가격은 `supply_price_krw` 기준으로 저장한다.
2. Apple 계정 토큰, 알림 이벤트, 결제 통화·스토어프런트 감사 필드를 위한 Alembic 마이그레이션과 ORM·저장소를 추가한다.
3. 공식 App Store Server Library로 JWS 거래/알림을 검증하는 서비스를 추가하고, 지급·환불·환불 취소의 멱등성을 기존 원장에 연결한다.
4. iOS StoreKit 2 Capacitor 플러그인을 추가하고 `AliveBridgeViewController`에 등록한다. `purchase`, `unfinished`, `finish` 경로를 구현한다.
5. 프런트 API 타입·iOS 런타임 판별·구매/복구 훅·크레딧 화면의 공급자 선택을 추가한다. Apps in Toss 런타임은 iOS에서도 토스가 우선한다.
6. 단위/API 테스트, TypeScript 검사, Python 컴파일, iOS 정적 빌드 가능 여부를 검증하고 문서를 실제 결과로 갱신한다.

## 성공 조건

- iOS 앱에서 App Store Connect의 다섯 상품과 StoreKit 현지 가격이 보인다.
- 서버는 유효한 Apple 거래·해당 bundle ID·허용 환경·현재 ALIVE 사용자의 `appAccountToken`만 지급한다.
- 같은 Apple 거래 또는 알림을 반복 전송해도 크레딧과 원장이 한 번만 변경된다.
- 미완료 결제는 앱 재진입 시 서버 지급 후 완료 처리된다.
- 환불은 기존 차감/부채 정책을 따르고, 환불 취소는 같은 거래를 한 번만 복구한다.
- App Store 플래그가 꺼진 환경과 Android/Apps in Toss 런타임에서는 기존 동작이 유지된다.

## 검증 계획

- `PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache backend/.venv/bin/python -m compileall -q backend/app backend/tests backend/migrations`
- `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests/test_app_store_iap.py backend/tests/test_credits_api.py backend/tests/test_credit_purchases.py`
- `npm run test:domain -w apps/frontend` 및 프런트 TypeScript/build 검사
- Xcode/StoreKit Configuration 또는 Sandbox 계정으로 상품 조회, 구매, 앱 강제 종료 후 복구, 환불 알림을 수동 확인

## 위험과 롤백

- Apple 키·issuer·bundle ID·notification URL 오설정은 서버 검증 실패로 이어진다. 플래그를 유지한 채 Sandbox에서 먼저 확인한다.
- `Transaction.finish()`를 서버 지급 전에 호출하면 복구 기회를 잃을 수 있다. 지급 응답이 `granted`일 때만 호출한다.
- 환불 취소는 현 원장에 없는 상태 전이이므로 별도 멱등 키를 사용한다. 이상 거래는 `review`로 남기고 자동 지급하지 않는다.
- 문제 발생 시 `APP_STORE_IAP_PURCHASE_ENABLED=false`와 롤아웃 `0`으로 iOS 신규 결제만 중단한다. 기존 토스·Google Play 설정과 구매 데이터는 영향받지 않는다.

## 변경 파일

- `backend/app/core/credit_products.py`, `backend/app/core/config.py`: App Store 상품 ID, 롤아웃, 안전한 서버 검증 설정을 추가했다.
- `backend/migrations/versions/20260825_0033_app_store_iap.py`: App Store 계정 토큰·알림 이벤트와 결제 감사 필드를 추가한다.
- `backend/app/services/app_store_iap.py`, `backend/app/services/app_store_notifications.py`: Apple JWS 검증, 지급, 알림 중복 제거, 환불·환불 취소 처리를 추가했다.
- `ios/App/App/AppStoreBilling.swift`: StoreKit 2 상품 조회·구매·미완료 거래 복구·거래 업데이트·완료 처리를 추가했다.
- `apps/frontend/src/features/credits/useAppStoreCreditPurchase.ts`: iOS 전용 구매와 복구 흐름을 추가했다.

## 검증 결과

- `npm run typecheck -w apps/frontend`: passed
- `npm run test:domain -w apps/frontend`: passed (189 passed)
- `PYTHONPYCACHEPREFIX=/private/tmp/instarChar-pycache backend/.venv/bin/python -m compileall -q backend/app backend/tests backend/migrations`: passed
- `PYTHONPATH=backend backend/.venv/bin/pytest backend/tests -q`: passed (458 passed, 1 skipped)
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build`: passed
- `PYTHONPATH=. .venv/bin/alembic -c alembic.ini heads`: passed (`20260825_0033`)

## 검증하지 못한 것

- 실제 PostgreSQL 마이그레이션 적용: 로컬 PostgreSQL이 실행 중이지 않아 `alembic check`는 연결 실패했다. 앱 프로세스·DB는 시작하지 않았다.
- Apple Sandbox와 App Store Server Notifications의 실제 외부 호출: 배포된 Apple Root CA 파일, App Apple ID, Sandbox 계정, 공개 알림 URL이 필요하다.

## 남은 위험

- App Store Connect의 판매 가능 상태, 세금 카테고리, 심사용 메타데이터는 코드 완료 뒤에도 별도 출시 게이트다.

## 다음 추천 작업

1. 배포 비밀값에 `APP_STORE_IAP_ROOT_CERTIFICATE_PATHS`, `APP_STORE_IAP_APP_APPLE_ID`, 32바이트 이상 `APP_STORE_IAP_SUBJECT_HMAC_KEY`를 설정하고 마이그레이션을 적용한다.
2. App Store Connect의 V2 알림 URL을 `/api/credits/purchases/app-store/notifications`로 설정하고 Sandbox에서 다섯 상품·복구·환불을 확인한다.
3. 검증 뒤에만 `APP_STORE_IAP_ENABLED=true`, 구매 플래그와 롤아웃을 단계적으로 연다.
