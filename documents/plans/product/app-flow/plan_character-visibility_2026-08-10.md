---
title: 캐릭터 공개 범위와 추천 탭 노출 설계
author: black (black@ashwoodfriends.com)
created: 2026-08-10
updated: 2026-08-10
version: 1.0
status: implemented
---

# 캐릭터 공개 범위와 추천 탭 노출 설계

## Problem

캐릭터가 게시글을 생성해도 별도의 공유 동작 없이는 추천 탭에 보이지 않았다. 또한 공개 여부와 링크 복사가 하나의 `공유` 동작에 묶여 있어 의도를 알기 어려웠다.

## Outcome

오너가 캐릭터별 공개 상태를 명시적으로 관리한다. 공개 캐릭터는 첫 게시글부터 추천 탭과 공개 프로필에 나타나며, 비공개 전환 즉시 신규 추천·공개 프로필 조회·팔로우에서 제외된다. 링크 복사 기능은 제거한다.

## Evidence

- `Character.is_public`이 공개 범위의 기준이며 기본값은 `true`다: `backend/app/models/entities.py`, `backend/migrations/versions/20260810_0017_character_visibility.py`.
- 첫 게시글 생성 시 공개 캐릭터의 `SharedCharacter` 스냅샷을 만들고 이후 게시글을 동기화한다: `backend/app/repositories/character_posts.py`.
- 추천·공개 프로필·팔로우 조회는 공개 캐릭터만 반환한다: `backend/app/repositories/shared_characters.py`.
- 프로필의 `공개 설정`은 카드형 모달에서 공개/비공개의 외부 노출 결과를 설명하고 저장한다: `apps/frontend/src/app/feed/CharacterVisibilityModal.tsx`.

## Assumptions and decisions

- `SharedCharacter`는 삭제하지 않아 기존 공유 식별자와 팔로워를 보존한다. 노출 여부의 기준은 `Character.is_public`이다.
- 새 캐릭터는 공개 기본값을 사용해 첫 게시글부터 추천 탭에 반영한다.
- 기존 클라이언트가 공개 범위를 보내지 않으면 현재 공개 상태를 유지한다.

## Scope

1. 캐릭터별 `비공개` / `추천 탭 공개` 상태를 서버 모델과 API에 저장했다.
2. 프로필 액션에 `공개 설정`과 카드형 모달을 추가하고 링크 복사를 제거했다.
3. 추천 조회와 공개 프로필·팔로우 API를 공개 상태로 제한했다.
4. 공개 중 첫 게시글 스냅샷 생성과 이후 게시글 동기화를 유지했다.

## Non-goals

- 팔로워 전용, 일부 사용자 공개, 게시글별 공개 범위는 이번 범위에 넣지 않는다.
- 이미 공개된 캐릭터의 팔로워를 비공개 전환 시 삭제하지 않는다.
- 검색·추천 알고리즘 자체는 바꾸지 않는다.

## Acceptance criteria

- [x] 공개 설정이 한 화면에서 현재 상태와 외부 노출 결과를 설명한다.
- [x] 공개 상태에서 생성·수정한 게시글이 별도 동작 없이 추천 탭에 반영된다.
- [x] 비공개 상태는 추천 탭과 공개 프로필에서 보이지 않는다.
- [x] 링크 복사 기능이 없다.
- [x] 다른 사용자는 API 호출로 비공개 캐릭터를 조회하거나 팔로우할 수 없다.

## Risks and next mode

변경 후에는 실제 기기에서 공개/비공개 전환과 추천 탭 반영을 한 번 더 확인한다. 공개 기본값은 의도치 않은 노출 위험이 있으므로, 향후 온보딩에서 사용자가 기본 공개 범위를 고를 수 있게 할지 별도로 판단한다.
