---
title: ALIVE 크레딧 사용 지점 UI/UX 개선 브리프
created: 2026-08-09
status: implemented-awaiting-runtime-qa
---

# ALIVE 크레딧 사용 지점 UI/UX 개선 브리프

## Implementation status

- 서버 catalog 기반 8개 flow 비교, 무료 에너지·무료 bonus·구매 크레딧 구분, Pro 구매 크레딧 전용 안내를 반영했다.
- DM·이미지 DM·자동대화·피드 생성 위치에 예상 사용량과 예약 중 상태를 표시했다.
- 잔액·에너지·최근 사용 내역을 API 데이터로 연결했고 결제 버튼은 비활성 상태를 유지했다.
- TypeScript typecheck, domain test, production build는 통과했다.
- 실제 모바일 화면과 접근성 동작은 이미 실행 중인 앱 또는 배포 환경에서 추가 확인해야 한다.

## Problem

현재 크레딧 센터는 서버가 제공하는 8개 과금 flow 중 3개만 보여주고, DM과 피드의 비용 안내는 서버 카탈로그와 분리된 고정 문구다. 생성 중에는 에너지 또는 크레딧이 예약되었다는 피드백도 없다.

## Outcome

사용자는 크레딧 센터에서 모든 기능의 에너지·크레딧 비용과 용도를 비교할 수 있고, DM·이미지 DM·자동대화·피드 생성 직전과 생성 중에 예상 사용량을 확인할 수 있다.

## Evidence

- 서버 가격 계약: `GET /api/credits/catalog`
- 크레딧 센터: `apps/frontend/src/features/credits/CreditStoreScreen.tsx`
- DM 사용 지점: `apps/frontend/src/app/dm/DmControls.tsx`
- 피드 사용 지점: `apps/frontend/src/app/feed/FeedComposer.tsx`, `FeedTimeline.tsx`
- 잔액 갱신 이벤트: `alive:credit-balance-updated`

## Assumptions and decisions

- 비용 숫자는 항상 서버 카탈로그를 기준으로 표시한다.
- 저비용 반복 기능에는 별도 확인 모달을 두지 않고 버튼 주변에서 비용을 미리 고지한다.
- 에너지가 먼저 사용되고 부족할 때만 크레딧이 사용된다는 문장을 함께 표시한다.
- Pro·문맥형·서사형은 이번 작업에서 새로 활성화하지 않고 카탈로그 설명만 제공한다.

## Scope

- 모든 공개 flow를 대화·콘텐츠 그룹으로 정리한다.
- 재사용 가능한 비용 안내 컴포넌트를 크레딧 feature에 둔다.
- DM·이미지 DM·자동대화·피드 생성의 사용 전·생성 중 상태를 표시한다.
- 로딩·카탈로그 오류·무료 기능·반복 사용 비용 표현을 다룬다.

## Non-goals

- 인앱 결제, 영수증 검증, 구매 복원
- DM 품질 등급 선택 기능
- 새로운 AI 과금 정책이나 가격 변경
- 내부 AI flow 노출

## Acceptance criteria

- 크레딧 센터에 8개 공개 flow가 모두 나타난다.
- 각 flow에 에너지 비용, 에너지 소진 후 크레딧 비용, 용도 설명이 있다.
- DM과 피드의 고정 가격 문구가 서버 카탈로그 기반 표시로 바뀐다.
- 자동대화에는 최대 6회 기준 비용이 표시된다.
- 생성 중 화면은 사용량 예약 상태를 보조 문구로 알린다.
- 타입 검사, 도메인 테스트, 빌드가 통과한다.

## Risks and next mode

실행 중인 앱이 없으면 실제 모바일 화면의 줄바꿈과 밀도는 검증할 수 없다. 다음 모드는 `Change`이며, 구현 후 기존 프로세스가 있을 때 브라우저 QA를 수행한다.
