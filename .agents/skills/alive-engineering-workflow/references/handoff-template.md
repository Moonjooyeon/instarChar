# ALIVE Handoff Template

Use this compact structure for plans, reviews, and completed changes.

```md
## 결과

한 문단으로 현재 결과를 요약한다.

## 변경 파일

- `absolute/path`: 변경 이유

## 검증 결과

- `command`: passed | failed | not run
- 실행하지 못한 경우 이유와 필요한 실행 환경

## 검증하지 못한 것

- 실제 백엔드, 브라우저, S3, OAuth, 네이티브, 스토어 등 해당되지 않는 항목을 명시한다.

## 남은 위험

- 사용자 영향이 큰 순서로 적는다.

## 다음 추천 작업

1. 가장 가치가 큰 다음 작업
2. 그 작업의 완료 조건
```

For a plan, replace `결과` with `목표`, and add `가정`, `범위`, `제외 범위`, and `성공 조건` before the verification section.
