# 크레딧·AI 원가·보안·마진 종합 점검

- 작성일: 2026-08-09
- 범위: 현재 워크트리의 크레딧/에너지/AI 호출 구현, 상품 초안, 결제 전 보안 경계
- 결론 성격: 출시 전 의사결정용 리뷰. 실제 사용자 토큰 분포가 아직 기록되지 않으므로 손익 확정본이 아니다.

## 구현 업데이트 — 2026-08-09

이 보고서의 finding을 기준으로 1차 방어 작업을 반영했다. 아래 상태는 코드와 자동화 테스트 기준이며, 운영 PostgreSQL migration·실제 Gemini 호출·모바일 런타임 검증은 아직 별도다.

| finding | 상태 | 반영 내용 |
| --- | --- | --- |
| 공개 0C 내부 flow | 완료 | `internal`, `internal_pro`, 기존 분석 alias를 공개 schema에서 거부하고, 공개 보조 기능을 flow별 일일 상한으로 분리했다. 캐릭터 분석 system instruction은 서버가 고정한다. |
| 실제 AI 원가 hard limit | 코드 완료 | flow별 최대 provider 원가를 사전 예약하고 `usageMetadata`의 입력·출력·thinking·total token과 실제 USD 원가로 정산한다. 호출별 값도 `credit_usages`에 저장한다. |
| 재시도 증폭 | 완료 | logical request 전체 provider 호출을 최대 2회로 제한하고 429·400·401·403은 재시도하지 않는다. empty fallback도 같은 예산을 공유한다. |
| thinking/output 상한 | 완료 | 모델·입력 문자·출력 token·thinking budget·일일 횟수를 서버 flow 정책이 소유하며 클라이언트 model 값은 사용하지 않는다. |
| 이미지 우회 | 부분 완료 | inline 이미지는 4개, 허용 MIME, base64, decoded bytes, 파일 signature를 재검증하고 임의 외부 URL은 거부한다. pixel dimension 검증과 reverse-proxy body limit 확인은 남았다. |
| idempotency/reserved 고착 | 부분 완료 | 클라이언트 액션 key를 필수화했고 committed 결과 replay, 진행 중 409 구분, 피드 최종 응답 replay, 10분 경과 reservation의 lazy 환급을 구현했다. background watchdog과 실제 crash fault injection은 남았다. |
| 무료 Pro 원가 | 완료 | Pro 대화와 Pro 서사형은 에너지와 무료 bonus를 사용할 수 없고 구매 크레딧만 허용한다. |
| 무료·유료 일일 한도 충돌 | 완료 | 무료 요청은 일 50회, 구매 크레딧 전용 요청은 일 200회 안전 한도로 분리하고 Pro/Pro 서사형은 각각 일 20회·10회 hard cap을 둔다. 전역 월 원가 한도는 공통 적용한다. |
| 자동 게시 원가 | 완료 | 사용자 크레딧은 차감하지 않되 서버 전용 0C flow로 기록하고 사용자당 일 24회, 최소 1시간 주기로 제한한다. |
| 오류 상세 노출 | 완료 | provider body와 내부 예외 문자열 대신 안정된 외부 오류 코드와 일반화된 문구를 반환한다. |
| 초기 무료 보상 | 완료 | 가입·첫 캐릭터·첫 DM을 각 50C, 총 150C로 축소했다. 기존 지급분은 소급 차감하지 않는다. |
| 재설정·누적 기준 | 완료 | 에너지는 자정 초기화 없이 100%에서 사용 후 6시간마다 회복하고 최대치 이후 초과 시간을 이월하지 않는다. 100% 미만의 추가 사용은 진행 중인 주기를 초기화하지 않는다. AI 일·월 사용량은 한국시간 자정에 재설정하며, bonus·구매 크레딧은 현재 만료 없이 누적한다. |

결제는 계속 비활성 상태다. 코드 검증은 backend 248개·frontend domain 135개 테스트, TypeScript typecheck, production build, migration offline SQL까지 통과했다. 가격 확정 전 실제 migration 적용, shadow billing p50/p95/p99, PostgreSQL 동시성, provider billing/rate-limit 세분화가 필요하다.

아래 본문 1~9장은 최초 점검 당시의 위험과 계산 근거를 보존한 내용이다. 현재 코드 상태는 위 구현 업데이트 표를 함께 기준으로 판단한다.

## 1. 결론

현재 크레딧 지갑, 무료 에너지, 예약·확정·환급 원장, 서버 flow별 모델·가격 정책은 1차 구조가 만들어졌다. 그러나 **지금 상태로 실제 결제와 크레딧 판매를 열면 안 된다.**

가장 큰 이유는 다음 네 가지다.

1. 인증 사용자가 공개 `/api/ai/generate`에 `internal`, `internal_pro`, `character-analysis-v2`를 직접 보내면 0C로 Flash/Pro를 호출할 수 있다.
2. Gemini 2.5의 동적 thinking 토큰과 실제 입·출력 토큰을 기록하지 않아, 월 $60 보호장치가 실제 비용을 막는 hard limit가 아니다.
3. 한 사용자 요청이 일반적으로 최대 6회, 캐릭터 분석 경로는 최대 9회의 provider 호출로 증폭될 수 있다.
4. 현재 Pro 5C·Pro 서사형 7C는 보수적 플랫폼 정산과 일반적인 토큰 시나리오에서 마진이 얇거나 음수다.

따라서 출시 순서는 **무료 flow 우회 차단 → 실제 토큰/원가 계측 → 재시도 예산 제한 → flow별 token/thinking 상한 → shadow billing → 가격 확정 → 영수증 검증 결제**가 적절하다.

## 2. 계산 기준

### 2.1 AI 단가

현재 서버 기본 모델은 `gemini-2.5-flash`, `gemini-2.5-pro`다.

Google 공식 Standard 유료 단가는 다음과 같다.

| 모델 | 입력 1M tokens | 출력 1M tokens | 비고 |
| --- | ---: | ---: | --- |
| Gemini 2.5 Flash | $0.30 | $2.50 | 이미지·비디오 입력도 $0.30 |
| Gemini 2.5 Pro | $1.25 | $10.00 | 입력 200K 이하 기준 |

출력 가격에는 thinking tokens가 포함된다. 2.5 Flash와 Pro는 설정을 생략하면 dynamic thinking이 기본이며, Flash는 `thinkingBudget=0`으로 끌 수 있지만 Pro는 완전히 끌 수 없다.

참고:

- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking)
- [Gemini media resolution](https://ai.google.dev/gemini-api/docs/generate-content/media-resolution)

### 2.2 결제 수수료

- Apple Small Business Program 적용 시 유료 앱과 IAP 수수료는 15%다. 자격 상실 시 표준 수수료 시나리오를 별도로 잡아야 한다.
- 한국 Google Play는 2026-08-09 현재 15% service fee tier 가입 시 연간 첫 $1M에 15%, 초과분에 30% 구조를 기준으로 볼 수 있다. Google이 발표한 새 한국 수수료 구조의 시행 예정일은 2026-12-31이므로 출시 직전 다시 확인해야 한다.
- Apps in Toss IAP는 현재 앱마켓 수수료 15%에 Toss 수수료 5%와 Toss 수수료 VAT가 추가된다. 공식 정산 예시의 실수령 비율은 Apple 약 79.5%, Google 약 80.9%다.

참고:

- [Apple App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en-CA)
- [Apps in Toss IAP 정산](https://developers-apps-in-toss.toss.im/settlement/intro.html)

### 2.3 본 보고서의 손익 가정

- 환율은 현재 환율을 단정하지 않고 계획값 `1 USD = 1,400원`을 사용한다.
- `AI 기여마진 = (플랫폼 수수료 후 배분 매출 - Gemini 직접 원가) / 플랫폼 수수료 후 배분 매출`이다.
- 서버, DB, S3, CDN, CS, 환불·부정결제, 법인세와 일반 운영비는 제외한다.
- 일반 시나리오의 output tokens는 화면에 보이는 답변뿐 아니라 **청구되는 thinking tokens를 포함한 계획값**이다.
- 실제 `usageMetadata`가 저장되지 않으므로 아래 마진은 확정 실적이 아니다.

## 3. 상품별 실수령 크레딧 단가

첫 구매 10% 보너스까지 적용하면 사용자가 받는 크레딧이 늘어나는 만큼 크레딧당 실수령액은 낮아진다.

| 상품 | 정가 지급 | 첫 구매 지급 | 앱마켓 15% 적용 첫 구매 순매출/C | 앱마켓 30% 적용 첫 구매 순매출/C |
| --- | ---: | ---: | ---: | ---: |
| 5,000원 | 500C | 550C | 7.73원 | 6.36원 |
| 10,000원 | 1,000C | 1,100C | 7.73원 | 6.36원 |
| 30,000원 | 3,150C | 3,465C | 7.36원 | 6.06원 |
| 50,000원 | 5,500C | 6,050C | 7.02원 | 5.79원 |
| 100,000원 | 11,500C | 12,650C | 6.72원 | 5.53원 |

Apps in Toss의 30,000원 첫 구매 상품은 공식 정산 예시 비율을 적용하면 약 `6.88~7.00원/C`다.

핵심 해석:

- `1C ≈ 10원`은 표시 가격 기준이고, 실제 첫 구매·플랫폼 수수료 후에는 약 `5.5~7.7원/C`까지 내려간다.
- 큰 상품일수록 product bonus와 첫 구매 bonus가 겹쳐 단위 수익이 낮아진다.
- 마진 판단은 10원/C가 아니라 판매 채널별 **실수령 원/C**를 사용해야 한다.

## 4. flow별 AI 기여마진

기준은 메인 상품인 `30,000원 / 첫 구매 3,465C / 앱마켓 수수료 15%`, 즉 `7.36원/C`다.

`정책 상한`은 현재 문자 상한을 토큰과 같다고 가정한 계획 proxy다. 한국어 tokenization과 thinking에 따라 실제 값은 달라질 수 있으므로 provider token count로 교체해야 한다. 이미지 이해에는 Gemini 2.5 기본 이미지 처리 상한 proxy 2,304 tokens를 더했다.

| flow | 가격 | 일반 계획 in/out | 배분 매출 | 일반 AI 원가 | 일반 마진 | 정책 상한 AI 원가 | 상한 마진 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 기본 DM | 1C | 2,000 / 300 | 7.36원 | 1.89원 | 74% | 12.21원 | -66% |
| 문맥 DM | 2C | 6,000 / 500 | 14.72원 | 4.27원 | 71% | 17.25원 | -17% |
| 장문 Flash DM | 3C | 12,000 / 1,000 | 22.08원 | 8.54원 | 61% | 27.55원 | -25% |
| Pro DM | 5C | 8,000 / 700 | 36.80원 | 23.80원 | 35% | 70.67원 | -92% |
| Pro 서사 DM | 7C | 20,000 / 1,600 | 51.52원 | 57.40원 | -11% | 144.84원 | -181% |
| 피드 생성 | 3C | 4,000 / 500 | 22.08원 | 3.43원 | 84% | 12.60원 | 43% |
| 이미지 이해 | 5C | 6,304 / 500 | 36.80원 | 4.40원 | 88% | 16.54원 | 55% |
| 캐릭터 상호작용 | 5C | 12,000 / 1,000 | 36.80원 | 8.54원 | 77% | 19.77원 | 46% |

### 판단

- Flash 1~5C 가격은 일반 사용에서는 가능성이 있지만, 현재 입력·출력 상한을 그대로 허용하면 기본/문맥/장문 DM도 적자가 날 수 있다.
- Pro 5C는 일반 시나리오에서도 AI 원가만 제외한 마진이 35%라 다른 운영비를 흡수하기 어렵다.
- Pro 서사형 7C는 일반 시나리오부터 음수다.
- Apps in Toss나 30% 수수료, 첫 구매·대형 상품 비중이 커질수록 표보다 악화된다.
- 동적 thinking이 실제로 많이 발생하면 일반 시나리오도 더 낮아진다.

## 5. 무료 에너지와 보너스의 실제 비용

무료 에너지와 bonus credits는 현금 매출이 없으므로 마진이 아니라 **획득·리텐션 비용**으로 봐야 한다.

### 5.1 하루 100% 에너지 비용

현재는 모든 외부 flow에 에너지를 사용할 수 있다. 일반 계획 원가 기준 100%로 하루에 가능한 횟수와 서비스 부담은 다음과 같다.

| flow | 회당 에너지 | 하루 가능 횟수 | 일반 AI 비용/활성 사용자·일 |
| --- | ---: | ---: | ---: |
| 기본 DM | 8% | 12회 | 약 23원 |
| 문맥 DM | 15% | 6회 | 약 26원 |
| 장문 Flash DM | 20% | 5회 | 약 43원 |
| Pro DM | 25% | 4회 | 약 95원 |
| Pro 서사 DM | 30% | 3회 | 약 172원 |
| 피드 생성 | 20% | 5회 | 약 17원 |
| 이미지 이해 | 30% | 3회 | 약 13원 |
| 캐릭터 상호작용 | 25% | 4회 | 약 34원 |

Pro 서사형을 정책 상한으로 3회 사용하면 약 435원/활성 사용자·일까지 커진다. 따라서 무료 에너지는 초기에는 Flash 기본 대화 중심으로 제한하고, Pro는 구매 크레딧 전용으로 두는 편이 안전하다.

### 5.2 가입 500C 비용 — 최초 점검 기준

최초 점검 당시 지급은 가입 300C + 첫 캐릭터 100C + 첫 DM 100C였다. 현재 정책은 상단 구현 업데이트처럼 각 50C, 총 150C이며 무료 보너스로 Pro 기능을 사용할 수 없다.

- 500C를 일반 기본 DM으로 쓰면 약 945원의 AI 비용이다.
- 500C를 일반 Pro 서사형으로 쓰면 약 4,075원의 AI 비용이다.
- 정책 상한 Pro 서사형으로 모두 쓰면 약 10,284원의 이론상 비용이다.

현재 bonus credits도 Pro에 사용할 수 있고, bonus를 purchased보다 먼저 쓴다. 무료 보너스의 Pro 사용 제한, 만료, 신규 계정 악용 예산이 없으면 가입 보상이 예상보다 큰 현금 비용이 된다.

## 6. 보안·정합성 findings

### P0 — 결제/공개 베타 전에 차단

#### P0-1. 공개 API에서 0C 내부 flow를 선택할 수 있음

- `GenerateRequest`는 등록된 flow면 모두 허용한다.
- 공개 인증 endpoint가 payload의 flow를 그대로 `CreditRepository.reserve()`와 모델 선택에 전달한다.
- catalog에서 감췄을 뿐 `internal`, `internal_pro`, `character-analysis-v2`는 서버 정책상 0C다.

영향:

- 변조 클라이언트가 임의 system/messages를 Pro에 보내고 크레딧 없이 결과를 받을 수 있다.
- 사용자별 50회 제한은 있지만 다중 계정과 실제 비용 오차 때문에 충분한 보호가 아니다.

조치:

- 공개 schema에서 내부 flow와 alias를 거부한다.
- 가능하면 범용 generate endpoint에서 클라이언트가 flow를 고르는 구조를 없애고, `DM 답장`, `피드 생성`, `캐릭터 분석` 같은 서버 기능 endpoint가 flow를 결정한다.
- 내부 자동화는 공개 endpoint를 재사용하지 말고 서버 내부 service method로 호출한다.

#### P0-2. 월 $60 한도가 실제 비용 hard limit가 아님

- 모든 logical request를 모델·토큰·재시도와 무관하게 `$0.003`으로 기록한다.
- provider의 `usageMetadata`를 저장하지 않는다.
- Gemini 2.5 dynamic thinking 비용도 반영하지 않는다.

예를 들어 Pro 서사 정책 상한 1회는 약 `$0.10346`으로 고정 추정의 약 34배다. 캐릭터 분석 최악 호출 경로는 Pro 6회 + Flash 3회로 이론상 약 `$0.69648`, 고정 추정의 약 232배다. 일부 실패 응답은 실제 청구가 더 낮을 수 있으나, 현재 시스템은 그 차이를 알 방법이 없다.

조치:

- 응답의 prompt/candidate/thought/total token count, model, attempt, status를 호출별 저장한다.
- flow별 사전 최대 원가를 원화 또는 USD budget로 reserve하고 실제 usage로 settle한다.
- 공급자 billing budget/alert와 앱 내부 hard stop을 함께 둔다.

### P1 — 과금 출시 전에 해결

#### P1-1. 재시도 비용 증폭

- 429·500·503·504를 모두 최대 3회 재시도한다.
- 200 empty response면 다시 최대 3회 호출한다.
- `character-analysis-v2`는 Pro 결과가 계속 비면 Flash fallback을 최대 3회 더 호출한다.

| 상황 | 사용자 차감 | 최대 provider 호출 |
| --- | ---: | ---: |
| 정상 | 1회 | 1회 |
| 일시 장애 | 1회 또는 최종 환급 | 3회 |
| empty 후 재생성 | 1회 또는 최종 환급 | 6회 |
| 캐릭터 분석 Pro→Flash | 0C | 9회 |

조치:

- billing/quota exhausted, 인증 실패, invalid request는 재시도하지 않는다.
- 전체 logical request의 provider attempt budget를 기본 2회로 제한한다.
- empty retry와 model fallback도 같은 attempt/cost budget를 공유한다.
- retry로 생긴 provider 비용과 사용자 차감 1회를 분리해 기록한다.

#### P1-2. 입력 상한이 token이 아닌 문자 수

- system/messages 텍스트는 문자 수만 센다.
- 실제 비용은 tokenizer, 언어, JSON 구조, thinking에 따라 달라진다.
- 이미지 입력은 문자 상한에서 0자로 처리된다.

조치:

- 실제 호출 전 `countTokens` 또는 보수적 tokenizer estimate를 사용한다.
- 성공 응답 `usageMetadata`와 비교해 estimate 오차를 보정한다.
- flow별 `max_input_tokens`, `max_billed_output_tokens`, `thinking_budget`, `max_images`를 둔다.

#### P1-3. 직접 data URL이 자산 보안 경계를 우회

- `asset:` URL만 소유권과 thread 접근권한을 확인한다.
- 클라이언트가 보낸 `data:*;base64,...`는 그대로 통과한다.
- AI service는 MIME·bytes·이미지 수를 검증하지 않고 inlineData로 전달한다.

영향:

- media upload의 10MB·pixel·ready/access 검사를 우회할 수 있다.
- 큰 request body로 메모리/네트워크 DoS가 가능하다.

조치:

- 공개 API에서는 직접 data URL을 금지하고 검증된 `asset:`만 허용한다.
- endpoint/proxy body limit, 이미지 수, decoded bytes, MIME allowlist, pixel limit를 재검증한다.

#### P1-4. reserved 상태 고착과 결과 유실

- 크레딧 reserve commit 후 usage limit reserve, provider 호출, 최종 commit/refund가 별도 transaction이다.
- 프로세스 종료가 중간에 발생하면 `reserved`가 남을 수 있다.
- 오래된 reserved usage를 탐지·환급·재조정하는 job이 없다.
- 클라이언트 transport가 key를 임의 생성하던 구조는 제거하고 각 사용자 액션이 key를 명시하도록 변경했다.
- 동일 key의 committed 결과는 replay하고, 처리 중인 key는 `REQUEST_IN_PROGRESS` 409로 구분한다.
- 피드 생성 replay는 provider 원문이 아니라 저장 완료된 최종 post/state를 반환해 게시글을 다시 추가하지 않는다.

조치:

- 수동 피드와 일반 AI 호출은 한 액션 동안 동일 idempotency key를 유지한다.
- 자동 피드는 예약 시각 기반의 결정적 key로 replica 재처리에도 같은 요청으로 식별한다.
- `reserved_at`, `expires_at`, `provider_request_id`, reconciliation 상태를 저장하고 watchdog을 둔다.

#### P1-5. 결제 원장과 환불/chargeback 처리가 없음

현재 `CreditPurchase`, transaction ID unique, 영수증 서버 검증, pending/verified/granted/refunded/revoked 상태, 복원과 chargeback 회수가 없다. 상품 API의 `payment_available=false`와 disabled 버튼 때문에 지금 당장 결제 사고는 없지만, 결제를 켜기 전 필수다.

필수 조건:

- 클라이언트 결제 성공 문자열을 신뢰하지 않고 Apple/Google/Toss 서버 상태를 검증한다.
- provider transaction/purchase token을 전역 unique로 저장한다.
- `PENDING`에는 지급하지 않고 `PURCHASED/verified`에만 지급한다.
- 지급과 acknowledge/consume/complete grant를 idempotent하게 처리한다.
- server notification/RTDN/Apps in Toss order status로 환불·취소·누락 이벤트를 재조정한다.
- 잔액이 부족한 환불은 음수 부채 잔액, 기능 제한, 운영 검토 중 하나로 정책화한다.

공식 참고:

- [Apple App Store Server API](https://developer.apple.com/documentation/appstoreserverapi/)
- [Apple App Store Server Notifications](https://developer.apple.com/documentation/AppStoreServerNotifications)
- [Google Play Billing security](https://developer.android.com/google/play/billing/security)
- [Apps in Toss IAP](https://developers-apps-in-toss.toss.im/iap/develop.html)

#### P1-6. 무료 보상 다중 계정 정책이 약함

- reward unique 기준은 `user_id + event_code`다.
- 동일 provider identity는 탈퇴 retention 동안 차단되지만 다른 provider/다른 계정/기기 단위 예산은 없다.
- 현재 모든 bonus가 Pro에도 사용 가능하다.

조치:

- identity cluster, provider, device-risk, IP velocity는 개인정보·오탐을 고려한 risk signal로만 사용한다.
- 일일 신규계정 AI 비용 상한과 signup grant 총예산을 둔다.
- bonus와 purchased의 사용 가능 flow를 분리하거나 Pro를 purchased-only로 둔다.
- `first_dm` grant가 현재 `image_understanding` 성공에도 지급되는 정책을 명시적으로 결정한다.

### P2 — 운영 안정화 단계

- provider 4xx/5xx body와 예외 문자열을 그대로 사용자 응답에 넣을 수 있어 내부 정보가 노출될 수 있다. 외부에는 안정된 error code만, 상세는 민감정보 제거 후 운영 로그에만 남긴다.
- `CreditUsage`에 실제 token/cost/retry/correlation이 없어 고객 문의와 손익 대사가 어렵다.
- ledger의 append-only 성질은 애플리케이션 관례이며 DB에서 update/delete를 막지 않는다.
- usage status, entry type, balance type이 DB enum/check로 제한되지 않는다.
- `CreditAccount.version`은 현재 사용되지 않는다.
- 동시 차감 테스트는 stub unit test이며 실제 PostgreSQL transaction/row-lock race를 검증하지 않는다.
- 회원 영구 삭제 시 credit ledger와 reward grant도 cascade 삭제된다. 구매 기록의 법적·회계 보존과 재가입 보상 정책을 분리해야 한다.

## 7. 상황별 기대 처리

| 상황 | 사용자 잔액 | provider 비용 | 필요한 서버 처리 |
| --- | --- | --- | --- |
| 정상 생성·저장 성공 | 1회 확정 | 1회 | usage/ledger committed |
| provider 4xx 입력 오류 | 전액 환급 | 보통 낮음 | 재시도 금지, stable error |
| billing/quota 429 | 전액 환급 | 미상 | billing/rate-limit 구분, billing은 재시도 금지 |
| 500/503/504/timeout | 최종 실패 시 환급 | 최대 attempt 수만큼 | 전체 attempt budget 공유 |
| safety/recitation/empty | 결과 미제공이면 환급 | 200 응답 비용 발생 가능 | 원인별 retry 정책, 횟수 제한 |
| 사용자 취소 | 미완료면 환급 | 이미 호출됐으면 비용 가능 | cancel 상태와 provider completion 대사 |
| provider 성공 후 앱 저장 실패 | 환급 | 1회 발생 | 현재 feed 방식처럼 저장 완료 후 commit |
| 응답 성공 후 네트워크 유실 | 이중 차감 금지 | 이미 1회 발생 | 같은 idempotency key로 결과 replay |
| 동시 동일 요청 | 1회만 차감 | 1회만 호출 | DB unique + in-flight dedupe |
| 오래된 reserved | 자동 복구 | 이미 발생했을 수 있음 | TTL reconciliation |
| 무료 에너지 사용 | 현금 매출 0 | 서비스 부담 | flow별 일일 무료 원가 예산 |
| bonus credits 사용 | 현금 매출 0 | 획득비용 | 만료/허용 flow/계정 risk 정책 |
| 구매 pending | 지급 없음 | 없음 | verified 전 대기 |
| 구매 성공 callback 중복 | 1회만 지급 | 없음 | transaction ID unique |
| 환불·chargeback | 미사용분 회수 | 이미 AI 비용 발생 | 알림 처리, 부채/제한 정책 |
| 탈퇴 후 복구 | 기존 잔액 유지 | 없음 | grant 재지급 금지 |
| 영구 삭제 후 재가입 | 정책에 따라 | 재획득 비용 | 회계 기록과 reward identity 분리 |

## 8. 가격과 정책 권장안

### 8.1 즉시 적용할 임시 기준

- 기본 DM 1C, 문맥 DM 2C, 장문 Flash 3C는 유지하되 token/thinking 상한을 크게 낮춘다.
- 피드 3C, 이미지 이해 5C, 캐릭터 상호작용 5C는 일반 사용 기준으로 여유가 있으나 p95 실측 후 확정한다.
- Pro DM은 5C 그대로 출시하지 말고 `8~10C` shadow price를 비교한다.
- Pro 서사형은 `16~18C`를 시작점으로 비교하거나, 더 싼 모델/Flash 품질이 충분한지 AI eval을 먼저 한다.
- 무료 에너지는 Flash 기본/문맥형에 우선 사용하고 Pro는 purchased credits 전용으로 둔다.
- 가입 bonus는 Pro 사용 제한 또는 유효기간을 둔다.

30,000원 첫 구매·15% 수수료 기준 일반 시나리오에서:

- Pro 8C는 약 60% AI 기여마진이다.
- Pro 10C는 약 68%다.
- Pro 서사 16C는 약 51%다.
- Apps in Toss 보수 실수령을 쓰면 Pro 서사 16C가 약 48%이므로 17~18C 검토가 안전하다.

### 8.2 목표 마진

AI 직접원가만 뺀 기여마진을 최소 50~60%로 두어야 서버·스토리지·CS·환불·프로모션 비용을 흡수할 여지가 생긴다. 최종 가격은 평균이 아니라 다음 기준을 동시에 만족해야 한다.

- p50 원가: 제품 체감 가격과 경쟁력 확인
- p95 원가: 정상 고사용자에서도 목표 마진 유지
- p99/정책 상한: abuse와 retry 시 손실 상한 확인
- 무료 사용자 1인당 일/월 AI 비용
- 결제자 1인당 플랫폼 수수료 후 순매출
- 무료/bonus/paid credit의 실제 사용 비중

## 9. 출시 전 구현 순서

1. 공개 endpoint에서 internal flow/alias 차단
2. provider 응답 `usageMetadata` 저장 및 실제 원가 계산
3. Flash thinking budget, Pro thinking budget, token/output/image 상한을 flow 정책에 추가
4. logical request 전체 retry/cost budget와 오류 분류 적용
5. 직접 data URL 차단 및 media 재검증
6. idempotent result replay와 오래된 reserved reconciliation 구현
7. 무료 에너지·bonus의 Pro 사용 정책 확정
8. PostgreSQL 동시성·crash window·refund fault injection 테스트
9. 1~2주 shadow billing으로 p50/p95/p99 원가 수집
10. 가격 재산정 후 Apple/Google/Apps in Toss 중 1차 채널의 purchase ledger·영수증 검증 구현
11. sandbox의 pending/중복 callback/복원/환불/chargeback E2E 통과 후 실제 결제 활성화

## 10. 출시 게이트

다음 항목이 모두 확인되기 전 `payment_available=true`로 바꾸지 않는다.

- [ ] 변조된 클라이언트가 internal/0C flow를 호출할 수 없다.
- [ ] 모든 provider attempt에 실제 input/output/thought tokens와 원가가 남는다.
- [ ] 전체 retry가 하나의 attempt/cost budget를 공유한다.
- [ ] 월 비용 한도가 실제 원가 기준 hard stop으로 동작한다.
- [ ] 무료 에너지와 bonus의 허용 flow 및 월 예산이 정해졌다.
- [ ] 오래된 reserved가 자동 대사된다.
- [ ] 동일 사용자 액션 재전송이 이중 차감되지 않고 결과를 복구한다.
- [ ] transaction ID/purchase token 중복 지급이 불가능하다.
- [ ] pending, refund, revoke, chargeback, restore가 서버 상태와 원장에 반영된다.
- [ ] 실제 PostgreSQL 동시성 테스트와 플랫폼 sandbox E2E가 통과한다.
- [ ] p95 기준 목표 AI 기여마진이 50% 이상이다.

## 11. 최종 판단

현재 1차 구현은 UI와 크레딧 상태 모델을 검증하기 위한 기반으로는 유효하다. 그러나 현재 매출은 0원이고 모든 AI 사용은 서비스 비용이며, 공개 0C flow와 실제 원가 미계측 때문에 비용 상한도 신뢰할 수 없다.

가장 먼저 해야 할 일은 가격표 수정이 아니라 **서버 authority와 실제 token cost를 잠그는 것**이다. 그 다음 shadow billing 데이터로 Flash 가격을 유지할지, Pro를 8~10C와 16~18C로 올릴지 결정하는 것이 안전하다.
