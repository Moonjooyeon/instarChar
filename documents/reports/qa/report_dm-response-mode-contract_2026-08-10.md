---
title: DM 응답 모드 비용·토큰 계약 검증
author: black (black@ashwoodfriends.com)
created: 2026-08-10
updated: 2026-08-11
version: 1.1
status: deprecated
---

# DM 응답 모드 비용·토큰 계약 검증

> **Deprecated** — 이 문서는 2026-08-10의 다섯 단계 계약 검증 기록이다. 현재 DM 정책은 기본 1C·기억 반영 2C·중요한 답장 5C이며, DM 사진 첨부와 이미지 이해 flow는 제거됐다. 최신 범위는 [DM 피드백 단순화 계획](../../plans/product/app-flow/plan_dm-feedback-simplification_2026-08-11.md)을 따른다.

## 결과

DM 화면에서는 모델명을 더 이상 노출하지 않고 모드 이름과 비용만 보여준다. 실제 모델 선택, 출력 토큰, 추론 예산, 입력 맥락 상한과 비용은 서버의 `FlowPolicy`가 결정한다. 클라이언트가 `model` 또는 큰 `max_tokens`를 보내도 서버가 선택한 모드의 정책으로 덮어쓴다.

## 모드 계약

| 모드 | 비용 | 서버 모델 그룹 | 입력 상한 | 출력 토큰 상한 | 추론 예산 |
|---|---:|---|---:|---:|---:|
| 기본 대화 | 1C | fast | 12,000자 | 512 | 0 |
| 기억 반영 | 2C | fast | 24,000자 | 768 | 256 |
| 긴 맥락 | 2C | fast | 40,000자 | 1,536 | 512 |
| 중요한 답장 | 5C | pro | 24,000자 | 1,536 | 256 |
| 서사 집중 | 7C | pro | 50,000자 | 3,072 | 1,024 |

`fast`와 `pro`는 서버 환경의 모델 설정을 가리킨다. C 가격은 앱의 사용 정책이며, 모델 공급사에 전달되는 토큰 청구 단가를 사용자에게 그대로 노출하는 값은 아니다.

## 검증 결과

- `npm run typecheck -w apps/frontend`: passed
- `npm run test:domain -w apps/frontend`: passed, 142 tests
- `docker exec instarchat-local-backend python -m pytest tests/test_credit_policy.py tests/test_credit_repository.py tests/test_ai_api.py tests/test_credits_api.py -q`: passed, 56 tests
- `npm run build -w apps/frontend`: passed
- `python3 -m compileall -q backend/app`: passed
- `node --check apps/frontend/tests/e2e/alive-flow.spec.js && git diff --check`: passed
- `make ANDROID_ADB='…emulator-5554' cap-sync-local`: passed
- Android debug build and emulator deployment: passed

## 로컬 런타임 원장 대조

2026-08-10 17:42 KST 기준으로 실제 실행된 `direct_dm_basic`은 5건 모두 `committed · flash · success`였다. 각 건은 기획값과 동일하게 무료 에너지 8%만 사용했고, 보너스·구매 크레딧 차감은 0C였다.

현재 에너지는 0%이며, 보너스 크레딧은 150C, 구매 크레딧은 0C다. 따라서 다음 기본 대화는 1C 보너스 크레딧으로, 기억 반영/긴 맥락은 2C 보너스 크레딧으로 처리된다. 중요한 답장과 서사 집중은 구매 크레딧만 허용하므로 현재는 실행 전 차단된다.

## 검증하지 못한 것

- 각 모드의 실제 창작 품질과 체감 속도는 동일한 대화 시나리오로 사람 검토를 반복해야 한다.
- 이 작업에서는 아직 실행하지 않은 4개 응답 모드를 실제로 호출해 비용을 청구하지 않았다. 토큰·모델·비용 정책 강제는 결정적 서버 테스트로 검증했다.

## 남은 위험

- 긴 시스템 프롬프트나 대화가 입력 상한을 넘으면 서버는 `CONTEXT_TOO_LONG`으로 거절한다. 이는 저비용 모드에서 특히 빨리 발생할 수 있으므로, 실제 장문 사용 데이터를 보고 자동 요약 시점을 조정해야 한다.
