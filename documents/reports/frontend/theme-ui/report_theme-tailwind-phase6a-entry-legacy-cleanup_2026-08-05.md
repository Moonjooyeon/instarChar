---
title: 테마·Tailwind 6차 A 인증·생성 레거시 정리 보고서
author: black (black@ashwoodfriends.com)
created: 2026-08-05
updated: 2026-08-05
version: 1.0.0
status: review
---

# 테마·Tailwind 6차 A 인증·생성 레거시 정리 보고서

## 작업 범위

- 현재 소스에서 참조되지 않는 이전 인증 탭·입력·대체 액션 규칙을 제거했다.
- 이전 캐릭터 생성 진행 표시, 말투 카드, 가이드 칩, 예시 카드 규칙을 제거했다.
- 사용되지 않는 과거 DM 화자·관계 입력 규칙을 제거했다.

## 감사 방법

`src`의 TypeScript·JavaScript 클래스 토큰과 `legacy.css`의 `.al-*` 셀렉터를 교차했다. 새 생성 단계에서 사용 중인 `.al-step-*`, `.al-rp-box`, 현재 인증 링크는 보존했다.

## 결과

- `legacy.css`: 1,323줄에서 1,242줄로 감소
- 레거시 클래스: 519개에서 480개로 감소
- 미사용 레거시 클래스: 78개에서 39개로 감소

## 검증

- 제거 대상 클래스 부재와 대체 활성 클래스 보존을 정적 계약 테스트로 고정했다.
- `npm run typecheck`
- `npm run test:domain`
- `npm run build`
- `git diff --check`

실행 중인 프론트엔드가 없어 프로젝트 규칙에 따라 새 프로세스를 시작하지 않았다.

## 다음 단위

- 남은 39개 미사용 클래스 중 이전 계정 카드·팔로잉 패널 규칙을 제거한다.
