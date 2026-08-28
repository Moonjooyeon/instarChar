---
title: Google Play RTDN 환불 연동 및 운영 가이드
author: black (black@ashwoodfriends.com)
created: 2026-08-25
updated: 2026-08-28
version: 1.1.0
status: active
---

# Google Play RTDN 환불 연동 및 운영 가이드

## 목적과 범위

이 가이드는 Google Play 소비성 일회성 크레딧 상품의 구매·취소·환불 상태를 ALIVE 백엔드에 전달하는 Real-time developer notifications(RTDN) 설정과 운영 절차를 설명한다. Google Play Console에서 환불한 주문의 크레딧을 자동 회수하려면 Google Play, Cloud Pub/Sub, ALIVE 백엔드 세 경계를 모두 연결하고 환불 시 구매 권한도 함께 회수해야 한다.

## 확정된 운영값

| 항목                            | 값                                                                        |
| ------------------------------- | ------------------------------------------------------------------------- |
| Google Cloud 프로젝트 ID        | `alive-500608`                                                            |
| Android 패키지                  | `com.ashwoodfriends.alive`                                                |
| Pub/Sub 주제 ID                 | `alive-google-play-rtdn`                                                  |
| Pub/Sub 주제 전체 이름          | `projects/alive-500608/topics/alive-google-play-rtdn`                     |
| Push 구독 ID                    | `alive-google-play-rtdn-push`                                             |
| ALIVE RTDN 엔드포인트           | `https://alive.imagebgremover.net/api/credits/purchases/google-play/rtdn` |
| Push OIDC audience              | `https://alive.imagebgremover.net/api/credits/purchases/google-play/rtdn` |
| Push 인증·구매 검증 서비스 계정 | `alive-play-billing-server@alive-500608.iam.gserviceaccount.com`          |
| Google Play 게시 시스템 계정    | `google-play-developer-notifications@system.gserviceaccount.com`          |

서비스 계정 JSON의 개인 키, HMAC 키, 액세스 토큰은 문서와 저장소에 기록하지 않는다.

## 알림 흐름

```text
Play Console 환불 + 이용 자격 취소(자격 삭제)
-> Google Play가 구매를 void 처리
-> alive-google-play-rtdn 주제에 VoidedPurchaseNotification 게시
-> alive-google-play-rtdn-push 구독이 인증된 HTTPS POST 전송
-> ALIVE가 purchaseToken으로 기존 구매 조회
-> 구매 상태를 refunded로 변경하고 지급 크레딧 회수
```

ALIVE는 `productType=2`인 일회성 상품의 `voidedPurchaseNotification`을 환불로 처리한다. 현재 상품은 다중 수량이 비활성화되어 있다. 향후 부분 환불을 지원하기 전에는 `refundType`을 구분하지 않는 현재 서버 동작을 재검토해야 한다.

환불만 실행하고 구매 권한을 회수하지 않으면 Google은 해당 주문을 void 처리하지 않는다. 이 경우 `voidedPurchaseNotification`과 Voided Purchases API 항목이 생성되지 않으므로 ALIVE 크레딧도 자동 회수되지 않는다.

## 1. Pub/Sub 주제 만들기

Google Cloud Console에서 프로젝트 `alive-500608`을 선택하고 `Pub/Sub > 주제 > 주제 만들기`로 이동한다.

```text
주제 ID: alive-google-play-rtdn
```

`기본 구독 추가`는 해제한다. ALIVE에는 인증된 Push 구독을 별도로 만든다.

## 2. Google Play 게시 권한 부여

생성한 `alive-google-play-rtdn` 주제의 권한 화면에서 다음 주 구성원을 추가한다.

```text
주 구성원: google-play-developer-notifications@system.gserviceaccount.com
역할: Pub/Sub 게시자
```

이 계정은 Google Play가 RTDN을 주제에 게시할 때 사용하는 고정 시스템 계정이다. `alive-play-billing-server@alive-500608.iam.gserviceaccount.com`과 역할이 다르므로 서로 대체할 수 없다.

### 도메인 제한 공유 오류

다음 오류가 발생하면 조직의 레거시 도메인 제한 공유 정책이 Google 시스템 계정을 차단한 것이다.

```text
IAM 정책 업데이트 실패
constraints/iam.allowedPolicyMemberDomains
```

레거시 `iam.allowedPolicyMemberDomains` 정책은 특정 서비스 계정 하나만 예외로 추가할 수 없다. 조직 전체가 아니라 `alive-500608` 프로젝트에서만 다음 순서로 처리한다.

1. Google Cloud Console `IAM 및 관리자 > 조직 정책`으로 이동한다.
2. 프로젝트 선택기를 `alive-500608`로 맞춘다.
3. `도메인 제한 공유` 또는 `Domain Restricted Sharing`을 검색한다.
4. `정책 관리`를 누르고 `상위 정책 재정의`를 선택한다.
5. 프로젝트 정책을 임시로 `허용: 모두` 또는 `시행 안 함`으로 저장한다.
6. Pub/Sub 주제로 돌아가 Google Play 시스템 계정에 `Pub/Sub 게시자` 역할을 저장한다.
7. 조직 정책으로 돌아가 프로젝트의 도메인 제한 정책을 원래 값으로 복원한다.
8. 주제 IAM에서 게시자 바인딩이 유지되는지 확인한다.

조직 정책 변경에는 `roles/orgpolicy.policyAdmin` 또는 동등한 권한이 필요하다. 권한이 없으면 조직 관리자에게 프로젝트 범위의 임시 재정의를 요청한다. 도메인 제한 정책은 기존 IAM 바인딩에 소급 적용되지 않으므로 역할을 추가한 뒤 정책을 다시 켜도 바인딩은 유지된다.

## 3. 인증된 Push 구독 만들기

`Pub/Sub > 구독 > 구독 만들기`에서 다음 값을 입력한다.

```text
구독 ID: alive-google-play-rtdn-push
주제: alive-google-play-rtdn
전송 유형: Push
엔드포인트 URL: https://alive.imagebgremover.net/api/credits/purchases/google-play/rtdn
인증 사용: 활성화
서비스 계정: alive-play-billing-server@alive-500608.iam.gserviceaccount.com
대상(Audience): https://alive.imagebgremover.net/api/credits/purchases/google-play/rtdn
만료: 만료 안 함
```

`페이로드 래핑 해제`는 활성화하지 않는다. ALIVE 요청 스키마는 Pub/Sub 기본 래퍼의 `message.messageId`와 base64 `message.data`를 사용한다.

인증 서비스 계정을 선택할 수 없거나 OIDC 토큰 생성 권한 오류가 나면 다음을 확인한다.

- 구독과 서비스 계정이 모두 `alive-500608` 프로젝트에 속한다.
- 구독을 만드는 사용자가 서비스 계정에 대한 `iam.serviceAccounts.actAs` 권한을 가진다.
- Pub/Sub 서비스 에이전트가 Push 인증 서비스 계정의 OIDC 토큰을 생성할 수 있다.

## 4. ALIVE 운영 환경 변수

Lightsail의 비공개 `/home/ubuntu/instarChar/.env.prod`에 다음 값을 각각 한 줄로 설정한다.

```dotenv
GOOGLE_PLAY_RTDN_ENABLED=true
GOOGLE_PLAY_RTDN_AUDIENCE=https://alive.imagebgremover.net/api/credits/purchases/google-play/rtdn
GOOGLE_PLAY_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL=alive-play-billing-server@alive-500608.iam.gserviceaccount.com
```

구매 검증 설정은 별도로 유지한다.

```dotenv
GOOGLE_PLAY_IAP_ENABLED=true
GOOGLE_PLAY_IAP_PURCHASE_ENABLED=true
GOOGLE_PLAY_IAP_PURCHASE_ROLLOUT_PERCENT=100
GOOGLE_PLAY_IAP_PACKAGE_NAME=com.ashwoodfriends.alive
GOOGLE_PLAY_SECRETS_DIR=/home/ubuntu/instarChar/secrets/google-play
GOOGLE_PLAY_IAP_SERVICE_ACCOUNT_JSON_PATH=/run/secrets/google-play/service-account.json
```

환경 변수를 추가한 뒤 기존 배포 절차로 백엔드를 재배포한다. 직접 프로세스를 임의로 시작하지 않는다.

## 5. Play Console RTDN 연결

Play Console에서 ALIVE 앱을 선택하고 `수익 창출 > 수익 창출 설정 > 실시간 개발자 알림`으로 이동한다.

```text
주제 이름: projects/alive-500608/topics/alive-google-play-rtdn
알림 유형: 구독 및 모든 일회성 제품 알림
```

설정을 저장하고 `테스트 메시지 전송`을 실행한다.

## 6. 환불과 이용 자격 취소

크레딧까지 회수해야 하는 운영 환불은 Play Console 주문 상세 화면에서 다음과 같이 처리한다.

1. `환불`을 누른다.
2. `이용 자격 취소` 항목의 `자격 삭제`를 선택한다.
3. 전액 환불이면 환불 비율을 `100%`로 유지한다.
4. 환불 사유를 선택하고 `환불`을 확정한다.

`자격 삭제`를 선택하지 않은 환불은 결제 금액만 돌려주고 구매 권한은 유지한다. 이미 이 방식으로 환불된 주문은 같은 화면에서 나중에 `자격 삭제`를 추가할 수 없으므로 별도 수동 재조정 대상으로 관리한다.

API로 처리할 때는 일회성 상품의 `orders.refund` 요청에 `revoke=true`를 전달한다.

## 7. 검증 순서

다음 순서로 확인한다.

- [ ] 운영 백엔드 `/health`가 HTTP 200을 반환한다.
- [ ] RTDN 환경 변수 세 개가 컨테이너에 전달되었다.
- [ ] Play Console 테스트 메시지가 성공한다.
- [ ] Push 요청이 HTTP 204를 반환한다.
- [ ] `google_play_rtdn_events`에 테스트 이벤트가 중복 없이 기록된다.
- [ ] 테스트 구매가 한 번만 지급되고 소비 처리된다.
- [ ] Play Console에서 `자격 삭제`를 선택해 전액 환불한 뒤 `voided` 이벤트가 기록된다.
- [ ] `credit_purchases.status`가 `refunded`로 바뀐다.
- [ ] `chargeback_credits`와 chargeback 원장이 지급액과 일치한다.
- [ ] 잔액이 부족하면 부족분이 `debt_credits`에 기록된다.

상태 코드별 우선 점검 항목은 다음과 같다.

| 상태  | 의미와 우선 점검                                          |
| ----- | --------------------------------------------------------- |
| `204` | 정상 수신·처리 또는 안전한 중복 수신                      |
| `400` | Pub/Sub 데이터, 패키지명, 알림 형식 오류                  |
| `401` | OIDC JWT, audience, 서비스 계정 이메일 불일치             |
| `503` | `GOOGLE_PLAY_RTDN_ENABLED` 비활성화 또는 검증 의존성 장애 |

## 8. 이미 놓친 환불 복구

RTDN을 나중에 활성화해도 과거 환불 이벤트가 자동 재전송된다고 보장할 수 없다. 이미 Google에서 환불됐지만 ALIVE 구매가 `granted`로 남은 주문은 다음 절차로 별도 복구한다.

1. Play Console에서 환불 완료 상태와 당시 구매 권한 회수 여부를 확인한다.
2. 로컬 `credit_purchases`의 Google Play 구매 토큰과 사용자를 식별한다.
3. 같은 구매에 환불 조정이 아직 없는지 확인한다.
4. 기존 환불 서비스 경계를 통해 한 번만 재조정한다.
5. 구매 상태, chargeback 원장, 잔액, 부채를 함께 검증한다.

DB 행이나 크레딧 잔액을 임의 SQL로 직접 수정하지 않는다. 구매·원장·계정 상태를 하나의 트랜잭션으로 갱신하는 서버 로직을 사용한다.

개발자가 `revoke` 없이 실행한 환불은 Voided Purchases API에 나타나지 않는다. 따라서 Play Console에는 환불됨으로 표시되지만 API에서 찾을 수 없는 주문도 수동 재조정 대상일 수 있다.

## 9. 운영 검증 기록

2026-08-28 실제 일회성 500크레딧 상품으로 구매 후 `자격 삭제`를 선택해 전액 환불했다. 운영 DB에서 다음 결과를 확인했다.

- 구매 RTDN: `one_time_purchased`, 처리 상태 `granted`
- 환불 RTDN: `voided`, 처리 상태 `refunded`
- 구매 상태: `refunded`, 공급자 상태 `REFUNDED`
- 지급 크레딧: `500`, chargeback 크레딧: `500`
- 원장: 구매 `+500`, chargeback `-500`
- 부족분 부채: `0`

이 검증으로 Google Play, Pub/Sub Push, ALIVE RTDN 엔드포인트, 구매 조회, 크레딧 회수 및 원장 기록 경로가 정상 작동함을 확인했다.

## 10. 2026-08-25 환불 미반영 기록

운영 조사에서 Google Play 구매와 지급 기능은 활성화되어 있었지만 RTDN 환경 변수 세 개가 없었다. 환불된 주문은 ALIVE DB에서 `granted`, `chargeback_credits=0`, `refunded_at=NULL`로 남았고 `google_play_rtdn_events`도 0건이었다. 원인은 UI 캐시가 아니라 환불 알림 경로의 운영 비활성화였다.

해당 주문은 RTDN 활성화와 별도로 수동 재조정 대상이다.

## 참고

- [Google Play Billing 준비 및 RTDN 설정](https://developer.android.com/google/play/billing/getting-ready)
- [Google Play RTDN 참조](https://developer.android.com/google/play/billing/rtdn-reference)
- [Google Play Voided Purchases API 설명](https://developer.android.com/google/play/developer-api#voided-purchases)
- [Google Play `orders.refund` API](https://developers.google.com/android-publisher/api-ref/rest/v3/orders/refund)
- [Pub/Sub Push 구독 만들기](https://docs.cloud.google.com/pubsub/docs/create-push-subscription)
- [Pub/Sub Push 인증](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions)
- [Google Cloud 도메인 제한 공유](https://docs.cloud.google.com/organization-policy/domain-restricted-sharing)
