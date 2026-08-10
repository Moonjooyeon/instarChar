---
title: ALIVE 크레딧 최소비용 실측·가격 확정 결과
author: black (black@ashwoodfriends.com)
created: 2026-08-10
updated: 2026-08-10
version: 1.0.0
status: complete
---

# ALIVE 크레딧 최소비용 실측·가격 확정 결과

## 결론

기존 OpenRouter 키를 사용해 신규 충전 없이 Gemini 2.5 Flash·Pro 경로를 검증했다. token·reasoning token·원가 계측이 완전했으며, 피드 JSON 계약과 시스템 지시 비노출도 통과했다. 제품 결정에 따라 초기 베타 대화 가격은 `1C / 2C / 2C / 5C / 7C`로 확정한다.

| 기능 | 모델 | 초기 베타 가격 |
| --- | --- | ---: |
| 기본 대화 | Gemini 2.5 Flash | 1C |
| 장기기억·유저노트 일부 반영 | Gemini 2.5 Flash | 2C |
| 긴 기억·관계 맥락 반영 | Gemini 2.5 Flash | 2C |
| 중요한 고품질 응답 | Gemini 2.5 Pro | 5C |
| Pro 긴 추론·감정선·서사 | Gemini 2.5 Pro | 7C |

피드 생성 3C, 이미지 이해 5C, 캐릭터 상호작용 5C는 유지한다.

## 비용 통제

- 자동 충전과 신규 결제는 수행하지 않았다.
- 평가 도구의 로컬 총비용 상한은 `$1.00`이었다.
- 실제 키 누적 사용액은 `$0.140804775`였다.
- raw evidence 13건의 합계는 `$0.051512095`였다.
- 결과 스트림 회수 실패로 대표 배치를 반복했지만 전체 비용은 상한 이하였다.

## 대표 fixture 결과

환율은 기존 계획값 `1 USD = 1,400원`을 사용했다.

| flow | 표본 수 | 상세 표본 최대 원가 | 원화 환산 | 가격 |
| --- | ---: | ---: | ---: | ---: |
| `direct_dm_basic` | 4 | $0.0005179 | 0.73원 | 1C |
| `direct_dm_context` | 1 | $0.00099937 | 1.40원 | 2C |
| `direct_dm_flash_long` | 1 | $0.0013865 | 1.94원 | 2C |
| `direct_dm_pro` | 2 | $0.004669 | 6.54원 | 5C |
| `direct_dm_pro_story` | 2 | $0.02217375 | 31.04원 | 7C |
| `feed_post` | 1 | $0.00084228 | 1.18원 | 3C |
| `image_understanding` | 1 | $0.0012156 | 1.70원 | 5C |
| `character_interaction` | 1 | $0.00174807 | 2.45원 | 5C |

표본은 기능·계측 검증용이며 실제 사용자 p95·p99를 대체하지 않는다. 특히 Pro 서사형은 reasoning token과 문맥 길이 변동이 커서 shadow billing 결과에 따라 가격 또는 token 상한을 다시 결정해야 한다.

## 품질·계약 결과

- Flash·Pro smoke 성공
- 일반·문맥·장문·Pro 대화에서 캐릭터 말투 응답 생성
- 피드 JSON의 `text`, `mood` 계약 통과
- 이미지 입력과 응답 성공
- prompt injection 표본에서 숨겨진 marker와 system prompt 미노출
- 상세 evidence 13건 모두 첫 provider 시도에서 성공

정량 evidence는 [`credit-cost-live-samples-2026-08-10.json`](../../../qa/evidence/credit-cost-live-samples-2026-08-10.json)에 보존했다.

## 적용 정책

- `credit_policy_version`: `credit-2026-08-v3`
- Flash 대화 가격: 기본 1C, 문맥형 2C, 긴 기억·관계형 2C
- Pro 대화 가격: 고품질 5C, 긴 추론·감정선·서사 7C
- Pro flow는 무료 에너지·무료 보너스를 사용하지 않고 구매 크레딧만 사용
- 상품 결제는 운영 검증이 끝날 때까지 비활성 상태 유지

## 검증 결과

- backend 전체: 256 passed
- frontend domain: 137 passed
- TypeScript typecheck: passed
- Vite production build: passed
- 실제 OpenRouter Flash·Pro 및 대표 fixture: passed
- 브라우저 E2E·실제 PostgreSQL: 실행 중인 프로세스가 없어 미실행

## 다음 단계

결제를 비활성화한 상태에서 실제 사용자 shadow billing을 수집한다. flow별 p50·p95·p99와 실패·재시도 비용을 확인한 뒤 초기 베타 가격과 token 상한을 재검토한다.
