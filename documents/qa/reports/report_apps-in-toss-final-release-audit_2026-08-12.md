---
title: Apps in Toss Final Release Audit
author: black (black@ashwoodfriends.com)
created: 2026-08-12
updated: 2026-08-12
version: 1.0.0
status: deprecated
---

# 앱인토스 최종 출시 감사

> **Deprecated** — 이 문서는 수정 전 감사 스냅샷이다. 수정·재검증 결과는 [최종 하드닝 보고서](report_apps-in-toss-final-hardening_2026-08-12.md)를 기준으로 한다.

- 판정: **NO-GO**
- 대상: 현재 작업 트리의 프론트엔드, FastAPI 백엔드, AI 생성, 크레딧·앱인토스 IAP, 인증·보안, Android·iOS 셸, 운영 URL
- 운영 URL: `https://alive.imagebgremover.net`
- 원칙: 기존 프로세스만 사용했으며 새 프론트엔드·백엔드 프로세스는 시작하지 않았다.
- 주의: 이 감사는 확인 가능한 코드, 로컬 설정, 기존 실행 환경 및 운영 공개 응답을 대상으로 한다. 앱인토스 콘솔 비공개 설정과 실제 결제 승인은 콘솔·샌드박스 증거 없이는 확정할 수 없다.

## 출시 차단 항목

### P1 — DM 프롬프트에서 캐릭터 나이가 누락되어 정체성이 달라진다

`selfSettingPriorityBlock`은 성격·세계관·말투·관계 등을 포함하지만 `age`를 포함하지 않는다. DM 생성은 이 블록을 사용하므로 사용자가 캐릭터 나이를 직접 물으면 모델이 임의의 나이를 답할 수 있다.

- 실제 저장 프로필: 리안, 21세
- 기존 DM 응답: “스물셋”
- 통제 재현: 나이 미포함 3회에서 19세, 19세, 17세 응답
- 같은 프롬프트에 `21세`를 명시하면 “스물한 살. 21살이야.” 응답
- 원인: `apps/frontend/src/domain/app/aliveCore.ts:305`의 설정 블록 누락, DM 사용 지점은 `apps/frontend/src/hooks/useAliveDmGeneration.ts`

출시 조건: 나이를 최우선 설정 블록에 넣고, 나이 질문에 저장값을 유지하는 회귀 테스트를 추가한 뒤 실제 AI로 재검증한다.

### P1 — 결제 출시 증거가 완성되지 않았다

서버 결제 설계는 주문 상태·SKU·사용자 검증, 서버 결정 가격·크레딧, 주문 ID 유일성, 트랜잭션 잠금, 중복 지급 방지, 환불·부채 처리, 재조정 작업까지 갖춰져 있다. 동시 중복 승인 통합 테스트도 통과했다. 그러나 현재 릴리스 매니페스트는 실제 콘솔 버전과 최소 지원 버전이 자리표시자라 preflight가 실패한다.

- `documents/qa/guides/apps-in-toss-iap-console-manifest.example.json`: 콘솔 버전과 최소 지원 버전 미기입
- 로컬 설정: IAP 활성화·구매·환불·정산·롤아웃이 모두 꺼져 있고 mTLS 파일이 없음
- 이는 로컬 안전 기본값이며 운영 설정 상태는 확인하지 못했다.
- 실제 앱인토스 샌드박스의 구매 성공, 중복 콜백, 재실행 복구, 환불 회수, 잔액 부족 부채 전환은 미실행이다.

출시 조건: 업로드한 `.ait`의 SHA-256·deployment ID·콘솔 표시 버전·최소 지원 버전을 매니페스트에 고정하고 preflight를 통과시킨다. 이후 IAP를 노출하지 않은 상태에서 mTLS와 샌드박스 전 시나리오를 증거와 함께 통과시킨다.

### P1 — npm 의존성 감사에서 Critical 1건과 High 22건이 남아 있다

`npm audit --omit=dev --audit-level=moderate` 결과는 총 40건(critical 1, high 22, moderate 3, low 14)이다. 주요 취약점은 현재 설치된 `@apps-in-toss/web-framework@2.10.8` 계열의 Fastify·middie·find-my-way 및 Babel 도구 체인에 있다. 최신 확인 버전은 `3.0.3`이다. 생성된 클라이언트 JS에서 Fastify·middie·find-my-way는 발견되지 않아 직접적인 앱 런타임 공격보다는 빌드·공급망 위험으로 판단한다.

출시 조건: 앱인토스 프레임워크 3.x 마이그레이션 후 typecheck, 도메인 테스트, Toss 빌드, 결제 preflight와 샌드박스를 재실행한다. 즉시 업그레이드할 수 없다면 공급사 확인과 명시적 위험 승인이 필요하다.

## 높은 우선순위 개선 항목

### P2 — 운영 응답에 기본 보안 헤더가 없다

확인한 운영 응답에서 HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`를 관찰하지 못했다. CORS는 앱인토스 공개·비공개 출처만 허용하고 임의 HTTPS·HTTP 출처는 거부해 정상이다.

출시 전 최소 HSTS, `nosniff`, referrer policy, permissions policy를 추가하고, 앱 동작에 맞는 CSP 및 frame 정책을 검증한다.

### P2 — 앱인토스 bearer 세션의 탈취 영향이 크다

앱인토스 세션 토큰은 `apps/frontend/src/api/client.ts:43`에서 `localStorage`에 저장된다. 로그아웃은 프론트 저장소와 쿠키를 지우지만 서버 토큰을 폐기하지 않으므로 기본 30일 유효기간 동안 탈취 토큰이 계속 사용될 수 있다. 직접적인 HTML 주입 코드는 찾지 못했지만 CSP도 없어 XSS 발생 시 영향이 커진다.

출시 전 토큰 수명 단축·회전 또는 서버 폐기 전략을 결정하고 CSP를 함께 적용한다.

### P2 — DB 모델과 Alembic head 사이에 드리프트가 있다

DB는 `20260812_0024 (head)`이지만 `alembic check`는 인덱스 2개 제거와 `credit_purchases.created_at`, `updated_at`의 NOT NULL 변경을 새 작업으로 감지했다. 의도되지 않은 다음 마이그레이션을 만들 수 있다.

출시 전 모델과 마이그레이션 중 어느 쪽이 기준인지 결정하고 `alembic check`를 clean 상태로 만든다.

### P2 — AI 안전 검사가 생성 경계에 충분하지 않다

애플리케이션의 `require_safe_content`는 저장 직전 일부 저장소에서 좁은 정규식만 검사하며 `/api/ai/generate` 입력·출력 경계에는 적용되지 않는다. 실제 prompt-injection 테스트에서는 모델이 시스템 프롬프트·비밀키 공개를 거부했지만, 이 한 번의 공급자 거부만으로 유해 콘텐츠 방어를 보장할 수 없다.

출시 전 주요 AI flow별 유해 입력·출력, 개인정보, 자해·성적·혐오, 프롬프트 유출 평가 세트를 만들고 서버 경계의 정책과 실패 처리를 검증한다.

## 낮은 우선순위 항목

- P3: DM 시작 버튼이 이름과 무관하게 `{이름}와`를 사용해 “리안와”로 표시된다 (`apps/frontend/src/features/dm/DmListScreen.tsx:123`, `:126`).
- P3: 운영 `/docs`, `/redoc`, `/openapi.json`이 공개되어 공격 표면 정보를 제공한다. 운영에서 필요하지 않으면 비활성화하거나 접근을 제한한다.

## 통과한 검증

| 영역 | 결과 | 근거 |
|---|---|---|
| TypeScript | passed | `npm run typecheck` |
| 프론트 도메인 테스트 | passed | 165/165 |
| 프론트 빌드 | passed | `npm run build` |
| 앱인토스 빌드 | passed | `npm run build:toss -w apps/frontend`, deployment ID `019ff41d-4fd5-75f4-a868-b58d27ab1903` |
| 백엔드 전체 테스트 | passed/partial | 391 passed, 1 integration skipped; 해당 DB integration 별도 실행 1 passed |
| AI·보안 집중 테스트 | passed | 88/88 |
| 결제 동시성 통합 테스트 | passed | 중복 지급, 최초 구매 보너스, 재가입 subject, 보존·감사·정리 검증 |
| Python 컴파일·의존성 일관성 | passed | `compileall`, `pip check` |
| Python CVE 감사 | not run | `pip-audit`가 환경에 설치되어 있지 않음 |
| Android release lint | passed | Android Studio JBR 21, `lintRelease` |
| iOS unsigned Release build | passed | 코드 서명 제외 `xcodebuild` |
| Android 실행 화면 | partial | 피드·크레딧·DM·발견 렌더링, 치명적 WebView/앱 오류 없음 |
| Playwright | partial | 21개 시나리오 discovery만 통과; 기존 frontend 서버가 없어 실행하지 않음 |
| 운영 API·법적 문서 | passed/partial | health, 개인정보, 이용약관, 계정삭제, 브랜드 아이콘 정상; 인증 보호 확인 |
| 운영 브라우저 시각 QA | not run | 인앱 브라우저가 도메인을 `ERR_BLOCKED_BY_CLIENT`로 차단 |

## 실제 AI 공급자 스모크 결과

- 일반 DM: 200, 2.52초, flash 1회, 측정 비용 약 `$0.000354`
- prompt injection: 200, 2.23초, 시스템 프롬프트·비밀키 공개 거부
- 캐릭터 분석: 200, 8.58초, pro 실패 후 flash fallback, 2회, 유효한 구조화 JSON, 측정 비용 약 `$0.0049305`

서버는 flow allowlist, 일·월 사용량, 크레딧 예약·정산·환불, idempotency, 문자·토큰 제한, 구조화 결과 검증을 서버 권한으로 처리하고 있어 이 부분은 양호하다.

## 실행 화면 증거와 한계

- [홈](../evidence/release-audit-2026-08-12/android-current.png)
- [크레딧](../evidence/release-audit-2026-08-12/android-credits.png)
- [피드](../evidence/release-audit-2026-08-12/android-feed.png)
- [DM 목록](../evidence/release-audit-2026-08-12/android-dm.png)
- [DM 대화](../evidence/release-audit-2026-08-12/android-dm-thread.png)
- [발견](../evidence/release-audit-2026-08-12/android-discover.png)

실행 중이던 Android 앱은 `versionCode 4`, `versionName 1.0.0`이고 현재 소스는 `versionCode 7`이다. 따라서 화면 검사는 사용자 흐름의 회귀 단서이지 최신 소스 번들의 최종 증명은 아니다. 네이티브 Capacitor 런타임에서 결제 화면이 “결제 준비 중”으로 표시되는 것은 IAP가 앱인토스 런타임 전용이므로 정상이다.

## 최종 승인 기준

다음 조건이 모두 충족될 때만 `GO`로 변경한다.

1. AI 나이 누락 수정과 실제 모델 회귀 테스트 통과
2. 앱인토스 SDK 취약점 해소 또는 공급사 근거가 포함된 공식 위험 승인
3. 실제 콘솔 정보로 IAP preflight 통과 및 샌드박스 구매·중복·복구·환불 전 시나리오 통과
4. 운영 보안 헤더, 세션 토큰 정책, Alembic 드리프트 조치
5. 현재 `.ait`로 앱인토스 테스트 환경에서 21개 핵심 사용자 흐름 또는 동등한 기기 수동 테스트 통과
