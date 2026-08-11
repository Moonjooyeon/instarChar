---
title: ALIVE 크레딧 최소비용 실측·가격 확정 계획
author: black (black@ashwoodfriends.com)
created: 2026-08-10
updated: 2026-08-11
version: 1.0.0
status: deprecated
---

# ALIVE 크레딧 최소비용 실측·가격 확정 계획

> **Deprecated** — 이 계획의 5단계 DM 가격과 이미지 이해 flow는 더 이상 현재 제품 정책이 아니다. 현재 정책은 [DM 피드백 단순화 계획](../app-flow/plan_dm-feedback-simplification_2026-08-11.md)을 따른다.

## 목표

현재 서버의 OpenRouter Gemini Flash·Pro 경로를 최소 비용으로 실제 호출해 token, reasoning token, provider cost, latency, 응답 계약을 수집한다. 제품에서 정한 초기 베타 가격이 작은 실제 표본에서 즉시 위험하지 않은지 확인한다.

## 초기 베타 가격

| 기능 | 모델 | 크레딧 |
| --- | --- | ---: |
| 기본 대화 | Gemini 2.5 Flash | 1C |
| 장기기억·유저노트 일부 반영 | Gemini 2.5 Flash | 2C |
| 긴 기억·관계 맥락 반영 | Gemini 2.5 Flash | 2C |
| 중요한 고품질 응답 | Gemini 2.5 Pro | 5C |
| Pro 긴 추론·감정선·서사 | Gemini 2.5 Pro | 7C |

피드 생성 3C, 이미지 이해 5C, 캐릭터 상호작용 5C는 기존 콘텐츠 flow 가격을 유지한다.

## 비용 통제

- 기존 `OPENROUTER_API_KEY`만 사용하고 신규 결제나 자동 충전을 수행하지 않는다.
- 평가 스크립트에 `$1.00` 로컬 누적 상한을 둔다.
- provider가 반환한 `usage.cost`와 token 정보를 raw evidence에 기록한다.
- 운영 사용자 데이터나 개인정보를 표본으로 사용하지 않는다.

## 검증 범위

- Flash·Pro 최소 smoke 호출
- 기본·문맥·장문·Pro·Pro 서사형 대표 fixture
- 피드 JSON, 이미지 입력, 캐릭터 상호작용, prompt injection 표본
- provider retry 횟수와 token·reasoning·cost·latency 기록
- backend·frontend 정책 테스트, typecheck, production build

## 완료 조건

- 모든 대표 호출이 성공하고 `usage.cost`가 기록된다.
- 피드 JSON의 `text`, `mood` 계약이 통과한다.
- 시스템 지시 marker가 응답에 노출되지 않는다.
- 총 실제 비용이 `$1.00` 이하이다.
- 서버 정책, catalog mock, 문서의 대화 가격이 `1C / 2C / 2C / 5C / 7C`로 일치한다.
- 실제 사용자 p95·p99 미확정과 결제 비활성 상태를 명시한다.

## 완료 결과

- OpenRouter 키 누적 사용액 `$0.140804775`로 Flash·Pro와 대표 flow를 검증했다.
- 상세 evidence 13건이 모두 1회 호출로 성공했고 token·reasoning token·`usage.cost`가 기록됐다.
- 피드 JSON 계약, 이미지 입력, 시스템 지시 비노출을 확인했다.
- 초기 베타 대화 가격 `1C / 2C / 2C / 5C / 7C`를 서버 정책과 테스트에 반영했다.
- 영구 가격 판단은 실제 사용자 shadow billing p95·p99 수집 뒤 진행한다.
