# Pre-commit and Lightsail readiness — 2026-08-12

## Scope

Validate the uncommitted AI feed, credit, model, and routine-interval changes without starting a new app process. This report is an audit artifact only; it does not change application behaviour.

## Passed checks

| Check | Result |
| --- | --- |
| Frontend TypeScript | `npm run typecheck -w apps/frontend` passed |
| Frontend domain tests | `npm run test:domain -w apps/frontend` passed: 159 tests |
| Frontend production build | `npm run build -w apps/frontend` passed |
| Backend compile | `make backend-compile` passed |
| Backend test suite | `make backend-test` passed: 353 passed, 1 skipped |
| Focused scheduler/feed/API tests | 33 passed |
| Migration graph | `alembic heads` resolved to `20260811_0023 (head)` |
| Diff whitespace | `git diff --check` passed |
| Production Compose syntax | `PROD_ENV_FILE=.env.example docker compose -f docker-compose.prod.yml config -q` passed |
| Dockerfile static check | `docker build --check backend` passed with no warning |
| Playwright discovery | 21 existing E2E cases discovered |

## Release blockers and limits

1. **Do not use `.env.example` as a literal Lightsail production file.** `TERMS_VERSION`, `MODERATION_API_KEY`, and `MODERATION_ACTOR` appear twice; the later empty entry wins in Docker env-file parsing. The duplicates predate this change, but copying the template can silently remove required moderation/legal values.
2. **Offline migration SQL generation fails.** `alembic upgrade head --sql` stops at migration `20260730_0009_character_handle_uniqueness`: it performs a data read/assignment that is unavailable in offline mode. The production migration container runs online, so this is not proof that `alembic upgrade head` will fail there; it must nevertheless be run once against a recent staging/backup-restored database before release.
3. Browser E2E flows were only discovered, not executed, because no approved running application was available and this audit must not start one. Production OAuth, storage, auto-post scheduler, cancellation/refund, and IAP calls therefore remain unverified end-to-end.

## Lightsail release environment

Create a server-only `.env.prod` with the actual production values; keep it outside Git and set `PROD_ENV_FILE` to its absolute path when deploying. At a minimum, set these explicitly:

```dotenv
DATABASE_URL=postgresql+asyncpg://...
FRONTEND_ORIGINS=https://your-web-origin.example
FRONTEND_REDIRECT_URL=https://your-web-origin.example
AUTH_SECRET_KEY=<stable-high-entropy-secret>
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax

MONOGPT_GEMINI_API_KEY=<server-secret>
MONOGPT_GEMINI_BASE_URL=https://monogpt.kr/api/monorouter/v1/gemini
MONOGPT_GEMINI_MODEL_FAST=gemini-3.6-flash
MONOGPT_GEMINI_MODEL_GOOD=gemini-3.1-pro-preview
MONOGPT_GEMINI_TIMEOUT_MS=60000

AUTO_POST_SCHEDULER_ENABLED=true
AUTO_POST_POLL_SECONDS=30
AUTO_POST_BATCH_SIZE=10
AUTO_POST_DEFAULT_INTERVAL_SECONDS=21600

TERMS_VERSION=<published-terms-version>
MODERATION_API_KEY=<moderation-secret>
MODERATION_ACTOR=<service-actor-name>
```

The model names matter: application defaults still point at Gemini 2.5 if the two `MONOGPT_GEMINI_MODEL_*` values are absent. Omitting them in Lightsail would make the live cost/quality behaviour differ from this change set.

For production media, also supply all `S3_*` values and verify the bucket policy/CORS for only the deployed web origin. For Google/Apple sign-in, supply their OAuth and encryption variables and register `https://<api-domain>/api/auth/google/callback` and `https://<api-domain>/api/auth/apple/callback` exactly. The Vite values (`VITE_API_BASE_URL`, `VITE_LEGAL_BASE_URL`) must be present at frontend build time, not only in the backend container environment.

Keep `TOSS_IAP_ENABLED=false` and `PURCHASE_ENABLED=false` until the Toss console, mTLS certificate/key mount, SKU setup, and reconciliation conditions are ready. If enabling Toss, set `TOSS_MTLS_SECRETS_DIR` to an absolute host directory containing the cert/key expected by `docker-compose.prod.yml`; environment variables alone do not provide the mTLS files.

## Deployment order

1. Fix the duplicate `.env.example` keys or build `.env.prod` manually without duplicates.
2. Back up the production database and run `alembic upgrade head` online against staging (or a restored copy).
3. Build the frontend with the production Vite variables, deploy `.env.prod` and Toss secret files on Lightsail, and ensure the external Docker network `levelup-net` exists.
4. Deploy the migration service, then backend; confirm `/health`, scheduler logs, one credit-deducted feed generation, duplicate/refund behaviour, and a stop/change routine action.
5. Run the authenticated browser smoke/E2E suite against the running deployment before enabling purchases.

## Decision

The code-level commit gate is green. Production deployment is **not release-green** until the duplicate production-template values are resolved and an online migration rehearsal succeeds.
