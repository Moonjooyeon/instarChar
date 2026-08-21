---
title: Android Google Play 크레딧 결제 내부 테스트 가이드
author: black (black@ashwoodfriends.com)
created: 2026-08-21
updated: 2026-08-21
version: 1.0.0
status: active
---

# Android Google Play 크레딧 결제 내부 테스트 가이드

## 목적과 범위

이 가이드는 독립 Android 앱 `com.ashwoodfriends.alive`의 소비성 일회성 크레딧 결제를 Play Console 내부 테스트에서 검증하는 절차다. Apps in Toss 결제와 iOS StoreKit은 이 절차의 대상이 아니며, 두 런타임의 결제 설정을 바꾸지 않는다.

관련 구현·롤백 원칙은 [구현 계획](../plans/plan_google-play-consumable-iap_2026-08-21.md)을 따른다.

## 1. 배포 전 상태

다음 값으로 서버와 DB 마이그레이션을 먼저 배포한다. Google Cloud 서비스 계정이나 상품이 아직 준비되지 않아도 이 상태에서는 서버가 기동한다.

```dotenv
GOOGLE_PLAY_IAP_ENABLED=false
GOOGLE_PLAY_IAP_PURCHASE_ENABLED=false
GOOGLE_PLAY_RTDN_ENABLED=false
```

- Alembic head는 `20260821_0032`여야 한다.
- Apps in Toss의 `TOSS_IAP_*` 값, 토스 mTLS 파일, 토스 재조정 스케줄러는 변경하지 않는다.
- 배포 뒤 앱인토스 로그인, 기존 상품 조회, 결제 시작, 구매 복구를 운영 계정으로 확인한다.

## 2. Android 내부 테스트 AAB

1. Play Console에 등록된 최고 `versionCode`를 확인한다.
2. Android와 iOS의 빌드 번호를 같은 새 번호로 맞춘다. 현재 소스는 둘 다 `7`이며, 이미 7 이상을 올린 경우 더 큰 값으로 증가시킨다.
3. 안전한 배포 셸에서만 Android 서명 값을 주입한다. 키 파일과 암호는 저장소, `.env.example`, Play Console 메모에 넣지 않는다.

```bash
export ALIVE_ANDROID_KEYSTORE_PATH=/secure/path/alive-release.jks
export ALIVE_ANDROID_KEY_ALIAS=...
export ALIVE_ANDROID_KEY_PASSWORD=...
export ALIVE_ANDROID_STORE_PASSWORD=...
make android-bundle-release
```

4. 생성한 AAB를 Play Console `내부 테스트` 트랙에 업로드하고, 내부 테스터와 라이선스 테스터를 추가한다.
5. 업로드한 AAB의 패키지명과 권한을 기록한다. 이 빌드에는 `com.android.vending.BILLING` 권한이 포함되어야 한다.

## 3. Play Console 일회성 제품

모든 항목은 **소비성 일회성 제품**, 구매 옵션 **Buy**, 다중 수량 비활성으로 만든다. 제품 ID는 생성 후 변경·재사용할 수 없으므로 아래 값을 그대로 사용한다.

| 상품 ID | 지급 크레딧 | 현재 표시 가격 |
|---|---:|---:|
| `alive.credits.500` | 500C | 5,390원 |
| `alive.credits.1000` | 1,000C | 10,890원 |
| `alive.credits.3150` | 3,150C | 32,450원 |
| `alive.credits.5500` | 5,500C | 54,450원 |
| `alive.credits.11500` | 11,500C | 108,900원 |

- 상품명·설명·판매 국가·원화 가격은 승인된 상업 정책과 대조한다.
- 각 상품을 `Active`로 전환하기 전에 AAB가 내부 테스트에서 설치 가능한지 확인한다.
- 콘솔 상품 ID와 실제 지역화 표시 가격은 기기에서 한 번 더 대조한다. 앱의 기본 가격은 보조 문구이고, 결제 화면 가격은 Play Billing이 반환한 값을 우선 사용한다.

## 4. Google Play Developer API와 RTDN

1. Google Cloud 프로젝트에서 Android Publisher API를 사용할 서비스 계정을 만든다.
2. Play Console 사용자·권한에서 이 서비스 계정에 주문·인앱 상품 구매 조회와 소비에 필요한 권한을 부여한다.
3. 서비스 계정 JSON을 서버 시크릿 저장소에만 마운트한다.
4. Pub/Sub 토픽을 Play Console RTDN에 연결하고, **일회성 제품 이벤트 수신**을 선택한다.
5. Pub/Sub push subscription의 대상은 공개 HTTPS API `POST /api/credits/purchases/google-play/rtdn`으로 설정한다. OIDC 인증을 켜고 전용 push 서비스 계정을 선택한다.
6. push subscription에 설정한 audience와 서비스 계정 이메일을 서버 환경 변수에 정확히 넣는다.

```dotenv
GOOGLE_PLAY_IAP_PACKAGE_NAME=com.ashwoodfriends.alive
GOOGLE_PLAY_IAP_SERVICE_ACCOUNT_JSON_PATH=/run/secrets/google-play/service-account.json
GOOGLE_PLAY_IAP_SUBJECT_HMAC_KEY=<32바이트 이상, AUTH_SECRET_KEY와 다른 값>
GOOGLE_PLAY_RTDN_AUDIENCE=<Pub/Sub push subscription의 OIDC audience>
GOOGLE_PLAY_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL=<push-service-account>@<project>.iam.gserviceaccount.com
```

`GOOGLE_PLAY_RTDN_AUDIENCE`는 서버 URL과 같아야 할 필요는 없지만, Pub/Sub가 발급하는 OIDC 토큰의 `aud` 값과 정확히 같아야 한다. 서비스 계정 JSON의 주체와 Pub/Sub push 서비스 계정은 역할이 달라도 된다.

## 5. 기능 플래그 롤아웃

다음 순서를 건너뛰지 않는다.

1. 통합과 RTDN만 켜고 신규 구매는 닫는다.

```dotenv
GOOGLE_PLAY_IAP_ENABLED=true
GOOGLE_PLAY_IAP_PURCHASE_ENABLED=false
GOOGLE_PLAY_IAP_PURCHASE_ROLLOUT_PERCENT=0
GOOGLE_PLAY_RTDN_ENABLED=true
```

2. Play Console의 RTDN 테스트 알림이 서버에서 HTTP 204로 끝나는지 확인한다.
3. 내부 테스터 한 명에게만 안정적으로 열리도록 구매 플래그를 켜고 rollout을 1 이상으로 올린다. 표본이 작은 내부 테스트에서는 100으로 두되, 대상 환경은 내부 테스트 서버로 제한한다.
4. 정상 구매, 결제 취소, 대기 결제 승인·취소, 앱 강제 종료 뒤 복구, 동일 토큰 재전송, 동일 상품 재구매, 환불·무효 구매를 모두 확인한다.
5. 내부 테스트 증거가 남은 뒤에만 폐쇄 테스트와 프로덕션 롤아웃을 논의한다.

## 6. 확인 기준

- 결제 시작 전 Android 앱이 다섯 상품의 Play 표시 가격을 조회한다.
- 성공한 토큰만 서버가 검증해 한 번 지급한다.
- 지급 성공 뒤 서버가 소비 처리하고 같은 상품을 다시 구매할 수 있다.
- `PENDING`·취소는 지급하지 않는다.
- RTDN 중복은 원장과 잔액을 한 번만 바꾼다.
- 무효 구매는 기존 지급분을 차감하거나 부채로 정산한다.
- Apps in Toss와 iOS에서 Google Play 버튼이나 Google 결제 오류가 노출되지 않는다.

## 7. 즉시 롤백

Google 결제 이상이 있으면 아래 세 값만 `false`로 되돌린다. 이 조치는 토스 로그인·토스 결제·iOS 결제 경로에 영향을 주지 않는다.

```dotenv
GOOGLE_PLAY_IAP_ENABLED=false
GOOGLE_PLAY_IAP_PURCHASE_ENABLED=false
GOOGLE_PLAY_RTDN_ENABLED=false
```

이미 지급된 거래는 삭제하지 않는다. `credit_purchases`와 원장 기록을 기준으로 재조정하고, 환불·무효 구매 알림은 기능을 다시 열기 전에 처리한다.

## 참고

- [Google Play 일회성 구매 수명주기](https://developer.android.com/google/play/billing/lifecycle/one-time)
- [Google Play Billing 앱 통합](https://developer.android.com/google/play/billing/integrate)
- [RTDN 참조](https://developer.android.com/google/play/billing/rtdn-reference)
