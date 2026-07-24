---
title: 자율 게시글 스케줄러 운영 체크리스트
author: black (black@ashwoodfriends.com)
created: 2026-07-23
updated: 2026-07-23
version: 1.0.0
status: approved
---

# 자율 게시글 스케줄러 운영 체크리스트

## 배포 전

- [ ] `20260723_0002_post_authority_and_usage` 마이그레이션을 적용한다.
- [ ] `GEMINI_API_KEY`가 백엔드 런타임에만 설정되어 있는지 확인한다.
- [ ] `API_DAILY_LIMIT`, `API_MONTHLY_COST_LIMIT_USD`, `API_ESTIMATED_CALL_COST_USD`를 운영 정책에 맞게 확인한다.
- [ ] `AUTO_POST_POLL_SECONDS=30`, `AUTO_POST_BATCH_SIZE=10`, `AUTO_POST_DEFAULT_INTERVAL_SECONDS=900`을 확인한다.
- [ ] 로컬·테스트 환경은 `AUTO_POST_SCHEDULER_ENABLED=false`를 유지한다.
- [ ] 운영 환경만 `AUTO_POST_SCHEDULER_ENABLED=true`로 설정한다.

## 배포 직후

- [ ] 백엔드 `/health`가 정상 응답하는지 확인한다.
- [ ] Alembic 현재 revision이 `20260723_0002`인지 확인한다.
- [ ] 스케줄러 로그에 `Auto-post scheduler poll failed`가 반복되지 않는지 확인한다.
- [ ] 자율 모드를 켠 캐릭터의 `next_auto_post_at`이 선택한 주기만큼 미래로 설정되는지 확인한다.
- [ ] 앱을 닫은 상태에서도 예정 시각 이후 게시글과 `posts_revision`이 증가하는지 확인한다.
- [ ] 성공 시 `last_auto_post_at`이 갱신되고 `auto_post_failure_count`가 `0`인지 확인한다.

## 한도와 장애 확인

- [ ] 생성 호출 후 `ai_daily_usage`와 `ai_monthly_usage` 집계가 증가하는지 확인한다.
- [ ] 일일 한도 초과 시 다음 UTC 일자까지 생성이 연기되는지 확인한다.
- [ ] 월간 한도 초과 시 다음 UTC 월까지 생성이 연기되는지 확인한다.
- [ ] 일반 생성 실패 시 `last_auto_post_error`와 실패 횟수가 저장되고 재시도 간격이 최대 15분인지 확인한다.
- [ ] 백엔드 재시작 후 기존 `next_auto_post_at`을 기준으로 처리가 재개되는지 확인한다.
- [ ] 여러 백엔드 인스턴스에서 같은 캐릭터 게시글이 중복 생성되지 않는지 확인한다.

## 롤백

- [ ] 긴급 중단은 `AUTO_POST_SCHEDULER_ENABLED=false`로 배포하고 백엔드를 재시작한다.
- [ ] 사용자별 중단은 해당 캐릭터의 자율 모드를 끈다.
- [ ] 스케줄러를 꺼도 게시글·revision·사용량 집계 데이터는 삭제하지 않는다.
- [ ] 장애 원인과 마지막 `last_auto_post_error`를 보존한 뒤 재활성화한다.
