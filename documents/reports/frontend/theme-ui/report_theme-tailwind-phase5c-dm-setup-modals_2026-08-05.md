---
title: 테마·Tailwind 5차 C DM 설정 모달 보고서
author: black (black@ashwoodfriends.com)
created: 2026-08-05
updated: 2026-08-05
version: 1.0.0
status: review
---

# 테마·Tailwind 5차 C DM 설정 모달 보고서

## 작업 범위

- 새 DM의 만남 장소와 공유 범위 선택 단계를 전환했다.
- 첫 장면 메모와 기존 대화의 장면 설정 모달을 전환했다.
- 대화 생성 및 설정 저장 동작은 변경하지 않았다.

## 구조 판단

DM 목록과 대화방 어느 쪽에서도 열릴 수 있는 오버레이이므로 각 배경 레이어에 `al-theme-ready al-dm-setup-modal-theme-ready`를 추가했다. 전용 스타일 브리지는 기존 `.al-world-*` 레이아웃을 보존하면서 색상만 시맨틱 토큰으로 덮는다.

## 디자인 판단

- 선택 카드는 화면 전체를 포인트색으로 채우지 않고 테두리와 옅은 포인트 표면으로 상태를 구분했다.
- 제목, 설명, 선택지 보조 문구의 명도 단계를 나눠 정보 위계를 유지했다.
- 메모 입력은 떠 있는 표면으로 분리하고 포커스 링을 추가했다.
- 저장·다듬고 시작은 주 액션, 취소·그대로 시작은 보조 액션으로 구분했다.

## Tailwind 전환

- 선택 카드, 메모 입력, 하단 액션의 색상·상태를 Tailwind 유틸리티로 옮겼다.
- 설정 모달의 선택 상태는 타입이 명시된 `worldOptionClass`로 관리한다.

## 검증

- `npm run typecheck`
- `npm run test:domain`
- `npm run build`
- `git diff --check`
- `dm-setup-modals.css` 직접 색상 검사

실행 중인 프론트엔드가 없어 프로젝트 규칙에 따라 새 프로세스를 시작하지 않았다.

## 다음 단위

- 아직 테마 스코프가 없는 화면과 레거시 하드코딩 색상을 전수 점검한다.
