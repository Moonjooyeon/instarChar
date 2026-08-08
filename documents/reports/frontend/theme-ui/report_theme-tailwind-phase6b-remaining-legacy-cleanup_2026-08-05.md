---
title: 테마·Tailwind 6차 B 잔여 레거시 정리 보고서
author: black (black@ashwoodfriends.com)
created: 2026-08-05
updated: 2026-08-05
version: 1.0.0
status: review
---

# 테마·Tailwind 6차 B 잔여 레거시 정리 보고서

## 작업 범위

- 이전 계정 카드와 팔로잉·프로필 팔로우 패널 규칙을 제거했다.
- 사용되지 않는 게시물 배지, DM 화자·기억 편집, 공개 프로필 문구 규칙을 제거했다.
- 혼합 셀렉터에서는 사용 중인 대화 모드, 기억 추가, 안전 액션 규칙만 보존했다.

## 감사 방법

`src`의 TypeScript·JavaScript 클래스 토큰과 모든 CSS의 `.al-*` 셀렉터를 다시 교차했다. 단일 긴 규칙에 섞여 있던 `al-cast-index`도 별도로 분리해 제거했다.

## 결과

- `legacy.css`: 1,242줄에서 1,158줄로 감소
- 레거시 클래스: 480개에서 441개로 감소
- 미사용 레거시 클래스: 39개에서 0개로 감소
- 화면별 CSS를 포함한 전체 `.al-*` 셀렉터도 현재 소스 참조와 일치

## 검증

- 제거 대상 접두사 부재와 활성 혼합 규칙 보존을 정적 계약 테스트로 고정했다.
- `npm run typecheck`
- `npm run test:domain`
- `npm run build`
- `git diff --check`

실행 중인 프론트엔드가 없어 프로젝트 규칙에 따라 새 프로세스를 시작하지 않았다.

## 다음 단위

- 레거시 CSS 안의 활성 규칙을 화면별 스타일 또는 Tailwind 유틸리티로 점진 이동한다.
