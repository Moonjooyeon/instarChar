---
title: 앱인토스 인앱결제 승인 후 적용 및 출시 검토 계획
author: black (black@ashwoodfriends.com)
created: 2026-08-11
updated: 2026-08-11
version: 2.4.0
status: implemented-local
---

# 앱인토스 인앱결제 승인 후 적용 및 출시 검토 계획

## 목표

앱인토스 인앱결제 승인 이후 `alive`의 크레딧 상품을 안전하게 판매할 수 있도록 콘솔 설정, 프런트엔드 결제 흐름, FastAPI 주문 검증, PostgreSQL 구매 원장, 구매 복원, 환불 정합성, 샌드박스 QA와 운영 절차를 하나의 실행 계획으로 확정한다.

승인 완료는 결제 기능을 사용할 자격이 준비됐다는 뜻으로 본다. 실제 판매 시작은 이 문서의 구현·검토·샌드박스·운영 게이트를 모두 통과한 뒤 `payment_available`과 콘솔 상품 노출을 단계적으로 활성화하는 시점이다.

## 가정

- 2026-08-11 완료된 승인은 앱인토스의 인앱결제 기능 또는 정산 사용 승인이다.
- 1차 결제 플랫폼은 Apps in Toss이며, App Store·Google Play 독립 앱 결제는 이번 범위에서 구현하지 않는다.
- 현재 크레딧 팩은 반복 구매할 수 있는 디지털 내부 재화이므로 앱인토스의 **소모품**으로 등록한다.
- 자동 갱신 구독과 비소모품은 이번 범위에서 제외한다.
- 토스 로그인 사용자는 `users.provider = toss`, `users.provider_subject = userKey`로 식별한다.
- 클라이언트의 결제 성공 콜백만으로 크레딧을 지급하지 않는다. 서버가 mTLS 주문 상태 조회로 `orderId`, `sku`, 상태와 사용자를 검증한 뒤 지급한다.
- 결제 사고 방지를 위해 모든 필수 게이트가 끝날 때까지 `payment_available=false`와 비활성 결제 버튼을 유지한다.

## 범위

- 앱인토스 콘솔의 사업자·정산 정보, 소모품 SKU, 상품 이미지, 판매가와 노출 상태 확정
- 토스 IAP 상품 목록 조회와 일회성 결제 요청 UI
- 서버의 주문 상태 검증과 멱등한 크레딧 지급
- `CreditPurchase` 구매 원장과 전역 `orderId` 중복 방지
- 결제 완료 후 지급 실패 주문의 복원
- 완료·환불 주문 재조정과 운영 대응
- 첫 구매 보너스의 1회 지급 및 환불 회수 정책
- 계정 삭제·재가입 이후에도 토스 사용자 구매 이력 기준으로 첫 구매 보너스 재지급 방지
- 계정 삭제 시 Toss 로그인 연결 해제, 구매 원장 분리 보관과 법정 기간 만료 파기
- 샌드박스 필수 시나리오와 출시 전 승인 게이트
- 결제 중단, 롤백, 고객 문의와 정산 확인 절차

## 제외 범위

- 자동 갱신 구독, 무료 체험, 구독 할인과 해지 처리
- 독립 iOS·Android 앱의 StoreKit·Google Play Billing 구현
- 앱인토스 외부 PG 또는 토스페이 연결
- 크레딧 가격·AI 기능별 차감량 자체를 다시 설계하는 작업
- 프로모션, 광고, 토스 포인트와 크레딧의 결합
- 실제 운영 인증서·키·Basic Auth 값을 문서나 저장소에 기록하는 작업

## 구현 난이도와 예상 시간

전체 난이도는 **높음(4/5)** 이다. 결제 버튼 연결 자체보다 서버 권한 주문 검증, 멱등 지급, 실패 복원, 환불 부채, 탈퇴 후 법정 보존, mTLS와 실제 콘솔·정산 대조를 함께 맞춰야 하기 때문이다. 단위 테스트 통과만으로 실제 결제 성공을 판정할 수 없고 콘솔·스테이징·토스 앱 실기기 증거가 반드시 필요하다.

| 작업 | 난이도 | 예상 작업시간 | 현재 상태 | 시간에 포함하지 않는 것 |
| --- | --- | ---: | --- | --- |
| 구매 원장·서버 주문 검증·멱등 지급 | 높음 | 1.5~2일 | 로컬 완료 | 운영 mTLS 발급 대기 |
| 프런트 결제·미지급 복원·최소 런타임 게이트 | 중상 | 1~1.5일 | 로컬 완료 | 실제 토스 앱 QR 검수 |
| 환불·부채·재조정·재무 감사 | 높음 | 1~1.5일 | 로컬 완료 | 콘솔 실제 환불 처리시간 |
| 탈퇴·Toss 연결 해제·5년 보존 수명주기 | 높음 | 0.5~1일 | 로컬 완료 | 법무 검토 대기 |
| 상품 이미지·AIT·콘솔 매니페스트 사전 검증 | 중간 | 0.5~1일 | 로컬 완료 | 콘솔 업로드 대기 |
| AIT 업로드·상품 5개 등록·최소 지원 버전 선택 | 중간 | 1~2시간 | 상품 등록 완료·번들 교체 대기 | 콘솔 검토 대기 |
| 스테이징 migration·SKU·mTLS·알림 연결 | 높음 | 2~4시간 | 외부 환경 대기 | 인증서 발급·인프라 승인 대기 |
| Android/iOS 샌드박스 결제·복원·환불 QA | 높음 | 0.5~1일 | 미실행 | 오류 재현이나 콘솔 응답 대기 |
| 개인정보처리방침·유료서비스·환불 약관 확정 | 외부 전문 검토 | 개발 반영 2~4시간 | 초안 완료·승인 대기 | 대표자·법무 검토 1~3영업일 이상 |
| 10% → 25% → 50% → 100% 운영 확대 | 운영 관찰 | 단계별 조작 30분 이내 | 미실행 | 각 단계 최소 24시간 관찰 |

현재부터 실제 판매 직전까지의 **순수 엔지니어링·QA 작업은 입력값과 권한이 준비된다는 가정에서 1~2영업일**이다. 여기에 법무·정산·인증서 승인 시간과 최소 24시간의 초기 10% 관찰 시간을 별도로 더한다. 콘솔 가격이 서버 정책과 다르거나 샌드박스에서 복원·환불 결함이 나오면 수정과 재검증에 0.5~2일이 추가될 수 있다.

예상 시간의 전제는 다음과 같다.

- Apps in Toss 콘솔 접근 권한, 승인 화면, 사업자·정산 정보와 상품 등록 권한이 준비돼 있다.
- 운영 또는 스테이징 mTLS 인증서·키와 비밀 저장소 접근 권한이 준비돼 있다.
- Android 5.234.0 이상, iOS 5.233.0 이상과 그 미만 버전 테스트 환경을 각각 사용할 수 있다.
- 제품·재무가 다섯 상품의 최종 판매가·지급량을 같은 날 승인한다.
- 개인정보·유료서비스 문구는 제공된 초안을 기준으로 승인자가 변경 요청을 한 번에 반환한다.

## 공식 가이드 적용 기준

### 콘솔 및 상품

공식 [인앱 결제 가이드](https://developers-apps-in-toss.toss.im/guide/monetization/in-app-payment)는 사업자 정보 등록, 약관 동의, 정산 정보 검토, 상품 등록 순서를 안내한다. `alive`에는 다음과 같이 적용한다.

- 크레딧은 사용 후 소진되고 다시 구매할 수 있으므로 상품 유형을 `소모품`으로 설정한다.
- 현금성·환가성 재화로 설명하거나 토스 포인트와 결합하지 않는다.
- 상품명은 지급량을 그대로 드러내고, 상품 이미지는 1024 × 1024px로 준비한다.
- 콘솔에는 VAT 제외 공급가를 400원 이상 1,400,000원 이하, 10원 단위로 입력하며 VAT 포함 판매가는 자동 계산된다. 앱의 하드코딩 가격이 아니라 콘솔의 최종 `displayAmount`를 사용자에게 표시한다.
- 인앱 상품의 `최소 지원 버전`은 해당 상품을 포함하는 **업로드된 미니앱 번들 버전**을 선택한다. 토스 앱 IAP API 최소 버전 `5.219.0`이나 프런트엔드 `package.json`의 `0.1.0`을 입력하는 항목이 아니다.
- `최소 지원 버전` 목록이 비어 있으면 상품 등록을 진행하지 않고, 먼저 `npm run build:toss`로 `.ait` 번들을 만든 뒤 콘솔 `앱 출시` 메뉴에 업로드한다. 업로드 성공과 테스트용 스킴·QR 생성을 확인한 후 상품 등록 화면을 다시 열어 해당 버전을 선택한다.
- 콘솔 할인은 등록 후 수정할 수 없으므로 초기 출시에서는 사용하지 않는다. 현재 앱의 “첫 구매 10% 추가”는 가격 할인이 아니라 서버가 지급하는 크레딧 보너스로 별도 처리한다.
- 실제 판매 전까지 상품 노출을 OFF로 유지하고, 샌드박스 확인 단계에서 필요한 상품만 ON으로 전환한다.
- 결제 알림 URL을 사용하려면 이벤트 계약, 인증, 재시도 정책을 먼저 확인한다. Basic Auth 값은 비밀 저장소에 보관하고 알림 처리는 멱등하게 구현한다.

공식 가이드는 `.ait` 업로드 시 배포 ID와 테스트 QR이 생성되는 절차를 명시하지만 상품 폼의 `최소 지원 버전` 의존성을 본문으로 설명하지는 않는다. 위 판단은 사용자가 제공한 현재 콘솔 화면에서 선택지가 비어 있고, 프로젝트에 콘솔 업로드 이력이 확인되지 않는 점을 함께 근거로 한 현재 콘솔 동작 해석이다. 업로드 후에도 목록이 비어 있으면 임의 값을 넣지 말고 채널톡에 앱 이름과 배포 ID를 첨부해 문의한다.

### 결제 및 지급

공식 [인앱결제 개발 가이드](https://developers-apps-in-toss.toss.im/iap/develop.html)와 [IAP API 레퍼런스](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/IAP.html)는 다음 흐름을 요구한다.

1. `IAP.getProductItemList()`로 노출 ON인 상품을 조회한다.
2. `IAP.createOneTimePurchaseOrder()`에 콘솔 SKU를 전달한다.
3. `processProductGrant({ orderId })`에서 파트너 서버의 지급 API를 호출한다.
4. 서버 지급 성공일 때만 `true`를 반환하고 잔액을 갱신한다.
5. 앱 재진입 시 `IAP.getPendingOrders()`로 결제 완료·미지급 주문을 복원한다.
6. 복원 지급이 성공하면 `IAP.completeProductGrant()`로 지급 완료를 알린다.
7. `IAP.getCompletedOrRefundedOrders()`와 서버 주문 상태 조회로 완료·환불 상태를 재조정한다.

`IAP.createOneTimePurchaseOrder()`는 cleanup 함수를 반환하므로 화면 이탈 또는 결제 흐름 종료 시 호출한다. SDK의 기본 IAP는 토스 앱 5.219.0부터 동작하지만 `getPendingOrders()`는 Android 5.234.0·iOS 5.231.0, `completeProductGrant()`는 양 플랫폼 5.233.0부터 동작한다. `alive`는 구매 후 복원을 필수 계약으로 보므로 generic `isMinVersionSupported()`로 **Android 5.234.0·iOS 5.233.0** 이상일 때만 신규 구매 상품을 활성화한다. 이 토스 앱 실행 버전 조건은 콘솔 상품 폼의 미니앱 `최소 지원 버전`과 다른 개념이다. `USER_CANCELED`, `PAYMENT_PENDING`, 네트워크 오류, 상품 불일치, 서버 지급 실패와 미지원 버전은 서로 다른 사용자 상태로 처리한다.

### 탈퇴·구매기록 보존

전자상거래법 시행령 제6조의 계약·청약철회 및 대금결제·공급 기록 5년과 개인정보 보호법 제21조의 분리 보관·파기 원칙을 로컬 기술 기준으로 적용했다. 최종 계정 파기 시 Toss `remove-by-user-key` API로 로그인 연결을 끊고, 구매행의 사용자 FK를 제거한 뒤 거래일 기준 5년까지 제한 보관한다. 만료 뒤에는 HMAC이나 주문 ID만 남기지 않고 구매행 전체를 삭제한다. 세부 근거와 고객 문서 변경안은 [구매기록 보존 및 탈퇴 처리 결정](decision_apps-in-toss-iap-purchase-retention_2026-08-11.md)에 기록했다. 이 기준의 법무·대표자 승인과 공개 약관 개정은 별도 출시 게이트다.

공식 [비게임 출시 체크리스트](https://developers-apps-in-toss.toss.im/checklist/app-nongame.html)의 결제 항목도 적용한다. 앱에는 재생 중인 오디오·영상 기능이 없어 결제 중 미디어 일시정지는 적용 대상이 아니며, 결제 가격 대조·성공 반영·취소 복귀·실패 안내·환불·기기 변경 복원은 샌드박스 필수 시나리오로 둔다. 사용자가 자신의 충전·환불 상태를 확인할 수 있도록 서버 소유 구매 원장 기반 결제 내역 API와 크레딧 상점의 `결제 내역` 화면을 제공한다.

### 서버 검증과 상태 의미

주문 상태 조회는 `POST /api-partner/v1/apps-in-toss/order/get-order-status`를 mTLS로 호출한다. 요청 가능한 상태를 내부 상태와 다음처럼 매핑한다.

| 토스 상태 | 의미 | `alive` 행동 |
| --- | --- | --- |
| `ORDER_IN_PROGRESS` | 주문 처리 중 | 지급하지 않고 재조회 가능 상태로 저장 |
| `PAYMENT_COMPLETED` | 결제 완료, 상품 미지급 | 사용자·SKU·상태 검증 후 한 번만 지급 |
| `PURCHASED` | 결제와 상품 지급 완료 | 기존 지급 결과를 재생하고 중복 지급 금지 |
| `REFUNDED` | 환불 완료 | 신규 지급 금지, 기존 지급분과 보너스 회수 |
| `FAILED` | 주문 실패 | 지급하지 않고 실패 기록 |
| `NOT_FOUND` | 주문 없음 | 지급하지 않고 보안 로그 기록 |
| `MINIAPP_MISMATCH` | 다른 미니앱 주문 | 지급하지 않고 보안 경보 대상 처리 |
| `ERROR` | 제공자 내부 오류 | 지급하지 않고 제한된 재시도 수행 |

`PAYMENT_COMPLETED` 지급과 `CreditPurchase` 상태 변경, `CreditAccount.purchased_credits` 증가, `CreditLedgerEntry` 추가는 하나의 데이터베이스 트랜잭션으로 처리한다. 이후 같은 `orderId`가 다시 들어오면 저장된 지급 결과를 반환한다.

주문 상태 조회 응답에는 결제 금액이 포함되지 않는다. 따라서 서버는 응답의 `orderId`, `sku`, 상태와 요청 헤더에 사용한 `userKey`를 검증하고, 지급량은 서버의 SKU 정책표에서 결정한다. `price_krw`는 정책 변경 추적용 내부 스냅샷이며 결제 성공의 검증 근거로 사용하지 않는다. 사용자에게 표시하는 실제 판매가는 SDK의 `displayAmount`만 사용한다.

### 환불과 정산

- Android 환불 요청은 앱인토스 콘솔에서 확인하고 파트너가 승인 또는 반려할 수 있으나 최종 결정은 Google Play가 한다.
- iOS 환불은 Apple이 결정하므로 파트너는 주문 상태만 조회한다.
- 환불·취소 이벤트는 클라이언트 재진입에 의존하지 않고 결제 알림 또는 서버 재조정 작업으로 확인한다.
- 정산 정보의 사업자 유형, 계좌 사본, 세금계산서 이메일을 실제 운영 정보와 대조한다.
- 수수료와 정산 일정은 출시 직전 [공식 정산 안내](https://developers-apps-in-toss.toss.im/guide/settlement)를 다시 확인한다.

## 현재 프로젝트 분석

### 준비된 기반

| 영역 | 현재 상태 | 근거 | 적용 판단 |
| --- | --- | --- | --- |
| 앱인토스 SDK | `@apps-in-toss/web-framework` 2.10.8 사용 | [`apps/frontend/package.json`](../../../../apps/frontend/package.json) | IAP API를 같은 SDK에서 추가 가능 |
| 토스 빌드 | `ait build`, 전용 runtime과 API URL 존재 | [`apps/frontend/package.json`](../../../../apps/frontend/package.json) | 결제 기능을 토스 runtime에만 노출 가능 |
| 미니앱 설정 | `appName=ashwoodfriends-alive` 설정 | [`apps/frontend/granite.config.ts`](../../../../apps/frontend/granite.config.ts) | 콘솔 앱 이름과 SKU 소속을 대조해야 함 |
| 콘솔 미니앱 버전 | 로컬 `.ait` 빌드는 통과했으나 업로드된 번들은 확인되지 않음 | 콘솔 `최소 지원 버전` 드롭다운이 비어 있는 사용자 캡처 | 상품보다 먼저 `.ait`를 `앱 출시`에 업로드해야 함 |
| 토스 로그인 | `userKey`를 `provider_subject`로 저장 | [`backend/app/services/toss_login.py`](../../../../backend/app/services/toss_login.py) | 주문 조회의 `x-toss-user-key` 결합에 재사용 가능 |
| mTLS 설정 | API base URL과 인증서·키 경로 존재 | [`backend/app/core/config.py`](../../../../backend/app/core/config.py) | 로그인 전용 구현을 공통 토스 API 클라이언트로 분리 가능 |
| 크레딧 계정 | 구매·보너스 잔액 분리, row lock과 사용 원장 존재 | [`backend/app/models/entities.py`](../../../../backend/app/models/entities.py) | 검증된 구매 지급 대상 기반은 준비됨 |
| 지급 원장 유형 | `purchase`, `chargeback` entry type 허용 | [`backend/app/models/entities.py`](../../../../backend/app/models/entities.py) | 실제 구매 원장 생성 로직은 추가 필요 |

### 최초 분석 시 미구현 또는 차단 상태

| 영역 | 현재 상태 | 필요한 조치 |
| --- | --- | --- |
| 결제 UI | 버튼이 disabled이고 “결제 준비 중” 표시 | IAP 상태 훅, 중복 탭 방지, 오류·복원 UI 구현 |
| 상품 카탈로그 | 서버에 가격과 지급량을 하드코딩 | 콘솔 SKU와 서버 지급 정책을 매핑하고 가격 표시는 SDK 응답 사용 |
| 결제 활성화 | 모든 상품의 `payment_available` 기본값이 `false` | 출시 게이트 통과 후 서버 플래그로 단계적 활성화 |
| 구매 모델 | `CreditPurchase`가 없음 | 주문 ID unique, SKU, 상태, 금액, 지급량 스냅샷과 시각 저장 |
| 지급 API | `/credits` 아래 조회 API만 존재 | 인증된 `POST /credits/purchases/grant` 추가 |
| 주문 검증 | 토스 IAP 서버 호출이 없음 | mTLS 주문 상태 조회 서비스와 오류 매핑 추가 |
| 구매 복원 | `getPendingOrders` 사용이 없음 | 로그인 후·상점 진입 시 멱등 복원 추가 |
| 환불 재조정 | 완료·환불 조회 및 회수 로직 없음 | 알림/주기 조회, chargeback 원장과 운영 상태 추가 |
| 첫 구매 보너스 | UI·카탈로그 계산만 있고 구매 지급과 연결되지 않음 | 사용자별 1회 unique와 환불 회수 정책 구현 |
| 운영 조회 | 잔액과 원장 합계 점검 명령이 없음 | 주문·구매 원장·잔액 불일치 조회 도구 추가 |

현재 미구현 판단은 [크레딧 출시 계획](../../product/credit/plan_credit-bm-and-ai-release-readiness_2026-08-09.md)과 [비용·보안 마진 검토](../../../reports/product/bm/report_credit-ai-cost-security-margin-review_2026-08-09.md)의 결제 차단 조건과도 일치한다.

### 2026-08-11 로컬 구현 상태

| 영역 | 상태 | 근거 |
| --- | --- | --- |
| 상품 정책·환경 플래그 | 구현 | `credit_products.py`, `TOSS_IAP_*` 환경 설정 |
| 구매 원장·부채 | 구현 | `CreditPurchase`, `CreditAccount.debt_credits`, migrations `0021`·`0022` |
| 탈퇴·법정 보존 수명주기 | 구현·승인 대기 | Toss 연결 해제, nullable FK, `retention_until`, 5년 만료 삭제, migration `0023`; 고객 문서 법무 승인 필요 |
| 서버 주문 검증 | 구현 | 공통 mTLS client와 Toss IAP order service |
| 멱등 지급·첫 구매 보너스 | 구현 | 주문 unique, 계정 row lock, 원장 idempotency key, 안정적 사용자 해시 이력, `first_purchase` unique grant |
| 운영 설정 사전 검증 | 구현 | 활성화 시 5개 SKU 누락·중복, 32-byte HMAC 키, mTLS 파일을 시작 단계에서 차단 |
| 환불 회수·서버 재조정 | 구현 | chargeback, 부족분 debt, 기본 비활성 주기 작업 |
| 결제 UI·미지급 복원 | 구현 | 토스 runtime IAP, SDK 가격, 로그인 직후·상점 진입 pending restore, cleanup |
| 환불 이력·운영 조회 | 구현 | SDK history pagination, 서버 reconciliation, 보호된 주문 조회 API |
| 재무 정합성 감사 | 구현 | 장기 미지급, 상태 검토, 구매·환불 원장과 계정 잔액 불일치 감사 API |
| 구매 제한 활성화 | 구현 | 토스 provider만 허용하고 HMAC 기반 사용자 코호트를 0~100%로 결정하는 카탈로그 게이트 |
| 운영 무결성 신호 | 구현 | 재조정 주기마다 감사하고 이상 시 식별자 없는 `iap_integrity_alert` 오류 로그 발행 |
| 콘솔 매니페스트 사전 검증 | 구현 | `.ait`·배포 ID·앱 이름·5개 상품의 고유 SKU·공급가·판매가·문구·이미지·노출·최소 지원 버전 대조 CLI |
| 자동 검증 | 통과 | backend 332 passed, 1 skipped(별도 PostgreSQL 통합 테스트), frontend domain 156 passed, typecheck, web build, Toss AIT build |
| 콘솔·mTLS·샌드박스·정산 | 미검증 | 저장소 밖의 운영 정보와 실제 Apps in Toss 앱 필요 |

## 결정이 필요한 상품 정책

현재 카탈로그는 아래 실제 콘솔 SKU, VAT 포함 판매가와 지급량을 기준으로 한다. 내부 상품 ID는 기존 참조 호환성을 위해 유지하고, 구매 주문에는 콘솔 SKU를 사용한다.

| 현재 상품 ID | 콘솔 SKU | 앱 표시 가격 | 기본 C | 상품 보너스 C | 일반 지급 C | 첫 구매 예상 C |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `credit-5000` | `ait.0000058377.f2966bb1.6eb92fa59d.6425847961` | 4,950원 | 500 | 0 | 500 | 550 |
| `credit-10000` | `ait.0000058377.9fbcbbf7.59cb266761.6425919018` | 9,900원 | 1,000 | 0 | 1,000 | 1,100 |
| `credit-30000` | `ait.0000058377.f4432be6.c84ad9f6e6.6425951838` | 29,700원 | 3,000 | 150 | 3,150 | 3,465 |
| `credit-50000` | `ait.0000058377.0d512108.d6b6db0cd2.6425984642` | 49,500원 | 5,000 | 500 | 5,500 | 6,050 |
| `credit-100000` | `ait.0000058377.d51a71a8.20549ee68e.6426015918` | 99,000원 | 10,000 | 1,500 | 11,500 | 12,650 |

출시 전에 다음을 확정한다.

- [x] 콘솔이 계산한 VAT 포함 판매가를 서버 정책·테스트·콘솔 매니페스트에 반영한다. 실제 화면은 SDK `displayAmount`를 사용한다.
- [x] 서버가 신뢰할 `sku → 기본 C·상품 보너스 C` 매핑을 코드로 고정하고 실제 콘솔 SKU는 환경 변수로 주입한다.
- [x] 첫 구매 10% 보너스의 대상은 토스 사용자 기준 최초 **지급 완료 구매 1회**로 정한다.
- [x] 환불 이력이 있는 구매도 첫 구매 이력으로 유지하고, 해당 구매의 첫 구매 보너스도 회수한다.
- [x] 환불 회수 시 잔액이 부족하면 음수 잔액을 허용하지 않고 `debt_credits`로 기록하며 다음 구매 지급분으로 우선 상환한다.
- [x] 로컬 기술 기준은 계정 삭제 후 구매 원장을 거래일 기준 5년까지 분리 보관하고 만료 시 구매행 전체를 삭제하도록 구현한다.
- [ ] 5년 보존 목적, HMAC 연결값, 법적 보존 정지와 고객 노출 문구를 대표자·법무가 승인한다.

### 콘솔 상품 입력안

상품명은 내부 가격 ID가 아니라 실제 지급량을 기준으로 작성한다. 설명은 45자 제한 안에서 상품 용도와 지급량만 표현하고, 현금·환전·투자성 표현은 사용하지 않는다.

| 내부 상품 | 상품 유형 | 상품명 | 설명 | 상품 이미지 | 공급가 / 판매가 | 최소 지원 버전 | 최초 노출 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `credit-5000` | 소모품 | `크레딧 500C` | `얼라이브 AI 기능에 사용하는 500C` | [credit-500.png](../../../qa/evidence/apps-in-toss-iap-products/credit-500.png) | 4,500원 / 4,950원 | `20260731-4` 임시 | OFF |
| `credit-10000` | 소모품 | `크레딧 1,000C` | `얼라이브 AI 기능에 사용하는 1,000C` | [credit-1000.png](../../../qa/evidence/apps-in-toss-iap-products/credit-1000.png) | 9,000원 / 9,900원 | 기존 버전 임시 | OFF |
| `credit-30000` | 소모품 | `크레딧 3,150C` | `기본 3,000C와 추가 150C를 지급해요` | [credit-3150.png](../../../qa/evidence/apps-in-toss-iap-products/credit-3150.png) | 27,000원 / 29,700원 | 기존 버전 임시 | OFF |
| `credit-50000` | 소모품 | `크레딧 5,500C` | `기본 5,000C와 추가 500C를 지급해요` | [credit-5500.png](../../../qa/evidence/apps-in-toss-iap-products/credit-5500.png) | 45,000원 / 49,500원 | 기존 버전 임시 | OFF |
| `credit-100000` | 소모품 | `크레딧 11,500C` | `기본 10,000C와 추가 1,500C를 지급해요` | [credit-11500.png](../../../qa/evidence/apps-in-toss-iap-products/credit-11500.png) | 90,000원 / 99,000원 | 기존 버전 임시 | OFF |

다섯 상품은 2026-08-11 콘솔에 소모품·노출 OFF·할인 없음으로 등록됐다. 공급가와 VAT 포함 판매가는 위 표로 확정했으며 상품 ID와 캡처 기반 증거는 [상품 이미지·등록 증거](../../../qa/evidence/apps-in-toss-iap-products/README.md)에 기록했다. `20260731-4`와 같은 결제 기능 미포함 기존 버전은 상품 등록을 위한 임시 선택일 뿐이다. 실제 판매 전 IAP 포함 새 `.ait`를 업로드·검토한 뒤 모든 상품의 최소 지원 버전을 그 승인 버전으로 변경하고 필요하면 상품 수정 검토를 받는다.

## 영향 경로

```text
사용자 결제 탭
→ CreditStoreScreen
→ Apps in Toss IAP.getProductItemList / createOneTimePurchaseOrder
→ processProductGrant(orderId)
→ frontend credits API client
→ POST /api/credits/purchases/grant
→ 현재 로그인 사용자와 Toss provider_subject(userKey) 확인
→ Toss IAP order status API(mTLS)
→ CreditPurchase unique 확인
→ CreditAccount row lock
→ CreditPurchase + CreditLedgerEntry + 잔액을 한 트랜잭션으로 반영
→ 지급 결과 반환
→ IAP 지급 완료 / 잔액 재조회 / 성공 UI
```

복원 경로는 `토스 로그인 세션 복구 또는 크레딧 상점 진입 → getPendingOrders → 각 orderId를 같은 지급 API로 재처리 → completeProductGrant`로 구성한다. 두 진입점이 겹치면 같은 in-flight 복원 작업을 공유하고, 상점 진입은 결과 안내와 재시도 경로를 담당한다. 서버 지급 성공과 `completeProductGrant` 통지 성공은 별도 상태로 취급한다. 통지만 실패하면 지급된 잔액을 즉시 갱신하고 pending 안내를 표시한 뒤 다음 진입에서 통지를 재시도하며, 서버의 주문 멱등성이 중복 지급을 막는다. 환불 경로는 `완료·환불 이력 또는 서버 재조정 → REFUNDED 확인 → chargeback 원장 → 잔액/부채 정책 반영 → 운영 조회`로 분리한다.

## 환경 플래그와 활성화 순서

| 설정 | 기본값 | 역할 |
| --- | --- | --- |
| `TOSS_IAP_ENABLED` | `false` | 주문 검증·지급·복구 통합 전체 허용 |
| `TOSS_IAP_PURCHASE_ENABLED` | `false` | 신규 결제 버튼과 상품 구매 가능 상태만 허용 |
| `TOSS_IAP_PURCHASE_ROLLOUT_PERCENT` | `0` | 토스 사용자별 결정적 신규 구매 노출 비율, 0~100 |
| `TOSS_IAP_CREDIT_*_SKU` | `.env.example`에 실제 SKU 5개 | 배포 환경에서는 동일 값을 환경 변수로 주입해 콘솔 SKU와 서버 지급 정책 연결 |
| `TOSS_IAP_SUBJECT_HMAC_KEY` | 빈 값 | 토스 사용자의 구매 이력을 비식별 연결하는 32-byte 이상 전용 비밀키 |
| `TOSS_IAP_RECONCILIATION_ENABLED` | `false` | 알려진 주문의 서버 주기 재조회 실행 |
| `TOSS_IAP_AUDIT_ALERTS_ENABLED` | `false` | 재조정 감사 이상 시 `iap_integrity_alert` 오류 로그 발행 |

스테이징에서는 SKU, 운영 수명 동안 유지할 전용 HMAC 키와 mTLS를 먼저 주입한 뒤 `TOSS_IAP_ENABLED=true`로 복구·검증 경로를 활성화한다. 활성화 설정이 불완전하거나 롤아웃 비율이 0~100 범위를 벗어나거나 감사 경보만 재조정 없이 켜면 서버 시작 단계에서 실패한다. 신규 구매 ON은 재조정과 감사 경보가 모두 ON일 때만 허용되며 잘못된 조합은 서버 시작 단계에서 거절한다. 샌드박스 게이트 전에는 신규 구매 OFF·롤아웃 0을 유지하고, 테스트 시간에만 신규 구매 ON·롤아웃 100을 사용한다. 운영은 10%부터 단계적으로 확대한다.

롤아웃은 앱 카탈로그의 구매 가능 상태를 제어하는 소프트 게이트다. 이미 SKU를 아는 구버전·변조 클라이언트의 제공자 주문 생성을 완전히 차단한다고 가정하지 않는다. 실제 신규 판매를 확실히 중단하려면 콘솔 상품 노출도 OFF로 전환하되, 이미 결제된 주문의 지급·복원을 위해 통합과 재조정은 ON으로 유지한다. 상세 절차는 [인앱결제 배포 및 운영 가이드](../../../guides/guide_apps-in-toss-iap-operations.md)를 따른다.

## 구현 단계

### 1. 승인, 미니앱 번들 버전과 콘솔 상태 고정

- [ ] 승인 화면에서 승인 종류, 승인 일시, 앱 이름과 워크스페이스를 캡처해 `documents/qa/evidence/`에 보관한다.
- [ ] 사업자 정보, 약관 동의, 정산 계좌와 세금계산서 이메일의 검토 완료 상태를 확인한다.
- [ ] mTLS 인증서 만료일과 교체 담당자를 기록하고 운영 비밀 저장소에 인증서·키를 등록한다.
- [x] 현재 IAP 구현을 포함한 `.ait` 번들을 생성하고 파일명·앱 코드 커밋·빌드 배포 ID·SHA-256을 QA 가이드에 기록한다.
- [ ] 준비된 `.ait`를 콘솔 `앱 출시` 메뉴에 업로드한다.
- [ ] 업로드된 번들의 배포 ID, 콘솔 표시 버전, 출시 메모와 테스트용 QR을 증빙하고 QR 테스트를 최소 1회 완료한다.
- [ ] 인앱 상품 등록 화면을 다시 열어 `최소 지원 버전`에 방금 업로드한 번들이 표시되는지 확인한다.
- [x] 크레딧 상품 5개를 소모품으로 등록하고 실제 판매 전 노출을 OFF로 둔다.
- [x] 각 SKU, 공급가, VAT 포함 판매가, 상품명, 이미지와 지급량을 상품 매핑표에 기록한다.
- [x] 콘솔 값을 기록할 매니페스트 템플릿과 서버 정책 사전 검증 명령을 추가한다.

완료 조건: 업로드한 미니앱 번들이 상품의 `최소 지원 버전`으로 선택되고, 콘솔의 앱·SKU·판매가와 서버 정책표가 1:1로 대조된다.

### 2. 구매 데이터 모델과 정책 추가

- [x] `credit_purchases` 테이블과 `CreditPurchase` 모델을 추가한다.
- [x] `provider_order_id`에 전역 unique 제약을 둔다.
- [x] provider, nullable user_id, 서버 비밀키 기반 HMAC-SHA-256 userKey 식별 스냅샷, sku, provider 상태, 내부 상태, 내부 가격 정책 스냅샷, 기본·보너스 지급량, 최초 지급·환불 시각을 저장한다.
- [x] 제공자 원문 응답과 원문 userKey는 저장하지 않는다.
- [x] 구매 지급, 첫 구매 보너스, 환불 회수를 각각 하나의 트랜잭션과 멱등 키로 처리한다.
- [x] 계정 삭제 시 구매 기록은 `ON DELETE SET NULL`로 유지하고 userKey는 해시만 보관한다.
- [x] 인증 세션 키와 분리한 전용 HMAC 키로 사용자 구매 이력을 연결하고, 계정 삭제·재가입 뒤에도 과거 지급 이력이 있으면 첫 구매 보너스를 다시 지급하지 않는다.
- [x] 사용자 해시·지급 이력 조회용 `0022` 인덱스를 추가한다.
- [x] 최종 탈퇴 시 Toss `userKey` 연결을 해제하고 구매행에 `retention_until`을 설정한다.
- [x] 탈퇴 구매행은 거래일 기준 5년이 지나면 계정 삭제 스케줄러가 전체 삭제하며, `0023` 인덱스로 만료 대상을 조회한다.

완료 조건: 동일 `orderId` 동시 요청과 반복 요청이 모두 한 번만 잔액을 증가시킨다.

### 3. 공통 토스 API 클라이언트와 주문 검증

- [x] 로그인 서비스에 들어 있는 mTLS 생성·응답 처리를 공통 Toss API client로 분리한다.
- [x] 주문 상태 조회 서비스에 timeout과 제공자 오류 매핑을 추가한다. 자동 재시도는 중복 트래픽을 피하기 위해 서버 재조정 주기로 제한한다.
- [x] 로그인 사용자가 `toss` provider인지 확인하고 `provider_subject`를 `x-toss-user-key`로 사용한다.
- [x] 응답의 `orderId`, `sku`, 상태가 요청과 정책표에 일치하는지 검증한다.
- [x] 다른 사용자 주문은 기존 주문 소유권 검사로 거절하고, 다른 미니앱 주문 상태는 지급 불가로 처리한다.

완료 조건: 클라이언트가 SKU·상태를 조작해도 서버가 토스 응답과 정책표만 신뢰한다. 금액은 주문 조회 응답에 없으므로 검증 대상으로 표현하지 않는다.

### 4. 지급 API와 구매 원장 구현

- [x] `POST /api/credits/purchases/grant` 요청·응답 스키마를 추가한다.
- [x] 요청 본문은 `order_id`만 받고 사용자·SKU·상태는 서버 조회 결과에서 결정한다.
- [x] `PAYMENT_COMPLETED`는 검증 후 지급하고, 로컬 지급 기록이 있는 반복 요청은 기존 결과를 재생한다. 로컬 기록 없이 `PURCHASED`면 운영 검토 상태로 둔다.
- [x] 진행 중·실패·환불·불일치 상태에는 신규 지급하지 않는다.
- [x] 계정 row lock, 구매 row unique, 원장 unique를 함께 사용한다.
- [x] 응답에는 내부 구매 상태, 지급량, 현재 잔액과 환불 부채를 반환한다.

완료 조건: 지급 API timeout 뒤 같은 요청을 반복해도 손실과 중복 지급이 없다.

### 5. 프런트엔드 IAP 연결

- [x] 앱인토스 runtime에서만 IAP 모듈을 동적 import한다.
- [x] `getProductItemList()` 결과의 SKU와 `displayAmount`를 서버 정책과 결합한다.
- [x] SDK 2.10.8의 상품·미결 주문 API가 `undefined`를 반환하면 토스 앱 업데이트 안내를 표시한다.
- [x] 미지급 복원과 지급 완료 확인을 모두 보장하도록 Android 5.234.0·iOS 5.233.0 미만에서는 신규 구매를 비활성화한다.
- [x] 결제 중 버튼을 잠그고 중복 탭과 화면 이탈을 처리한다.
- [x] `processProductGrant`에서 지급 API 성공 여부를 반환한다.
- [x] 성공 시 잔액을 재조회하고 접근 가능한 상태 메시지를 제공한다.
- [x] cleanup 함수를 컴포넌트 unmount 또는 결제 흐름 종료 시 호출한다.
- [x] 웹·Capacitor runtime에서는 결제 가능 SKU가 내려오지 않으며 IAP module을 호출하지 않도록 runtime guard를 둔다.

완료 조건: 콘솔 가격과 화면 가격이 같고, 성공·대기·취소·오류·지급 실패가 구분된다.

### 6. 미결 주문 복원과 환불 재조정

- [x] 토스 로그인 세션 복구 직후와 크레딧 상점 진입 시 `getPendingOrders()`를 호출하고, 동시에 시작되면 같은 복원 작업을 공유한다.
- [x] 복원 주문은 일반 결제와 동일한 지급 API를 사용한다.
- [x] 서버 지급 성공 뒤 `completeProductGrant()`를 호출한다.
- [x] 서버 지급 성공과 `completeProductGrant()` 통지 성공을 분리해, 통지 실패 시 잔액은 갱신하고 다음 진입에서 통지만 재시도한다.
- [x] 페이지네이션을 포함해 완료·환불 주문을 조회하고 환불 주문을 서버 상태로 재조정한다.
- [x] 1차 출시는 결제 알림 URL을 사용하지 않고 SDK 이력과 서버 재조정 작업을 사용한다. 이후 알림 URL을 도입하면 인증, 서명 또는 Basic Auth, 재시도와 중복 이벤트 테스트를 별도 태스크로 추가한다.
- [x] 알려진 미완료·지급 완료 구매를 서버가 주기적으로 재조회하는 기본 비활성 운영 작업을 추가한다.
- [x] 환불 시 구매 크레딧·상품 보너스·첫 구매 보너스를 정책대로 회수하고 부족분을 `debt_credits`로 기록한다.
- [x] 인증된 사용자가 `GET /api/credits/purchases`와 크레딧 상점의 `결제 내역`에서 자신의 지급·처리·환불·실패 상태, 지급량, 시각과 주문 식별자를 확인할 수 있다. 내부 실패 사유는 사용자 응답에 노출하지 않는다.

완료 조건: 결제 직후 앱·서버가 중단되어도 다음 진입 또는 서버 재조정에서 정확히 한 번 지급되며, 환불이 잔액과 권한에 반영된다.

### 7. 운영, 정산과 출시 활성화

- [ ] 콘솔의 결제 완료·지급 완료 건과 내부 구매 원장을 일 단위로 대조한다.
- [x] 재조정 감사에서 장기 `PAYMENT_COMPLETED`, 검토·실패 상태와 구매·환불·계정 원장 불일치를 발견하면 주문·사용자 식별자 없이 `iap_integrity_alert`와 사유별 건수를 오류 로그로 발행한다. 주문별 재조정 예외 로그도 원본 주문 ID를 포함하지 않는다.
- [ ] 로그 수집 시스템에서 `iap_integrity_alert`, 주문 재조정 실패와 poll 실패를 critical 알림으로 연결하고 담당자·10분 응답 기준을 지정한다.
- [x] 보호된 감사 API로 6시간 이상 `processing`, `review`·`failed`, 잘못된 지급량, 구매·환불 원장 불일치와 계정 잔액·부채·원장 불일치를 탐지한다.
- [x] 이 계획서에 Android·iOS 환불 경로와 지급 지연 대응 초안을 추가한다. 고객 노출 문구와 담당자 승인은 별도 게이트다.
- [x] 운영자가 `GET /api/moderation/credit-purchases?status=...`로 처리 큐를 찾고, `GET /api/moderation/credit-purchases/audit`로 이상 후보를 탐지하며, `GET /api/moderation/credit-purchases/{order_id}`와 `X-Moderation-Key`로 내부 상태, 원장과 잔액을 조회할 수 있게 한다. 제공자 상태는 저장된 최근 재조회 결과다.
- [x] 토스 로그인 사용자에게만 HMAC 기반 0~100% 결정적 롤아웃으로 `payment_available`을 적용하는 코드 게이트를 추가한다. 복원에 필요한 SKU는 비대상 사용자에게도 유지한다.
- [ ] 샌드박스와 출시 검수 완료 후 운영 환경에서 신규 구매 ON·롤아웃 10%를 적용한다.
- [ ] 안정화 뒤 콘솔 상품 노출과 전체 결제 플래그를 순서대로 활성화한다.

완료 조건: 결제를 중단하지 않고도 주문 상태와 정산 차이를 탐지하고 조치할 수 있다.

### 운영자·고객지원 행동 초안

- 지급 지연 문의: 사용자에게 재구매를 먼저 권하지 않는다. 주문 ID를 확인하고 운영 조회 API로 내부 상태·최근 제공자 상태·원장·잔액을 조회한다. `PAYMENT_COMPLETED/processing`이면 재조정 대상, `granted`면 잔액 새로고침 안내, `review`면 수동 잔액 조정 없이 결제 담당자에게 이관한다.
- 중복 지급 의심: `purchase:{orderId}` 원장 수와 `provider_order_id` unique를 확인한다. 제공자 주문 하나에 구매 원장이 하나보다 많으면 신규 결제를 차단하고 데이터 수정 전에 증빙을 보존한다.
- Android 환불: 앱인토스 콘솔의 환불 요청을 담당자가 확인해 승인·반려하되 최종 처리는 Google Play 정책을 따른다고 안내한다.
- iOS 환불: Apple이 환불 여부를 결정하므로 Apple 환불 신청 경로를 안내하고 파트너가 즉시 환불을 확정한다고 약속하지 않는다.
- 환불 완료: `REFUNDED` 재조정 후 구매분·상품 보너스·첫 구매 보너스를 회수한다. 부족분은 `debt_credits`로 표시되며 수동 탕감은 별도 재무 승인과 `adjustment` 원장이 없으면 수행하지 않는다.
- 제공자 장애·mTLS 만료: `TOSS_IAP_PURCHASE_ENABLED=false`와 콘솔 상품 노출 OFF로 신규 구매만 중단한다. `TOSS_IAP_ENABLED`와 구매 원장·복구 API는 유지한다.

위 문구는 코드 동작 기준 초안이다. 실제 고객 노출 문구, 응답 시간, 환불 담당자와 법무·재무 승인은 출시 게이트에서 확정한다.

## 성공 조건

- [x] 콘솔 상품과 서버의 고유 SKU·공급가·판매가·지급량·상품 문구·이미지·노출 정책을 대조하는 자동 검증기와 실패 테스트가 구현됐다.
- [ ] 실제 콘솔 값으로 완성한 매니페스트가 `make iap-release-check`를 통과한다.
- [x] 클라이언트 요청은 `order_id`만 받으며 성공 여부, 가격, SKU를 신뢰하지 않는다.
- [x] `orderId` 중복 지급을 데이터베이스 unique, row lock, 원장 idempotency로 차단하고 실제 PostgreSQL 독립 세션 2개의 동시 요청과 반복 요청으로 검증한다. 실제 다중 프로세스 동시성은 샌드박스에서 추가 검증한다.
- [ ] 결제 성공 후 서버 실패 시 앱 재진입으로 구매가 복원된다.
- [ ] 환불이 구매 원장, 크레딧 원장과 사용자 이용 가능 상태에 반영된다.
- [x] 첫 구매 보너스는 unique grant와 안정적 사용자 해시 이력으로 계정 삭제·재가입 후에도 한 번만 지급되고 환불 회수 대상에 포함된다.
- [x] 토스 미지원 runtime과 독립 앱에서 IAP module을 호출하지 않는 runtime guard가 테스트됐다.
- [ ] 샌드박스 필수 시나리오와 자동 테스트가 모두 통과한다.
- [ ] 정산 정보, 환불 담당자, 인증서 만료일과 결제 사고 대응 책임자가 기록된다.
- [x] 신규 결제와 IAP 복구 플래그를 분리해 롤백 시 미지급 주문 복원을 유지한다.
- [x] 신규 구매는 토스 provider와 0~100% 결정적 사용자 롤아웃을 모두 통과해야 노출되며, 비대상 사용자의 기존 주문 복원 SKU는 유지된다.
- [x] 사용자는 자신의 최근 결제·환불 상태를 서버 원장 기준으로 확인할 수 있고 다른 사용자의 구매 내역은 조회할 수 없다.
- [x] 계정 최종 파기 시 Toss 로그인 연결을 해제하고 구매 원장은 법정 기술 기준에 따라 분리 보관·만료 삭제된다.
- [ ] 개인정보처리방침과 유료서비스·환불 약관 개정안을 승인하고 배포 전에 필요한 재동의를 완료한다.

## 검토 체크리스트

### 제품·재무

- [ ] VAT 포함 실제 판매가와 화면 표시가 일치한다.
- [ ] 크레딧 지급량, 상품 보너스, 첫 구매 보너스가 수익성 기준을 통과한다.
- [x] 환불된 첫 구매도 구매 이력으로 유지되어 첫 구매 보너스를 재지급하지 않는다고 명시돼 있다.
- [ ] 사업자 유형, 계좌, 세금계산서 이메일과 정산 담당자가 정확하다.

### 백엔드·보안

- [x] 인증된 토스 사용자의 `provider_subject`만 `x-toss-user-key`로 보내며 API 계약 테스트가 통과했다.
- [ ] mTLS 인증서와 키가 서버 비밀 저장소에만 있다.
- [x] 주문 상태 조회 timeout이나 5xx에서 크레딧을 지급하지 않는다.
- [x] `provider_order_id` unique와 원장 멱등 키를 데이터베이스가 강제한다.
- [x] 구매 지급과 잔액 증가가 같은 트랜잭션이다.
- [x] 계정 삭제 시 구매자는 nullable FK와 해시 식별자로 비식별화되고 구매 원장은 보존된다.
- [x] IAP 활성화 전에 5개 SKU 누락·중복, 32-byte 미만 전용 HMAC 키와 존재하지 않는 mTLS 파일을 시작 단계에서 거절한다.
- [x] 전용 HMAC 키는 인증 세션 키와 분리되어 있으며 운영 수명 동안 변경하지 않는다고 환경 설정에 명시돼 있다.
- [x] 롤아웃 비율 범위와 감사 경보·재조정 플래그 조합을 시작 단계에서 검증한다.
- [x] `0023`이 탈퇴 구매 원장의 보존 만료를 기록하고 실제 PostgreSQL에서 5년 만료 행 삭제를 검증한다.
- [x] Toss 계정 최종 파기 시 mTLS `remove-by-user-key` 응답의 동일 `userKey`를 확인한 뒤 계정을 삭제한다.

### 프런트엔드

- [x] SDK 상품 가격을 표시하고 서버 내부 가격 스냅샷을 결제 성공 근거로 사용하지 않는다.
- [x] 중복 탭, 취소, 대기, 일반 오류, 토스 앱 업데이트 필요 상태가 분리된다.
- [x] cleanup과 화면 재진입 복원 경로가 구현되고 정적·도메인 테스트를 통과했다.
- [x] 결제 처리 중에는 진행 상태만 표시하고 서버 지급 성공 뒤 성공 문구를 표시한다.
- [x] 전체 복원 API를 지원하는 토스 앱 최소 버전을 검사하고, 미지원 버전에는 업데이트 안내와 비활성 구매 버튼을 표시한다.
- [x] 크레딧 상점에서 사용자 본인의 최근 결제 상태와 환불 상태를 확인할 수 있다.

### 운영·고객지원

- [x] Android 콘솔 처리와 iOS Apple 결정 경로를 분리한 고객지원 초안이 준비돼 있다.
- [x] 운영 상태 큐·재무 감사·주문 상세 API로 장기 `processing`, `review`, `failed`, 구매·환불 원장과 계정 잔액 불일치를 조회할 수 있다.
- [x] 감사 이상과 주문별 재조정 예외를 오류 로그로 내보내되 원본 주문 ID·사용자 ID는 포함하지 않는다.
- [ ] 콘솔 결제 상태와 내부 원장 차이에 대한 담당자와 조치 시간이 정해져 있다.
- [ ] 인증서 만료 전 이중 인증서 교체 절차를 검증한다.

## 검증 계획

| 게이트 | 검증 | 현재 상태 |
| --- | --- | --- |
| 도메인 | SKU 매핑, 상태 전이, 첫 구매, 재가입, 환불 회수, 재무 감사, 사용자 롤아웃·경보·구매 내역·탈퇴 보존·콘솔 사전 검증 | backend 332 passed, 1 skipped; PostgreSQL 통합 테스트는 별도 1 passed |
| 백엔드 | `compileall`, repository/service/API pytest | 통과 |
| 데이터베이스 | migration head/current, upgrade·downgrade SQL, 동시 지급 | PostgreSQL current/head `0023`; `0022 → 0023 → 0022 → 0023`, 독립 세션 동시 지급·재가입 보너스 방지·탈퇴 원장 만료 삭제 통과 |
| 프런트엔드 | typecheck, domain test, production build | 156건·typecheck·Vite build 통과 |
| 앱인토스 빌드 | `npm run build:toss` | 최신 AIT artifact 생성 통과, 앱 코드 `2471416`, 산출물 `4142a1a` |
| 상품 이미지 | 5개 SKU별 1024×1024 PNG, SVG 원본, 해시와 직접 시각 검수 | 로컬 준비 통과; 콘솔 업로드 미실행 |
| 콘솔 매니페스트 | `.ait` SHA·배포 ID·앱 이름, 상품 고유 SKU·공급가·판매가·문구·이미지·노출·최소 지원 버전 | 실제 상품 정책 대조 통과; 새 번들의 콘솔 표시 버전·최소 지원 버전 오류 2건만 남아 전체 검증은 의도적으로 실패 |
| 앱인토스 번들 업로드 | 콘솔 `앱 출시` 업로드, 배포 ID·QR 생성, 최소 지원 버전 후보 확인 | 미실행 |
| 크로스 레이어 | 지급 API timeout 뒤 재시도, 잔액 갱신 | 로컬 멱등·PostgreSQL 동시성 테스트 통과; 실제 앱 검증 대기 |
| 앱인토스 샌드박스 | 상품 노출, 결제 성공, 서버 지급 실패 복원, 에러 | 미실행 |
| 환불 | 완료 주문 환불 후 원장·잔액 재조정 | 로컬 단위 테스트 통과; 콘솔 환불 미실행 |
| 회귀 | 웹·Capacitor runtime IAP guard | domain test와 web build 통과 |
| 운영 | 콘솔 주문과 내부 구매 원장 대조 | 처리 큐·감사·상세 API 구현 및 PostgreSQL 원장 변조 탐지 통과; 실제 콘솔 대조 대기 |

샌드박스에서는 실제 과금이 발생하지 않으며 현재 공식 문서상 일회성 결제를 지원한다. 다음 시나리오를 각각 증빙한다.

실행 절차와 결과 기록 양식은 [앱인토스 인앱결제 샌드박스 검증 가이드](../../../qa/guides/guide_apps-in-toss-iap-sandbox_2026-08-11.md)를 사용한다.

1. 상품 목록: 콘솔 노출 ON 상품만 표시되고 SKU·표시 가격이 일치한다.
2. 결제 성공: `orderId` 수신, 서버 검증, 1회 지급, 잔액 UI 갱신을 확인한다.
3. 결제 성공·서버 지급 실패: 실패 안내 후 앱 재실행에서 미결 주문을 복원한다.
4. 에러: 사용자 취소, 네트워크 오류, 내부 오류, 지급 실패를 구분한다.
5. 반복 호출: 같은 `orderId`를 동시에 여러 번 호출해도 한 번만 지급한다.
6. 재진입: 결제 도중 앱 종료 후 로그인 직후 복원을 시작하고, 상점 진입에서도 결과 안내 또는 재시도가 가능한지 확인한다.
7. 환불: `REFUNDED` 상태가 원장과 잔액에 반영된다.
8. 결제 내역·기기 변경: 지급·환불 상태가 사용자 내역에 보이고 같은 토스 계정의 다른 기기에서도 잔액·내역이 유지된다.

## 위험과 롤백

| 위험 | 예방 | 롤백·완화 |
| --- | --- | --- |
| 중복 지급 | 주문 ID unique, 트랜잭션, 멱등 응답 | 신규 결제 차단 후 중복 원장 조회·조정 |
| 결제 완료·미지급 | pending 복원, 서버 재조회, 운영 알림 | 지급 API와 복원 경로는 유지하고 결제 시작만 차단 |
| 잘못된 가격·SKU | SDK 표시 가격과 서버 정책 대조 | 해당 콘솔 상품 노출 OFF |
| 환불 후 잔액 사용 | 환불 재조정과 debt/review 상태 | 유료 기능 제한 후 운영 검토 |
| mTLS 만료 | 만료 모니터링, 다중 인증서 교체 | 신규 결제 차단, 기존 주문 기록 보존, 인증서 교체 |
| 제공자 장애 | timeout, 제한 재시도, 지급 보류 | 결제 버튼 비활성화, 미완료 주문 재조정 |
| 마이그레이션 문제 | staging upgrade와 롤백 검증 | 데이터 보존 후 이전 코드로 복귀; 구매 기록 삭제 금지 |
| HMAC 키 교체·소실 | 인증 키와 분리, 비밀 저장소 백업, 시작 단계 길이 검증 | 신규 결제 차단 후 기존 키 복구; 새 키로 임의 교체 금지 |

롤백의 기본 단위는 신규 결제 시작 기능이다. 콘솔 상품 노출 OFF와 서버 `TOSS_IAP_PURCHASE_ENABLED=false`로 신규 구매를 막되, `TOSS_IAP_ENABLED=true`를 유지하여 이미 결제된 주문의 검증·복원·환불 처리 API와 운영 작업은 중단하지 않는다.

## 형상관리 가능한 태스크 분할

| 태스크 | 변경 경계 | 독립 검증 | 커밋 |
| --- | --- | --- | --- |
| IAP-01 서버 기반 | migration, model, SKU 정책, 공통 Toss API, order service | alembic·provider tests | `82e45c6` |
| IAP-02 지급·환불 | grant API, repository, scheduler | backend pytest | `9fa8c45` |
| IAP-03 앱 결제 | IAP adapter, hook, credit store UI | typecheck·domain·build:toss | `2ff43ea` |
| IAP-04 운영 조회 | 상태 큐와 주문 상세 조회 | backend API pytest | `1742fb2` |
| IAP-05 DB 동시성 | 독립 세션 동시 지급 통합 테스트 | PostgreSQL integration pytest | `9307c43` |
| IAP-06 계획·증빙 | 공식 가이드 매핑, 검증 결과, 출시 게이트 | 문서 링크·체크리스트 | `f41f24c` 및 후속 증빙 커밋 |
| IAP-07 사용자 이력·설정 안전성 | 재가입 보너스 방지, 전용 HMAC 키, 시작 설정 검증, `0022` 인덱스 | backend 303건·PostgreSQL integration·alembic | `5cc2d47` |
| IAP-08 앱 재실행 복원 | 로그인 직후 복원, 상점 재시도, 동시 호출 공유 | frontend 151건·typecheck·web·AIT build | `2b60179` |
| IAP-09 재무 정합성 감사 | 장기 미지급·상태·구매/환불 원장·계정 잔액 감사 API | backend 305건·PostgreSQL 변조 탐지 | `4f83a4d` |
| IAP-10 배포 산출물 위생 | `.ait`와 `.granite` Git 제외 | clean worktree 확인 | `05b7d64` |
| IAP-11 제한 활성화 | 토스 provider 전용 결정적 퍼센트 롤아웃 | backend 대상 테스트·전체 313건 | `035f144` |
| IAP-12 운영 무결성 신호 | 재조정 감사 오류 로그와 설정 검증 | scheduler·설정 테스트·전체 313건 | `437bce6` |
| IAP-13 상품 등록 자산 | SKU별 SVG 원본·1024px PNG·SHA-256 매니페스트 | 크기·형식·알파 채널·직접 시각 검수 | `4813d0f` |
| IAP-14 사용자 결제 내역 | 사용자 범위 구매 API, 크레딧 상점 결제·환불 상태 | backend API·frontend domain·typecheck·build | `4901127` |
| IAP-15 전체 복원 최소 버전 | Android 5.234.0·iOS 5.233.0 구매 게이트 | SDK 계약 대조·frontend 155건·typecheck·AIT build | `415f3a2` |
| IAP-16 구매 안전 설정 | 구매 ON 시 재조정·감사 경보 강제 | 설정 테스트·backend 전체 316건 | `28f5155` |
| IAP-17 외부 출시 승인 | 콘솔 매핑, 샌드박스 증빙, 외부 알림 연결, 운영 승인 | 수동 게이트 서명 | 운영 정보 준비 후 별도 커밋 |
| IAP-18 탈퇴·구매기록 수명주기 | Toss 연결 해제, 5년 분리 보관, `0023`, 만료 삭제 | backend 326건·PostgreSQL integration·alembic | `f2592e5` |
| IAP-19 고객 문서·법무 승인 | 개인정보처리방침, 유료서비스·환불 약관, 재동의 | 대표자·법무 서명과 공개 URL 확인 | 승인 후 별도 커밋 |
| IAP-20 콘솔 출시 사전 검증 | 콘솔 매니페스트 모델·CLI·Make target·실패형 템플릿 | backend 330건·preflight 4건 | `5b6d5e6` |
| IAP-21 실제 콘솔 상품 매핑 | SKU 5개, 공급가·판매가, 서버 정책, 환경 예시, 상품 증거 | backend 329 passed, 1 skipped·frontend domain 155 passed·preflight 상품 정책 통과 | `41aa53a` |
| IAP-22 콘솔 상품 불변식 강화 | 공급가 서버 정책 고정, 매니페스트 중복 SKU·공급가 드리프트 차단 | backend 331 passed, 1 skipped·preflight 5 passed | `ff735eb` |
| IAP-23 복원 지급·통지 분리 | 서버 지급 성공 후 완료 통지 실패를 pending으로 분류하고 잔액 갱신·재진입 재시도 | frontend domain 156건·typecheck·web·AIT build | `2471416` |
| IAP-24 재조정 로그 식별자 제거 | 주문별 재조정 예외 로그에서 원본 주문 ID 제거 | scheduler 5건·backend 332 passed, 1 skipped·compile | `8871cb8` |
| IAP-25 최신 출시 후보 고정 | IAP-23 포함 `.ait`, SHA-256, 배포 ID와 예시 매니페스트를 Git에 고정 | preflight 5 passed·번들 문자열·해시 대조 | `4142a1a` |

로컬 구현 커밋과 외부 출시 승인 커밋을 분리하여 코드 완료와 실제 판매 가능 상태를 혼동하지 않는다.

## 남은 행동 순서

1. 콘솔 승인 종류와 정산 정보 완료 상태를 캡처한다.
2. 준비된 `ashwoodfriends-alive-iap-2471416.ait`를 콘솔 `앱 출시`에 업로드한다. 이전 `ashwoodfriends-alive-iap-415f3a2.ait`는 기록 보존용이며 업로드하지 않는다.
3. 배포 ID·콘솔 표시 버전·테스트 QR을 기록하고 QR 테스트를 최소 1회 완료한다.
4. 인앱 상품 등록 화면에서 업로드한 번들을 `최소 지원 버전`으로 선택한다.
5. 등록된 상품 5개의 최소 지원 버전을 IAP 포함 승인 번들로 변경하고, 상품 수정 검토가 요구되면 제출한다.
6. 상품은 노출 OFF로 유지한 채 지급량·첫 구매·환불 정책의 최종 제품·재무 승인을 받는다.
7. 콘솔 표시 버전과 최소 지원 버전을 매니페스트에 기록하고 `make iap-release-check` 통과 결과를 보관한다.
8. mTLS 인증서의 운영 배포 상태와 만료일을 확인하고, 인증 세션 키와 별도인 32-byte 이상 `TOSS_IAP_SUBJECT_HMAC_KEY`를 비밀 저장소에 생성·백업한다.
9. 스테이징에 migrations `0021`·`0022`·`0023`과 코드를 배포하고 통합 ON, 신규 구매 OFF, 롤아웃 0, 재조정·감사 경보 ON으로 시작 검증을 통과시킨다.
10. `.env.example`의 실제 SKU를 스테이징 환경 변수에 연결하고 SDK `displayAmount`와 콘솔 VAT 포함 판매가를 대조한다.
11. Android 5.234.0 이상과 iOS 5.233.0 이상 테스트 기기를 준비하고, 그 미만 버전에서는 구매가 비활성화되는지 확인한다.
12. 샌드박스 시간에 신규 구매 ON·롤아웃 100과 테스트 상품 노출 ON으로 필수 시나리오를 `documents/qa/evidence/`에 증빙한다.
13. 로그 수집 시스템에 `iap_integrity_alert`와 재조정 실패 critical 알림, 담당자와 응답 시간을 등록한다.
14. 구매기록 보존 결정과 개인정보처리방침·유료서비스·환불 약관을 승인·배포하고 필요한 재동의를 완료한다.
15. 운영·정산·환불 체크리스트 승인 후 신규 구매 ON·롤아웃 10%로 제한 활성화하고 24시간 이상 관찰한다.
16. 감사·정산 대조가 깨끗할 때 25% → 50% → 100%로 확대한다.

## 검증하지 못한 것

### 2026-08-11 로컬 환경 준비 점검

- `.env.example`에는 실제 SKU 5개와 안전한 OFF 기본값이 기록됐지만, 프로젝트의 로컬·스테이징 비밀 환경에는 IAP 설정, 전용 HMAC 키와 mTLS가 아직 주입되지 않았다.
- 로컬 `secrets/toss/toss-mtls-cert.pem`과 `toss-mtls-key.pem` 파일은 존재하지 않는다.
- 따라서 실제 토스 주문 상태 API 호출과 샌드박스 결제는 아직 실행할 수 없다. 이 값들이 준비되기 전에는 신규 구매 플래그를 활성화하지 않는다.

### 외부 확인 대기

- 실제 앱인토스 콘솔의 승인 종류와 정산 검토 상태
- `.ait` 업로드 후 발급되는 배포 ID·콘솔 표시 버전과 상품 `최소 지원 버전` 후보
- 운영 mTLS 인증서의 배포 여부, 만료일과 실제 연결
- 샌드박스 앱에서의 결제·복원·환불 동작
- 운영 정산 계좌와 세금계산서 정보
- 실제 PostgreSQL 독립 세션 2개의 동시 지급은 통과했으나, 다중 애플리케이션 프로세스 환경의 충돌과 timeout 후 재시도는 미검증
- 실제 데이터가 있는 스테이징 DB의 downgrade 복구 훈련
- `0023` 실제 적용·다운·재적용과 PostgreSQL 수명주기 통합 테스트는 통과했지만, 빈 DB부터 전체 오프라인 SQL을 생성하는 명령은 기존 `0009` 데이터 변환 마이그레이션의 오프라인 연결 미지원으로 실패한다. 스테이징에서는 온라인 migration과 백업·복구 절차를 사용한다.
- 실행 중인 프런트엔드가 없어 Playwright 브라우저 회귀는 미실행

## 남은 위험

- 상품 등록 시 임시로 선택한 결제 미포함 기존 최소 지원 버전을 IAP 포함 승인 버전으로 교체하지 않으면 구버전 사용자가 결제 상품에 접근할 위험이 있다.
- 계정 삭제 후 구매 원장의 5년 분리 보관·만료 삭제는 구현됐지만, HMAC 기반 부정 이용 방지 목적과 공개 문구는 법무·대표자 승인이 필요하다.
- 전용 HMAC 키를 분실하거나 임의 교체하면 탈퇴 사용자의 과거 구매 이력을 연결할 수 없으므로 운영 비밀 백업·복구 절차가 필요하다.
- `debt_credits`가 있는 사용자의 유료 기능 제한 범위와 고객지원 해제 절차는 운영 정책 승인이 필요하다.
- 결제 알림 URL의 이벤트 계약과 운영 인증 방식은 콘솔·공식 세부 문서에서 최종 확인해야 한다.
- SDK 2.10.8의 `getCompletedOrRefundedOrders` 공개 타입은 페이지 키 인자를 누락하지만 실제 native bridge와 공식 문서는 이를 지원하므로, SDK 업그레이드 때 임시 타입 보정을 제거할 수 있는지 확인해야 한다.
- 기본 IAP 지원 버전 5.219.0과 달리 `alive`는 전체 복원 계약 때문에 Android 5.234.0·iOS 5.233.0을 요구한다. SDK 업그레이드 때 각 IAP 함수의 최소 버전을 다시 대조해야 한다.
- 퍼센트 롤아웃은 클라이언트 카탈로그 게이트이므로 제공자 측 신규 판매의 최종 차단 수단은 콘솔 상품 노출 OFF다.

## 공식 참고 자료

- [인앱 결제 콘솔·상품·환불 가이드](https://developers-apps-in-toss.toss.im/guide/monetization/in-app-payment)
- [앱 번들 업로드와 토스앱 테스트](https://developers-apps-in-toss.toss.im/development/test/toss.html)
- [미니앱 검토·출시·버전 관리](https://developers-apps-in-toss.toss.im/development/deploy.html)
- [인앱결제 개발 및 샌드박스](https://developers-apps-in-toss.toss.im/iap/develop.html)
- [일회성 IAP API 레퍼런스](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/IAP.html)
- [비게임 출시 체크리스트](https://developers-apps-in-toss.toss.im/checklist/app-nongame.html)
- [mTLS 인증서와 API 공통 규격](https://developers-apps-in-toss.toss.im/development/integration-process.html)
- [정산 안내](https://developers-apps-in-toss.toss.im/guide/settlement)
- [Toss 로그인 연결 끊기](https://developers-apps-in-toss.toss.im/login/develop.html)
- [전자상거래법 시행령 제6조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0006&lsiSeq=269055&urlMode=lsScJoRltInfoR)
- [개인정보 보호법 제21조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1020398651)

## 관련 프로젝트 문서

- [앱인토스 인앱결제 로컬 출시 준비 감사](../../../reports/release/store/report_apps-in-toss-iap-local-readiness_2026-08-11.md)
- [앱인토스 인앱결제 구매기록 보존 및 탈퇴 처리 결정](decision_apps-in-toss-iap-purchase-retention_2026-08-11.md)
- [앱인토스 인앱결제 고객 노출 법률 문구 초안](proposal_apps-in-toss-iap-legal-copy_2026-08-11.md)
- [앱인토스 인앱결제 배포 및 운영 가이드](../../../guides/guide_apps-in-toss-iap-operations.md)
- [앱인토스 출시 백로그](plan_apps-in-toss-launch-backlog_2026-07-31.md)
- [크레딧 BM 및 AI 출시 준비 계획](../../product/credit/plan_credit-bm-and-ai-release-readiness_2026-08-09.md)
- [크레딧 AI 비용·보안 마진 검토](../../../reports/product/bm/report_credit-ai-cost-security-margin-review_2026-08-09.md)
- [앱인토스 출시 가드레일](../../../reports/apps-in-toss/report_apps-in-toss-launch-guardrails_2026-07-29.md)
