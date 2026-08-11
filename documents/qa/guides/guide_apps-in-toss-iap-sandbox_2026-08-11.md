---
title: 앱인토스 인앱결제 샌드박스 검증 가이드
author: black (black@ashwoodfriends.com)
created: 2026-08-11
updated: 2026-08-11
version: 1.0.0
status: ready
---

# 앱인토스 인앱결제 샌드박스 검증 가이드

## 목적

Apps in Toss 일회성 인앱결제를 실제 판매 전에 샌드박스 앱에서 검증하고, 주문·지급·복원·환불 정합성을 재현 가능한 증거로 남긴다. 샌드박스에서는 실제 과금이 발생하지 않는다.

공식 [인앱결제 개발 가이드](https://developers-apps-in-toss.toss.im/iap/develop.html)와 [IAP API 레퍼런스](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/IAP.html)를 기준으로 한다.

## 판정 규칙

- 각 항목을 `passed`, `failed`, `not run` 중 하나로 기록한다.
- `failed` 또는 필수 항목의 `not run`이 하나라도 있으면 `TOSS_IAP_PURCHASE_ENABLED=false`와 콘솔 상품 노출 OFF를 유지한다.
- 화면 캡처, 비식별 서버 로그와 운영 조회 결과는 `documents/qa/evidence/`에 저장한다.
- 인증서, 개인키, HMAC 키, 세션 쿠키와 `X-Moderation-Key`는 캡처하거나 저장소에 기록하지 않는다.
- 오류를 발견하면 같은 주문을 임의 조정하지 말고 주문 상세 조회 결과와 함께 별도 결함으로 기록한다.

## 실행 정보

| 항목 | 기록값 |
| --- | --- |
| 실행 일시·담당자 |  |
| 브랜치·커밋 | `codex/apps-in-toss-iap` /  |
| 앱 이름 | `ashwoodfriends-alive` |
| SDK | `@apps-in-toss/web-framework` 2.10.8 |
| 샌드박스 앱·OS·버전 |  |
| 스테이징 API URL |  |
| DB migration current/head | `20260811_0022` / `20260811_0022` |
| 콘솔 승인·정산 상태 |  |
| mTLS 인증서 만료일 |  |
| 신규 결제 플래그 | 테스트 시작 전 `false`, 실행 승인 후에만 `true` |

## 상품 매핑 사전 점검

콘솔의 VAT 포함 가격과 SDK `displayAmount`가 같은지 직접 대조한다. 서버의 `price_krw`는 지급 검증 근거로 사용하지 않는다.

| 상품 | 콘솔 SKU | 공급가 | VAT 포함 가격 | SDK 표시 가격 | 지급 C | 결과 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `credit-5000` |  |  |  |  | 500 | not run |
| `credit-10000` |  |  |  |  | 1,000 | not run |
| `credit-30000` |  |  |  |  | 3,150 | not run |
| `credit-50000` |  |  |  |  | 5,500 | not run |
| `credit-100000` |  |  |  |  | 11,500 | not run |

사전 조건을 아래 순서로 확인한다.

1. 콘솔 상품 유형이 모두 `소모품`이고 테스트 대상만 노출 ON인지 확인한다.
2. 스테이징 비밀 저장소에 32-byte 이상 `TOSS_IAP_SUBJECT_HMAC_KEY`, mTLS 인증서와 키가 있는지 확인한다.
3. 다섯 SKU가 모두 존재하고 중복되지 않는지 배포 로그의 설정 사전 검증 결과로 확인한다.
4. migration current/head가 모두 `20260811_0022`인지 확인한다.
5. 먼저 `TOSS_IAP_ENABLED=true`, `TOSS_IAP_PURCHASE_ENABLED=false`로 복원·조회 경로만 확인한다.
6. 담당자 승인 후 테스트 시간 동안에만 신규 결제 플래그와 대상 상품 노출을 활성화한다.

## 필수 시나리오

### SB-01 상품 목록

1. 크레딧 상점에 진입한다.
2. 콘솔 노출 ON 상품만 구매 가능하고 OFF 상품은 구매 가능 목록에 없는지 확인한다.
3. 상품별 SKU와 SDK 표시 가격을 상품 매핑표에 기록한다.
4. 상품 목록 화면과 콘솔 설정 화면을 각각 캡처한다.

통과 조건: 노출, SKU, `displayAmount`가 콘솔과 일치하고 서버 내부 가격이 결제 화면에 대신 노출되지 않는다.

### SB-02 정상 결제와 멱등 지급

1. 가장 낮은 가격의 소모품을 한 번 구매한다.
2. 성공 이벤트의 `orderId`가 생성되고 서버 주문 상태 조회가 `PAYMENT_COMPLETED` 또는 이미 완료된 `PURCHASED`를 반환하는지 확인한다.
3. 앱 잔액, `credit_purchases`, 구매 원장과 운영 주문 상세의 지급량이 일치하는지 확인한다.
4. 같은 `orderId`로 지급 API를 다시 호출해 잔액과 구매 원장이 증가하지 않는지 확인한다.

통과 조건: 최초 호출만 지급되고 성공 UI와 잔액이 갱신되며 재호출은 저장된 결과만 반환한다.

### SB-03 결제 성공·서버 지급 실패 복원

1. 샌드박스에서 제공하는 파트너 서버 지급 실패 시나리오를 선택하거나 승인된 스테이징 장애 주입 방법을 사용한다.
2. 결제 완료 후 지급 실패 안내가 표시되고 성공 잔액이 반영되지 않는지 확인한다.
3. 장애를 해제하고 앱을 완전히 종료한 뒤 같은 토스 사용자로 재진입한다.
4. 로그인 세션 복구 직후 `getPendingOrders`가 주문을 찾고 지급 API 성공 후 `completeProductGrant`가 완료되는지 확인한다.
5. 로그인 직후 복원과 상점 진입이 겹쳐도 한 번만 지급되고, 상점에서 갱신된 잔액 또는 재시도 결과가 표시되는지 확인한다.
6. 두 번째 재진입에서 같은 주문이 다시 지급되지 않는지 확인한다.

통과 조건: 실패 주문이 유실되지 않고 한 번만 복원되며 최종 잔액·원장·주문 상태가 일치한다.

### SB-04 오류 처리

공식 샌드박스가 제공하는 방법으로 사용자 취소, 네트워크 오류, 내부 오류와 파트너 상품 지급 실패를 각각 실행한다.

| 오류 | 기대 화면 | 잔액·원장 | 결과 |
| --- | --- | --- | --- |
| 사용자 취소 | 취소 안내 | 변경 없음 | not run |
| 네트워크 오류 | 재시도 안내 | 검증 전 지급 없음 | not run |
| 내부 오류 | 일시 오류 안내 | 검증 전 지급 없음 | not run |
| 파트너 지급 실패 | 재진입 복원 안내 | 복원 성공 전 지급 없음 | not run |

### SB-05 환불 재조정

1. 콘솔 또는 테스트 앱에서 지원하는 공식 환불 절차로 SB-02 주문을 환불한다.
2. 클라이언트 이력 조회 또는 서버 재조정 뒤 구매 상태가 `refunded`인지 확인한다.
3. 지급 크레딧과 첫 구매 보너스가 회수됐는지 확인한다.
4. 이미 사용한 크레딧이 있으면 잔액이 음수가 되지 않고 부족분이 `debt_credits`에 기록되는지 확인한다.
5. 재조회해 chargeback 원장이 중복 생성되지 않는지 확인한다.

통과 조건: 환불이 한 번만 반영되고 구매 원장, 잔액·부채와 운영 주문 상세가 일치한다.

## 운영 조회 대조

운영 키를 로그나 문서에 남기지 않고 아래 보호된 API로 결과를 대조한다.

```http
GET /api/moderation/credit-purchases/audit
GET /api/moderation/credit-purchases?status=review
GET /api/moderation/credit-purchases/{order_id}
```

감사 응답의 `purchases`와 `accounts` 배열이 모두 비어 있어야 정상이다. 항목이 반환되면 각 `reasons`를 기준으로 주문 상세와 원장을 대조한다. `truncated=true`이면 `limit` 범위 밖에도 후보가 있으므로 신규 결제를 활성화하지 않고 운영 담당자가 전체 대조한다. 계정 구매 잔액은 `purchased_credits - debt_credits = purchased_ledger_total`, 보너스 잔액은 `bonus_credits = bonus_ledger_total`이어야 한다.

다음 값만 비식별 증거에 기록한다.

- 주문 ID, SKU와 내부·제공자 상태
- 기본·상품·첫 구매 보너스 지급량
- 총 지급·환불 회수량
- 잔액과 `debt_credits`
- purchase·chargeback 원장의 개수와 금액
- 실패 사유와 마지막 제공자 확인 시각

## 증거 파일 규칙

파일명은 `iap-<scenario>-<platform>-2026-08-11.<ext>` 형식을 사용한다. 예시는 다음과 같다.

- `iap-sb01-products-ios-2026-08-11.png`
- `iap-sb02-success-android-2026-08-11.png`
- `iap-sb03-restore-server-log-2026-08-11.txt`
- `iap-sb05-refund-operations-2026-08-11.json`

텍스트·JSON 로그에서는 토스 userKey, 쿠키, 인증·운영 키와 인증서 경로를 제거한다.

## 최종 결과

| 게이트 | 결과 | 증거 | 비고 |
| --- | --- | --- | --- |
| 상품 목록·가격 | not run |  |  |
| 정상 결제·멱등성 | not run |  |  |
| 서버 실패·재진입 복원 | not run |  |  |
| 오류 처리 | not run |  |  |
| 환불·부채 재조정 | not run |  |  |
| 운영 조회 대조 | not run |  |  |

모든 필수 게이트가 `passed`이고 정산·환불·인증서 담당자가 승인한 뒤에만 제한적으로 `TOSS_IAP_PURCHASE_ENABLED=true`를 유지한다. 실패 시 콘솔 상품 노출 OFF와 신규 결제 플래그 비활성화를 먼저 수행하되, 이미 결제된 주문의 복원과 환불을 위해 `TOSS_IAP_ENABLED=true`는 유지한다.
