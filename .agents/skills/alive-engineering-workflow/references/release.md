# Release Mode

Use this mode for staging checks, deployment readiness, store release preparation, or production-risk review.

## Gate categories

- Frontend typecheck, domain tests, build, and existing-process browser review.
- Backend Python compile, pytest, database connectivity, and migration application.
- Auth/OAuth provider configuration and session restoration.
- Gemini key, model routing, usage limits, retry behavior, and failure reporting.
- S3 intent/complete/content authorization, CORS, orphan cleanup, and real upload.
- Scheduler behavior while the app is closed, restart recovery, and multi-instance claims.
- Account deletion, moderation, legal URLs, and rollback procedure.
- iOS/Android native login, media upload, safe area, deep link, and release build.

For every gate, report `passed`, `failed`, `not run`, or `not applicable`. Never access production systems or start app processes without explicit scope and the repository's process rules.
