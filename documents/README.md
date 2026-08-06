---
title: ALIVE 문서 인덱스
author: black (black@ashwoodfriends.com)
created: 2026-08-06
updated: 2026-08-06
version: 1.0.0
status: approved
---

# ALIVE 문서 구조

문서는 목적과 수명에 따라 분리한다. 새 문서를 만들 때는 가장 구체적인 하위 디렉터리를 선택하고, 기존 문서를 다른 위치로 이동하거나 삭제하기 전에는 저장소 전체 참조를 검색한다.

| 디렉터리 | 용도 | 언어 | 상태 기준 |
|---|---|---|---|
| [`guides/`](guides/README.md) | 반복해서 참고하는 사용·출시 안내 | 한국어 | 현재 안내만 유지 |
| [`plans/`](plans/README.md) | 구현 범위, 단계, 성공 기준 | 한국어 | front matter의 `status`가 기준 |
| [`specs/`](specs/README.md) | API·데이터·아키텍처 기술 명세 | 한국어 | 구현 전후의 계약 문서 |
| [`reports/`](reports/README.md) | 조사, 검증, 리뷰, 운영 결과 | 한국어 | 사실과 미검증 항목을 구분 |
| [`qa/`](qa/README.md) | 브라우저·네이티브 QA와 증거 | 한국어/영어 | 결과와 증거를 분리 |
| [`references/`](references/README.md) | 안정적인 프로젝트 구조·기술·규칙 | 영어 | 현재 코드와 일치해야 함 |

## 공통 규칙

- Markdown 문서는 front matter를 사용한다. 디렉터리 인덱스와 `references/`의 규칙 문서는 예외로 둘 수 있다.
- 파일명은 `<prefix>_<topic>_<date>.md` 형식을 따른다. 날짜가 필요 없는 장기 문서는 `<prefix>_<topic>.md`를 사용한다.
- prefix는 `guide_`, `plan_`, `spec_`, `report_`, `proposal_`, `decision_`, `ref_` 중 하나를 사용한다.
- 계획·보고서의 `status`를 임의로 `complete`로 바꾸지 않는다. 구현·검증 증거가 있을 때만 갱신한다.
- 이미지·XML·스크린샷은 본문과 같은 폴더에 두지 않고 `qa/evidence/`에 둔다.
- 과거 문서는 삭제보다 `deprecated` 상태와 대체 문서 링크를 우선한다.

## 빠른 이동

- [계획 인덱스](plans/README.md)
- [명세 인덱스](specs/README.md)
- [보고서 인덱스](reports/README.md)
- [QA 인덱스](qa/README.md)
- [가이드 인덱스](guides/README.md)
- [프로젝트 참조 인덱스](references/README.md)
