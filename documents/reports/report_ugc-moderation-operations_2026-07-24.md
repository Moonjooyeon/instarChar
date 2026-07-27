---
title: ALIVE UGC Moderation Operations
author: 주식회사 애쉬우드프렌즈
created: 2026-07-24
updated: 2026-07-24
version: 1.0.0
status: active
---

# ALIVE 신고·차단 운영 절차

## 적용 범위

공개 캐릭터, 게시물, 댓글, 공유 DM, AI 생성 게시물과 AI 대화 신고에 적용한다. 사용자는 앱 안에서 신고하거나 다른 운영 사용자를 차단할 수 있다. 차단은 양방향 공개 탐색과 공유 DM 상호작용을 제한한다.

## 운영 설정

배포 환경에 다음 값을 설정한다.

```bash
TERMS_VERSION=2026-07-24
MODERATION_API_KEY=<긴 무작위 비밀값>
MODERATION_ACTOR=operations
```

`MODERATION_API_KEY`는 앱 번들, 프론트엔드 환경 변수 또는 공개 저장소에 넣지 않는다.
운영 CLI를 실행하는 셸에는 같은 값을 `MODERATION_API_KEY` 환경 변수로 주입한다.

## 신고 큐 조회

```bash
backend/.venv/bin/python backend/scripts/moderate_reports.py \
  --api https://alive.imagebgremover.net/api \
  list --status pending
```

운영자는 신고 큐를 매일 확인한다. 아동 안전, 실제 폭력 위협, 자해 위험, 개인정보 노출은 가능한 즉시 우선 검토하고 일반 신고는 72시간 이내 첫 조치를 목표로 한다.

## 처리 상태

- `pending`: 새로 접수됨
- `reviewing`: 운영자가 사실관계와 문맥을 확인 중
- `resolved`: 위반 여부를 확인하고 조치를 완료함
- `dismissed`: 위반이 아니거나 판단할 정보가 부족함

## 운영 조치

- `content_removed`: 신고된 공개 캐릭터, 게시물, 댓글 또는 공유 DM 메시지를 데이터에서 삭제
- `user_warned`: 경고 조치 기록
- `user_suspended`: 대상 계정 접근을 정지
- `user_banned`: 대상 계정 접근을 영구 차단
- `none`: 별도 제재 없음

처리 예:

```bash
backend/.venv/bin/python backend/scripts/moderate_reports.py \
  --api https://alive.imagebgremover.net/api \
  resolve REPORT_ID \
  --status resolved \
  --action content_removed \
  --note "괴롭힘 콘텐츠 확인 후 삭제"
```

반복적이거나 중대한 위반 계정 정지 예:

```bash
backend/.venv/bin/python backend/scripts/moderate_reports.py \
  --api https://alive.imagebgremover.net/api \
  resolve REPORT_ID \
  --status resolved \
  --action user_banned \
  --user-status banned \
  --note "반복적인 중대 커뮤니티 정책 위반"
```

## 판단 원칙

신고 스냅샷만 보지 않고 대상 콘텐츠의 문맥과 반복성을 함께 확인한다. 아동 성적 착취, 비동의 성적 콘텐츠, 구체적 폭력 위협, 개인정보 노출은 즉시 노출을 차단한다. 풍자, 창작물, 인용처럼 문맥상 허용될 수 있는 표현은 피해 가능성과 이용약관을 함께 검토한다.

## 이의 제기 및 문의

이용자는 `ashwoodfriends@ashwoodfriends.com`으로 조치에 대해 문의할 수 있다. 운영자는 신고 ID, 조치 사유, 검토 결과를 기록하되 신고자 신원은 대상 사용자에게 공개하지 않는다.
