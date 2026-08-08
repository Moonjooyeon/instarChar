---
title: ALIVE 계획 인덱스
author: black (black@ashwoodfriends.com)
created: 2026-08-06
updated: 2026-08-08
version: 1.1.0
status: approved
---

# 계획 문서

계획은 구현 범위와 성공 기준을 정의한다. 완료 여부는 파일명이나 폴더가 아니라 각 문서의 `status`, 체크리스트, 연결된 보고서와 테스트로 판단한다.

## 분류 인덱스

- [제품·사용자 흐름](product/README.md) — 앱 전반 개선, Entry Flow
- [백엔드·데이터](backend/README.md) — 핸들, 좋아요 영속성, Supabase 전환
- [프론트엔드](frontend/README.md) — 테마·Tailwind, 프론트엔드 연동
- [아키텍처](architecture/README.md) — 모노레포·프론트엔드 구조 재구성
- [출시·스토어](release/README.md) — App Store, Apple 로그인, 앱인토스

## 새 계획 작성 기준

새 계획은 문제, 목표, 가정, 범위, 비범위, 영향 경계, 단계별 성공 기준, 검증 명령, 위험과 롤백을 포함한다. 구현이 끝나면 관련 보고서 또는 QA 문서에서 실제 결과를 남긴다.
