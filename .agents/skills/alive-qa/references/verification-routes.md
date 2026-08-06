# Verification routes

| Change surface | First check | Stronger check when available |
|---|---|---|
| Pure domain helper | `npm run test:domain` or focused test | Boundary cases and regression fixture |
| React component or hook | `npm run typecheck` plus focused test | Existing-process Playwright or browser inspection |
| API client and FastAPI route | Typecheck plus backend focused test | Authenticated request against an existing backend |
| Database or migration | Backend tests and migration inspection | Applied migration against a disposable/approved database |
| AI generation | Schema/parser/usage tests | Golden fixture evaluation with recorded model/config |
| Media upload/access | URL/asset helper tests | Existing-process upload/download/delete flow |
| OAuth or native shell | Static config/build checks | Real approved integration/device flow |
| Cross-layer feature | Smallest layer checks first | End-to-end flow with explicit environment evidence |

## Evidence rules

- `npm run build` proves a build artifact was produced, not backend or production readiness.
- Mocked network tests prove client behavior under the mock, not provider availability.
- A skipped process-dependent check is `not run`, not `passed`.
- Manual observations should include route, inputs, expected result, actual result, and screenshot/log location when useful.
