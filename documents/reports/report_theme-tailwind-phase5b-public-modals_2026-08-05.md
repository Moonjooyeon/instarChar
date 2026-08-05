---
title: 테마·Tailwind 5차 B 공개 프로필·세계관·팔로우 모달 보고서
author: black (black@ashwoodfriends.com)
created: 2026-08-05
updated: 2026-08-05
version: 1.0.0
status: review
---

# 테마·Tailwind 5차 B 공개 프로필·세계관·팔로우 모달 보고서

## 작업 범위

- 공개 캐릭터 프로필과 주요·안전 액션을 전환했다.
- 세계관 보기 모달과 팔로우·팔로워 목록 모달을 전환했다.
- DM 장면 설정 모달은 다음 단위로 분리했다.

## 구조 판단

세 모달은 앱 화면의 형제 영역에서 렌더링된다. 각 배경 레이어에 `al-theme-ready al-public-modal-theme-ready`를 추가해 현재 화면과 관계없이 테마 토큰을 받게 했다.

## 디자인 판단

- 공개 프로필 배너는 과한 보라·핑크·파랑 그라디언트 대신 포인트와 중립 표면으로 정리했다.
- 타임라인 추가는 주 액션, 바로 DM은 보조 액션으로 유지했다.
- 이미 추가된 캐릭터를 빼는 상태는 위험 의미로 구분했다.
- 신고는 중립 안전 액션, 차단은 위험 액션으로 분리했다.
- 팔로우 목록의 상태는 텍스트 라벨과 포인트 배지를 함께 사용한다.

## Tailwind 전환

- 바로 DM과 타임라인 추가·제거 버튼의 상태를 Tailwind 유틸리티로 옮겼다.
- 추가 상태 분기는 타입이 명시된 `publicFollowClass`로 한곳에서 관리한다.

## 검증

- `npm run typecheck`
- `npm run test:domain`
- `npm run build`
- `git diff --check`
- `public-modals.css` 직접 색상 검사

실행 중인 프론트엔드가 없어 프로젝트 규칙에 따라 새 프로세스를 시작하지 않았다.

## 다음 단위

- DM 시작 방식과 방별 세계관 설정 모달을 전환한다.
