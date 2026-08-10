---
title: ALIVE 크레딧·AI·운영 출시 준비 계획
author: black (black@ashwoodfriends.com)
created: 2026-08-09
updated: 2026-08-10
version: 1.1.0
status: in-progress
---

# ALIVE 크레딧·AI·운영 출시 준비 계획

## 0. 구현 현황 — 2026-08-09

1차 구현과 보안 보강으로 다음 항목이 코드에 반영됐다.

- 서버 소유 flow catalog, 정책 version, 입력·출력·thinking·일일 호출 상한
- 구매/무료 bonus 분리 잔액, 100%에서 사용 후 6시간마다 25% 회복하는 최대 100% 무료 에너지
- 가입·첫 캐릭터·첫 DM 각 50C(총 150C), 지급 이벤트별 1회 보장
- 에너지 최대치 도달 후 초과 회복 시간 미누적, AI 일·월 사용량은 한국시간 자정 기준 재설정
- 베타 기간 bonus·구매 크레딧은 만료 없이 누적하고 기존 지급분은 소급 차감하지 않음
- 예약·확정·환급 usage와 원장, reward 중복 방지, 10분 stale reservation lazy 환급
- 클라이언트 액션 key 필수화, committed 결과 replay, 진행 중 요청 구분, 수동·자동 피드 중복 저장 방지
- 사용 원천 합계·상태·원가 필드에 대한 PostgreSQL check constraint migration
- 공개 내부 flow 차단, Pro 구매 크레딧 전용, OpenRouter 실제 token/원가 정산, provider 최대 2회 호출
- 무료 요청 일 50회·구매 전용 요청 일 200회 안전 한도와 Pro/Pro 서사형 일 20회·10회 hard cap
- 자동 게시는 서버 전용 0C flow로 사용자당 일 24회, 최소 1시간 주기 적용
- 크레딧 센터의 잔액·에너지·기능별 비용·최근 사용 UI와 DM/피드 사용 직전 안내
- 상품 catalog 노출과 결제 비활성 상태 유지
- OpenRouter 최소비용 실측 후 초기 베타 대화 가격 1C·2C·2C·5C·7C 확정

현재 자동 검증은 backend 256개, frontend domain 137개, TypeScript typecheck, Vite production build를 통과했다. OpenRouter 최소비용 대표 fixture도 통과했다. 실행 중인 ALIVE 프로세스가 없어 브라우저 E2E와 실제 PostgreSQL 검증은 수행하지 않았다.

다음 출시 차단 항목은 아직 남아 있다.

- 운영 PostgreSQL migration 및 row-lock/crash fault injection 검증
- OpenRouter 경유 Gemini Flash/Pro 호출과 실제 `usage.cost` p50/p95/p99 수집
- 결제 provider 결정, 구매 원장, 영수증 검증, 복원·환불·chargeback 처리
- 프로세스 중단을 주기적으로 복구하는 background reconciliation watchdog
- 이미지 pixel 검증, reverse-proxy body limit, 운영 secret·metric·alert 점검
- 실제 사용자 shadow billing으로 flow별 p95·p99 원가를 수집하고 베타 가격 재검토

## 1. 목적

기존 크레딧 BM 문서를 실제 개발·배포 가능한 계획으로 연결한다. 크레딧 잔액과 결제만 구현하는 것이 아니라, AI 호출 원가·실패 환급·무료 에너지·가입 보너스·회원탈퇴·운영 모니터링을 하나의 서버 정책으로 관리한다.

이 문서의 완료 기준은 다음과 같다.

- 사용자가 어떤 기능을 사용하고 얼마가 차감되는지 예측할 수 있다.
- 클라이언트가 비용이나 모델을 조작해 무료 사용을 우회할 수 없다.
- AI 공급자 장애가 사용자 크레딧 손실로 이어지지 않는다.
- 탈퇴·재가입·보너스·환불을 포함해 잔액 변화가 원장으로 설명된다.
- Lightsail 운영 환경에서 장애 원인을 확인하고 재처리할 수 있다.

## 2. 기준 문서와 현재 상태

### 2.1 기존 BM 정책

[크레딧 BM 및 AI 사용량 통합안](../../../reports/product/bm/report_credit-pricing-analysis_2026-08-06.md)을 기준 정책 초안으로 사용한다.

현재 정책 초안은 다음과 같다.

| 항목 | 현재 초안 |
| --- | --- |
| BM | 시간 회복형 데일리 에너지 + 유료 크레딧 |
| 에너지 | 100%에서 사용 후 6시간마다 최대치의 25% 회복, 최대 100%, 자정 초기화 없음 |
| 가입 보너스 | 가입 50C + 첫 캐릭터 50C + 첫 DM 50C |
| 상품 기준 | 5,000원 500C, 10,000원 1,000C, 30,000원 3,150C, 50,000원 5,500C, 100,000원 11,500C |
| 첫 결제 | 기존 상품 보너스에 최초 1회 추가 10% 검토 |
| 기본 대화 | 1C |
| 문맥형 대화 | 2C |
| 긴 기억·관계형 | 2C |
| Pro 고품질 | 5C |
| Pro 서사형 | 7C |
| 피드 생성 | 3C 후보 |
| 이미지 이해 | 5C 후보 |

첫 결제 2배는 사용하지 않는다. 일반 상품 보너스와의 격차가 크므로 초기 정책은 추가 10%를 기준으로 검토한다.

### 2.2 코드상 확인된 현재 상태

- 크레딧 화면은 `balance: null`, 가격 미정, disabled 결제 버튼을 사용하는 목업이다.
- 실제 `CreditAccount`, `EnergyAccount`, 원장, 결제 검증, AI 차감 API는 없다.
- AI는 FastAPI가 OpenRouter를 통해 Gemini Flash/Pro를 호출하며, 공급자 실제 `usage.cost`를 원가로 기록한다.
- 내부 AI 사용량 제한은 사용자별 일일 호출 수와 전역 월간 예상 비용을 관리하며, 사용자 크레딧과 별개다.
- AI 내부 사용량은 provider 호출 전에 증가하므로 provider 실패 시 사용량 정산 정책이 필요하다.
- 프론트의 모델 상수는 과거 Claude 이름을 사용하지만 백엔드는 서버 소유 flow를 OpenRouter의 Gemini Flash/Pro 모델 ID에 매핑한다.
- 자동 게시글·자동 댓글·자동 DM 등 사용자 입력 이후 연쇄적으로 실행되는 AI 호출이 있다.
- 회원탈퇴는 7일 유예형이며 동일 provider identity 재가입 차단 기반이 구현되어 있다. `RewardGrant`와 지갑 원장은 아직 없다.
- Playwright E2E는 AI 호출을 route mock으로 대체하므로 실제 OpenRouter·결제·S3·PostgreSQL 동시성은 별도 검증이 필요하다.

## 3. 범위

### 포함

- OpenRouter provider 장애와 AI 오류 코드 정리
- AI flow catalog와 서버 소유 과금 정책
- 데일리 에너지·크레딧 잔액·원장·환급
- 가입·캐릭터·첫 DM 보너스 중복 방지
- 자동 기능의 비용 정책과 호출 예산
- 결제 상품 카탈로그와 영수증 검증 경계
- 탈퇴·재가입·환불 시 잔액 및 grant 처리
- 보안 설정·운영 로그·health check·scheduler 관측성
- 실제 Lightsail·Android·iOS·PostgreSQL·S3 검증

### 제외

- 구독제 도입
- AI provider 교체 자체
- 캐릭터 프롬프트의 전면 재작성
- 결제 플랫폼을 하나로 확정하는 작업 자체
- 운영 환경에서의 실제 잔액 충전·결제 실행

## 4. Phase 0 — 운영 장애 해소와 보호장치

크레딧 구현 전에 현재 AI가 안정적으로 호출되고, 실패 원인이 사용자와 운영자에게 구분되어야 한다.

### 작업

- [ ] Google AI Studio 프로젝트 선불 잔액 충전 후 Flash·Pro 실제 호출 확인
- [ ] provider 429를 `AI_PROVIDER_BILLING_EXHAUSTED`와 일시적 rate limit으로 구분
- [ ] 잔액 부족·인증 실패는 재시도하지 않도록 수정
- [ ] 일시적 rate limit은 `Retry-After`를 기준으로 제한적으로 재시도
- [ ] provider 500·503·504, timeout, empty response, safety block을 별도 오류 코드로 분리
- [ ] 프론트에서 운영 장애와 사용자 한도 초과를 다른 문구로 표시
- [ ] `AUTH_SECRET_KEY`가 기본값이면 운영 시작 시 실패하도록 검토
- [ ] 운영 `AUTH_COOKIE_SECURE=true`, HTTPS, CORS, DB secret 주입을 확인
- [ ] 로컬·운영 환경에 실제처럼 보이는 S3 credential이 있으면 유효 여부 확인 후 필요 시 교체

### 완료 기준

- [ ] OpenRouter 경유 정상 호출이 Flash·Pro 모두 성공한다.
- [ ] 잔액 소진 429가 일반적인 “다시 시도” 문구로 숨겨지지 않는다.
- [ ] provider 잔액 부족으로 불필요한 3회 재시도가 발생하지 않는다.
- [ ] 운영 secret 누락·기본값 상태가 배포 후에야 발견되지 않는다.

## 5. Phase 1 — BM 정책과 AI flow catalog 확정

### 5.1 과금 단위 결정

- [ ] `1회`를 캐릭터 응답 1건으로 정의할지 결정
- [ ] 사용자 입력과 캐릭터 응답을 묶은 1턴의 정의 결정
- [ ] 자동 DM 6턴을 턴별 차감할지 패키지 차감할지 결정
- [ ] 이미지가 포함된 DM의 기본·Pro 가격을 결정
- [ ] 입력 문맥 길이와 출력 토큰 상한을 등급별로 결정

초기 권장안은 `캐릭터 응답 1건 = 1회 사용`이다. 내부 호감도 판정·기억 통합은 메인 기능 비용에 포함하고 별도 차감하지 않는다.

### 5.2 서버 소유 flow

- [ ] `direct_dm_basic` 정의
- [ ] `direct_dm_context` 정의
- [ ] `direct_dm_flash_long` 정의
- [ ] `direct_dm_pro` 정의
- [ ] `direct_dm_pro_story` 정의
- [ ] `feed_post` 정의
- [ ] `image_understanding` 정의
- [ ] `character_interaction` 정의
- [ ] 각 flow에 모델, 크레딧 비용, 최대 입력, 최대 출력, 재시도 정책, 환급 정책 연결
- [ ] `credit_policy_version`과 `energy_policy_version` 정의
- [ ] 클라이언트가 보낸 `model`, `cost`, `credits`, `price`를 과금 근거로 사용하지 않도록 계약 확정

### 5.3 자동 기능 정책

- [ ] 자동 DM의 무료·유료 여부 결정
- [ ] 자동 댓글·팔로워 반응의 무료 제공 여부 결정
- [x] 자동 게시글은 사용자 크레딧 미차감 서비스 비용으로 제공하되 일 24회·최소 1시간으로 제한
- [ ] 자동 기능이 유료 크레딧을 사용할 경우 사전 동의·예산·중지 기능 추가
- [ ] 내부 분석·관계 판정·기억 통합을 사용자에게 별도 차감하지 않도록 확정

## 6. Phase 2 — 잔액·에너지·원장 구현

### 6.1 최소 데이터 모델

- [ ] `CreditAccount`: 유료 크레딧 잔액, 동시성 version
- [ ] `EnergyAccount`: 현재 에너지, 최대 에너지, 마지막 계산 시각, 다음 회복 시각
- [ ] `CreditOffer`: 상품 ID, 가격, 기본 지급량, 상품 보너스, 첫 구매 정책
- [ ] `CreditLedgerEntry`: 구매·보너스·소모·환급·조정·만료
- [ ] `CreditPurchase`: 영수증, transaction ID, 검증 상태, 지급 여부
- [ ] `CreditUsage`: flow, 모델, 예약·확정·환급 상태, 원가 추정치
- [ ] `RewardGrant`: identity/event code, 지급 상태, 중복 방지 unique key

### 6.2 잔액 정합성

- [x] AI 요청 전에 사용량을 `reserved` 상태로 기록
- [x] 성공 응답과 저장 완료 후 `committed` 상태로 전환
- [x] provider 실패·timeout·빈 응답·안전 차단 시 `refunded` 상태로 전환
- [x] 동시 요청에서 잔액이 음수가 되지 않도록 계정 row lock 적용
- [x] 모든 현재 원장 이벤트와 사용자 생성 액션에 idempotency key 적용
- [ ] 원장 합계와 계정 잔액을 점검할 수 있는 운영 명령 또는 조회 추가

### 6.3 무료 에너지

- [x] 6시간마다 25% 회복 계산
- [x] 최대치 100% 초과와 최대치 도달 후 회복 시간 이월 방지
- [x] 사용 순서 결정: 무료 회복 에너지 → 무료 grant → 구매 크레딧
- [x] 베타 기간 무료 grant 만료 없음
- [x] 에너지 소진 시 다음 회복 시각과 크레딧 사용량을 함께 반환
- [x] 앱 미접속 기간에도 서버 시각 기준으로 회복량 계산

## 7. Phase 3 — 보너스·탈퇴·재가입 악용 방지

- [x] 가입·첫 캐릭터·첫 DM 보너스를 `user_id + event_code` 기준으로 한 번만 지급
- [ ] 동일 provider 탈퇴 후 retention 기간 재가입 차단을 grant 정책과 연결
- [ ] 다른 provider로 재가입하는 경우의 보너스 정책 결정
- [ ] 탈퇴 pending 계정의 크레딧·에너지·보너스 접근 차단
- [ ] 유예기간 내 복구 시 기존 잔액과 원장 유지
- [ ] 영구 삭제 시 구매 기록·법적 보존 데이터·잔여 크레딧 처리 결정
- [ ] 환불 시 지급된 구매 크레딧과 첫 구매 보너스 회수 방식 결정
- [x] 구매 크레딧과 무료 보너스의 사용 순서 및 현재 무기한 정책을 원장에 기록

### 완료 기준

- [x] 가입 완료 API를 반복 호출해도 signup grant가 1회만 생성된다.
- [x] 첫 캐릭터·첫 DM 완료 요청을 반복해도 중복 지급되지 않는다.
- [ ] 탈퇴·재가입·복구 후 잔액이 중복 생성되지 않는다.
- [ ] 다른 provider 가입에 대한 정책이 코드와 사용자 고지에 일치한다.

## 8. Phase 4 — AI 과금 연결

- [x] `/api/ai/generate`가 서버 flow를 기준으로 가격을 계산
- [ ] 직접 DM의 현재 Pro 고정 호출을 기본 Flash·선택형 Pro flow로 분리
- [x] 피드 생성은 `feed_post` flow로 서버에서 3C 후보를 계산
- [ ] 이미지 이해는 이미지 크기·문맥·모델에 따른 상한을 적용
- [x] 재시도 횟수와 사용자 차감 횟수를 분리
- [ ] 내부 분석 호출이 메인 응답과 중복 차감되지 않도록 correlation ID 연결
- [x] AI 호출별 flow·model·입력량·출력량·retry count·provider status·원가 추정치를 기록
- [x] 사용자가 생성 전에 예상 소모량을 확인할 수 있도록 catalog API에 비용 정보 포함

## 9. Phase 5 — 결제와 프론트 UX

### 결제

- [ ] App Store·Google Play·Apps in Toss 중 1차 결제 플랫폼 결정
- [ ] 서버 카탈로그에 상품 ID와 가격·지급량 등록
- [ ] `POST /api/credits/purchases/verify` 구현
- [ ] 영수증 서버 검증
- [ ] transaction ID 중복 지급 방지
- [ ] 결제 대기·실패·취소·환불·구매 복원 처리
- [ ] 결제 완료와 원장 지급을 idempotent하게 처리

### 프론트엔드

- [ ] 목업 상품을 `GET /api/credits/catalog` 결과로 교체
- [ ] 실제 잔액을 `GET /api/credits`로 표시
- [ ] 데일리 에너지 게이지와 다음 회복 시각 표시
- [ ] 생성 전 예상 차감량 표시
- [ ] 잔액 부족·에너지 소진·provider 장애·사용자 한도 초과 문구 분리
- [ ] 구매 완료·실패·복원·환불 상태 표시
- [ ] 구매·소모·환급 내역 화면 추가
- [ ] 첫 구매 추가 10%와 보너스 지급량을 결제 전 명확히 표시

## 10. Phase 6 — 운영 관측성과 배포

- [ ] `/health`에 DB 연결 및 migration 상태 확인 추가 검토
- [ ] AI 성공률·provider 상태 코드·잔액 부족·timeout metric 추가
- [ ] scheduler 마지막 실행 시각·실패 횟수·처리 건수 metric 추가
- [ ] 계정 삭제 scheduler 실패 알림과 수동 재처리 방법 마련
- [ ] 자동 게시글 scheduler가 다중 backend replica에서 중복 실행되지 않는지 확인
- [ ] request ID를 AI·결제·원장 로그에 연결
- [ ] prompt 원문·개인정보·access token·API key를 로그에 기록하지 않도록 검토
- [ ] Lightsail 배포 후 migration 성공 여부와 backend image tag 확인
- [ ] 운영 `.env.prod`에 필요한 secret 목록과 검증 절차 문서화

## 11. Phase 7 — 검증 계획

### 단위·계약 테스트

- [x] flow별 가격·모델·최대 문맥 테스트
- [ ] 3,000·6,000·10,000자 입력 fixture 원가 계산 테스트
- [ ] 정상·빈 응답·malformed JSON·safety block fixture 테스트
- [ ] 429 billing exhausted와 일시 rate limit fixture 테스트
- [ ] 예약·확정·환급 상태 전이 테스트
- [ ] 동시 차감 및 idempotency 테스트
- [ ] grant 중복 지급 테스트

### 통합·E2E 테스트

- [ ] 실제 PostgreSQL migration과 row lock 검증
- [ ] 실제 S3 업로드·읽기·삭제 검증
- [ ] Android 재로그인 및 화면 복원
- [ ] iOS·Android OAuth 로그인과 로그아웃
- [ ] 회원탈퇴 직후 기존 세션 차단
- [ ] 7일 유예 중 동일 provider 복구
- [ ] 유예 만료 후 DB·S3 삭제
- [ ] OpenRouter 정상 응답·잔액 부족·timeout·provider 장애
- [ ] 결제 sandbox 구매·복원·중복 transaction·환불

### AI 품질 검증

- [ ] 캐릭터 말투·성격·관계 일관성 fixture
- [ ] 피드 JSON schema와 필수 `text` 검증
- [ ] 긴 기억·관계 맥락 반영 여부
- [ ] 이미지 이해 응답 품질
- [ ] 반복 요청 시 중복 응답률
- [ ] 유해 요청·개인정보·관계 경계 안전성
- [ ] 응답 latency와 flow별 실제 입력·출력 분포

베타 초기에는 실제 차감 전에 shadow billing으로 예상 사용량과 원가를 관찰한다.

## 12. 성공 기준

- [ ] OpenRouter 경유 Gemini Flash·Pro 정상 호출과 운영 장애 응답이 구분된다.
- [ ] 무료 에너지와 유료 크레딧이 서버에서 별도로 계산된다.
- [ ] 클라이언트의 모델·비용 조작으로 과금 우회가 불가능하다.
- [ ] 모든 잔액 변화가 append-only 원장으로 추적된다.
- [ ] provider 실패 시 사용자 크레딧이 최종 차감되지 않는다.
- [ ] 가입·캐릭터·첫 DM 보너스가 identity/event 기준으로 중복 지급되지 않는다.
- [ ] 자동 기능이 사용자 동의 없이 유료 크레딧을 사용하지 않는다.
- [ ] 회원탈퇴·복구·재가입·환불 정책이 원장과 일치한다.
- [ ] 실제 Lightsail 환경에서 AI·DB·S3·OAuth·scheduler 상태를 확인할 수 있다.
- [ ] 핵심 모바일 로그인·탈퇴·AI·결제 시나리오가 실제 또는 sandbox 환경에서 통과한다.

## 13. 위험과 롤백

| 위험 | 대응 |
| --- | --- |
| AI provider 잔액 소진 | provider 오류를 즉시 차단하고 충전 전까지 유료 요청을 받지 않음 |
| 원장 차감 후 AI 실패 | `reserved/committed/refunded` 상태와 idempotency key로 환급 |
| 가입 보너스 반복 지급 | identity/event unique 제약과 서버 트랜잭션 적용 |
| 결제 중복 지급 | transaction ID unique 검증 후 원장 지급 |
| 자동 기능 비용 폭증 | flow별 예산·호출 상한·scheduler kill switch |
| 정책 변경 시 잔액 분쟁 | policy version과 지급 당시 상품·정책 snapshot 보존 |
| 배포 migration 실패 | migrate 컨테이너 로그 확인 후 backend 기동, destructive migration 금지 |

초기 출시에서는 실제 결제를 활성화하기 전에 크레딧 ledger와 shadow billing을 운영한다. 문제가 발생하면 결제 버튼을 비활성화하고 AI 유료 flow를 차단할 수 있어야 한다.

## 14. 검증 명령

애플리케이션 프로세스는 직접 새로 시작하지 않고, 이미 실행 중인 환경 또는 Lightsail 배포 환경을 기준으로 검증한다.

```bash
npm run typecheck -w apps/frontend
npm run test:domain -w apps/frontend
npm run build -w apps/frontend
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests
```

배포 환경에서는 다음을 확인한다.

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml config
docker compose --env-file .env.prod -f docker-compose.prod.yml logs migrate
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

## 15. 관련 문서

- [크레딧 BM 및 AI 사용량 통합안](../../../reports/product/bm/report_credit-pricing-analysis_2026-08-06.md)
- [크레딧 최소비용 실측·가격 확정 결과](../../../reports/product/credit/report_credit-minimum-cost-validation_2026-08-10.md)
- [계정 삭제 라이프사이클 구현 계획](../account/plan_account-deletion-lifecycle_2026-08-09.md)
- [계정 삭제 라이프사이클 보안·우회 검토](../../../reports/product/account/report_account-deletion-security-review_2026-08-09.md)
- [프로젝트 README](../../../README.md)
