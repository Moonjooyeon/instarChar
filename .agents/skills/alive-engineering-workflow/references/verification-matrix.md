# ALIVE Verification Matrix

Use the smallest complete gate for the task. Add gates when the change crosses a boundary.

| Change area | Required checks | Not proven by these checks |
|---|---|---|
| Pure domain helper | Domain tests, typecheck | UI rendering or server authorization |
| React/UI behavior | Typecheck, domain tests, build, existing-process browser review when available | Real API persistence |
| API client or response adapter | Domain/API tests, typecheck, build | FastAPI behavior or database state |
| FastAPI route/service | compileall, backend pytest, authorization tests | Real provider, deployment, or native behavior |
| PostgreSQL model/migration | compileall, migration tests, staging migration | Production data safety without a backup/rollback check |
| AI generation | backend tests, structured-output tests, cost-limit tests, representative prompt evaluation | Character quality or policy approval without human review |
| Media/S3 | backend media tests, upload-intent tests, staging S3 smoke test | iOS/Android networking unless tested on devices |
| Auth/OAuth | route/security tests, web smoke test, native smoke test where relevant | Provider console configuration |
| Cross-layer feature | frontend gates, backend gates, integration/E2E, documentation | Scale and long-term operations |
| Release | all relevant gates, migration review, environment audit, rollback plan | Store approval and real-user satisfaction |

## Reporting rule

Report each gate as `passed`, `failed`, `not run`, or `not applicable`. Explain every `not run` item. Do not convert a static check into a production claim.
