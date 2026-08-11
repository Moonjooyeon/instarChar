---
title: 앱인토스 인앱결제 샌드박스 검증 가이드
author: black (black@ashwoodfriends.com)
created: 2026-08-11
updated: 2026-08-11
version: 1.7.0
status: ready
---

# 앱인토스 인앱결제 샌드박스 검증 가이드

## 목적

Apps in Toss 일회성 인앱결제를 실제 판매 전에 샌드박스 앱에서 검증하고, 주문·지급·복원·환불 정합성을 재현 가능한 증거로 남긴다. 샌드박스에서는 실제 과금이 발생하지 않는다.

공식 [인앱결제 개발 가이드](https://developers-apps-in-toss.toss.im/iap/develop.html)와 [IAP API 레퍼런스](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%EC%95%B1%20%EA%B2%B0%EC%A0%9C/IAP.html)를 기준으로 한다.

## 준비된 업로드 후보

| 항목 | 값 |
| --- | --- |
| 파일 | `documents/qa/evidence/ashwoodfriends-alive-iap-2471416.ait` |
| 앱 코드 커밋 | `2471416` |
| 산출물 고정 커밋 | `4142a1a` |
| 백엔드 IAP·탈퇴·로그 보안 커밋 | `f2592e5`, `8871cb8` |
| 빌드 생성 배포 ID | `019fef5f-aa96-7f25-81fc-450ce522b0f2` |
| SHA-256 | `58bd2e1868bce606d24d9de82e2e56bdef1567144d440b5c18c6e5b873e56d6f` |
| 크기 | 약 6.9MB |
| 상태 | `npm run build:toss` 통과, 콘솔 업로드 전 |

이 후보는 IAP 앱 코드를 포함하지만 콘솔 업로드, QR 실행과 운영 백엔드 배포까지 증명하지 않는다. 콘솔 업로드 후 표시되는 값과 위 배포 ID가 같은지 확인하고 실행 정보에 기록한다.

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
| 전체 결제 흐름 최소 토스 앱 | Android `5.234.0`, iOS `5.233.0` |
| `.ait` 파일·커밋 |  |
| 배포 ID·콘솔 표시 버전 |  |
| 상품 최소 지원 버전 |  |
| 샌드박스 앱·OS·버전 |  |
| 스테이징 API URL |  |
| DB migration current/head | `20260811_0023` / `20260811_0023` |
| 콘솔 승인·정산 상태 |  |
| mTLS 인증서 만료일 |  |
| 신규 결제 플래그 | 테스트 시작 전 `false`, 실행 승인 후에만 `true` |
| 구매 롤아웃 | 테스트 시작 전 `0`, 실행 시간 `100` |
| 재조정·감사 경보 | 실행 시간 모두 `true` |

## 상품 매핑 사전 점검

콘솔의 VAT 포함 가격과 SDK `displayAmount`가 같은지 직접 대조한다. 서버의 `price_krw`는 지급 검증 근거로 사용하지 않는다.

| 상품 | 업로드 이미지 | 콘솔 SKU | 공급가 | VAT 포함 가격 | SDK 표시 가격 | 지급 C | 결과 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `credit-5000` | [credit-500.png](../evidence/apps-in-toss-iap-products/credit-500.png) |  |  |  |  | 500 | not run |
| `credit-10000` | [credit-1000.png](../evidence/apps-in-toss-iap-products/credit-1000.png) |  |  |  |  | 1,000 | not run |
| `credit-30000` | [credit-3150.png](../evidence/apps-in-toss-iap-products/credit-3150.png) |  |  |  |  | 3,150 | not run |
| `credit-50000` | [credit-5500.png](../evidence/apps-in-toss-iap-products/credit-5500.png) |  |  |  |  | 5,500 | not run |
| `credit-100000` | [credit-11500.png](../evidence/apps-in-toss-iap-products/credit-11500.png) |  |  |  |  | 11,500 | not run |

이미지 크기·해시는 [상품 이미지 증거](../evidence/apps-in-toss-iap-products/README.md)를 기준으로 확인한다. 상품 등록 화면 캡처에는 이미지, 상품명, SKU, 공급가, 판매가, 최소 지원 버전과 노출 상태가 함께 보이도록 남긴다.

콘솔 등록이 끝나면 [매니페스트 예시](apps-in-toss-iap-console-manifest.example.json)를 `documents/qa/evidence/apps-in-toss-iap-console-manifest.json`으로 복사하고 대괄호 값, 다섯 SKU와 공급가를 실제 콘솔 값으로 교체한다. 비밀키·인증서·운영 키는 넣지 않는다. 스테이징 SKU 환경 변수가 주입된 셸에서 다음 명령을 실행하고 결과를 증거로 남긴다.

```bash
make iap-release-check IAP_RELEASE_MANIFEST=documents/qa/evidence/apps-in-toss-iap-console-manifest.json
```

검증 실패는 SKU·가격·지급량·문구·이미지·번들 또는 노출 상태 중 하나가 서버 정책과 다르다는 뜻이다. 콘솔과 코드 중 승인된 정책과 다른 쪽을 수정한 뒤 다시 검증하며, 오류를 무시하고 샌드박스를 시작하지 않는다.

사전 조건을 아래 순서로 확인한다.

1. 현재 검증할 커밋으로 `npm run build:toss`를 실행해 `.ait`를 생성한다.
2. 콘솔 `앱 출시` 메뉴에 `.ait`를 업로드하고 배포 ID, 콘솔 표시 버전과 테스트 QR을 기록한다.
3. QR로 업로드 번들을 최소 1회 실행하고 앱 이름과 API 연결을 확인한다.
4. Android 5.234.0·iOS 5.233.0 이상에서는 상품이 활성화되고, 그 미만 테스트 환경에서는 업데이트 안내와 비활성 구매 버튼이 표시되는지 확인한다.
5. 상품 등록 화면의 `최소 지원 버전`에서 업로드한 번들을 선택한다. 목록이 비어 있으면 상품 등록을 중단하고 번들 업로드 상태부터 확인한다.
6. 콘솔 상품 유형이 모두 `소모품`이고 사전 검증 시점에는 전부 노출 OFF인지 확인한다.
7. 스테이징 비밀 저장소에 32-byte 이상 `TOSS_IAP_SUBJECT_HMAC_KEY`, mTLS 인증서와 키가 있는지 확인한다.
8. 다섯 SKU가 모두 존재하고 중복되지 않는지 배포 로그의 설정 사전 검증 결과로 확인한다.
9. 실제 콘솔 매니페스트로 `make iap-release-check`를 실행해 5개 상품 통과 결과를 증빙한다.
10. migration current/head가 모두 `20260811_0023`인지 확인한다.
11. 배포된 개인정보처리방침과 이용약관에 승인된 Toss 로그인·구매기록 보존·유료서비스·환불 문구가 있고 `TERMS_VERSION` 재동의 계획이 완료됐는지 확인한다.
12. 먼저 통합 ON, 신규 구매 OFF, 롤아웃 0, 재조정·감사 경보 ON으로 복원·조회 경로와 깨끗한 감사 결과를 확인한다.
13. 담당자 승인 후 테스트 시간 동안에만 신규 결제 ON, 롤아웃 100과 대상 상품 노출 ON을 적용한다. 재조정 또는 감사 경보가 OFF이면 서버가 기동을 거절해야 한다.

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

### SB-03A 서버 지급 성공·지급 완료 통지 실패

1. 서버 지급 API는 성공시키고 `completeProductGrant`만 `false` 또는 오류가 되도록 승인된 장애 주입을 적용한다.
2. 앱 잔액이 즉시 갱신되고 “크레딧은 복원했어요”와 다음 진입 재시도 안내가 표시되는지 확인한다.
3. 구매 원장과 잔액은 한 번만 증가하지만 해당 주문이 아직 pending으로 남는지 확인한다.
4. 장애를 해제하고 재진입해 `completeProductGrant`가 다시 호출되는지 확인한다.
5. 재시도 뒤 주문이 pending 목록에서 사라지고 크레딧이 중복 지급되지 않는지 확인한다.

통과 조건: 제공자 지급 완료 통지 실패가 서버 지급 성공을 사용자 실패로 되돌리지 않으며, 잔액은 갱신되고 다음 진입에서 통지만 안전하게 재시도된다.

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

### SB-06 사용자 결제 내역과 기기 변경

1. SB-02 결제 뒤 크레딧 상점의 `결제 내역`에서 지급량, 지급 완료 상태, 시각과 주문 식별자가 보이는지 확인한다.
2. SB-05 환불 뒤 같은 항목이 환불 완료로 바뀌는지 확인한다.
3. 다른 토스 계정에서는 해당 주문이 보이지 않는지 확인한다.
4. 같은 토스 계정으로 다른 테스트 기기에서 로그인해 잔액과 결제·환불 내역이 유지되는지 확인한다.

통과 조건: 사용자별 서버 원장 범위가 지켜지고 같은 토스 계정의 기기 변경 뒤에도 지급 결과와 내역이 유지된다.

### SB-07 전용 계정 탈퇴와 Toss 연결 해제

이 시나리오는 실제 사용자 데이터가 없는 격리된 스테이징과 전용 Toss 테스트 계정에서만 실행한다. 운영 DB의 `purge_at`이나 구매 보존 만료일을 수동 변경하지 않는다.

1. 전용 계정으로 가장 낮은 가격의 테스트 상품을 구매하고 지급·원장 정합성을 확인한다.
2. 격리 환경에서만 계정 삭제 유예기간을 테스트용으로 줄이고 계정 삭제를 요청한다.
3. 계정 삭제 스케줄러가 Apps in Toss `remove-by-user-key`를 성공 처리한 뒤 사용자 행을 삭제하는지 확인한다.
4. 구매행의 `user_id`가 `NULL`이고 `retention_until`이 거래일 기준 5년으로 설정됐는지 보호된 운영 조회와 DB 증거로 확인한다.
5. 사용자 FK·원문 userKey·토큰·HMAC이 로그와 증거 파일에 노출되지 않았는지 확인한다.
6. 테스트가 끝나면 유예기간 설정을 7일로 복구하고 설정 변경 시각·담당자·복구 증거를 남긴다.

통과 조건: Toss 연결 해제 성공 전에 계정을 삭제하지 않고, 성공 뒤에는 일반 계정 데이터와 구매 원장이 분리되며 보존 만료가 정확하다. 5년 만료 행 삭제 자체는 실제 PostgreSQL 자동 통합 테스트 결과로 대체한다.

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
| 콘솔 매니페스트 사전 검증 | not run |  | `passed for 5 products` 필요 |
| 정상 결제·멱등성 | not run |  |  |
| 서버 실패·재진입 복원 | not run |  |  |
| 서버 지급 성공·완료 통지 재시도 | not run |  |  |
| 오류 처리 | not run |  |  |
| 환불·부채 재조정 | not run |  |  |
| 사용자 결제 내역·기기 변경 | not run |  |  |
| 전용 계정 탈퇴·Toss 연결 해제 | not run |  | 격리 스테이징 전용 |
| 운영 조회 대조 | not run |  |  |

모든 필수 게이트가 `passed`이고 정산·환불·인증서 담당자가 승인한 뒤에만 제한적으로 `TOSS_IAP_PURCHASE_ENABLED=true`를 유지한다. 실패 시 콘솔 상품 노출 OFF와 신규 결제 플래그 비활성화를 먼저 수행하되, 이미 결제된 주문의 복원과 환불을 위해 `TOSS_IAP_ENABLED=true`는 유지한다.

운영 공개는 [앱인토스 인앱결제 배포 및 운영 가이드](../../guides/guide_apps-in-toss-iap-operations.md)에 따라 롤아웃 10%부터 시작한다. 샌드박스 종료 시 신규 구매 OFF·롤아웃 0·테스트 상품 노출 OFF로 복구하고 변경 시각을 기록한다.
