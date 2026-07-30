# Character Handle Uniqueness Verification

Date: 2026-07-30

## Completed automated checks

| Check | Result |
|---|---|
| Python compileall | Passed |
| Backend pytest | 164 passed |
| Alembic graph | `20260730_0009 (head)` |
| Frontend TypeScript | Passed |
| Frontend domain tests | 90 passed |
| Frontend production build | Passed |
| Playwright discovery | 9 tests collected |

## Environment-dependent checks

No project PostgreSQL or frontend process was already running. Repository rules prohibit starting those processes during this task, so migration integration and browser execution remain deployment gates.

Before deployment:

1. Export `characters(id, owner_id, source_account_id, handle, created_at)` to a recoverable CSV.
2. Run the 0009 migration in a staging PostgreSQL database.
3. Confirm `characters.handle` has no duplicates, blanks, reserved values, or format violations.
4. Verify shared-character and follower snapshots contain the reassigned handles.
5. In two concurrent database sessions, attempt the same new handle and confirm only one transaction commits.
6. Run `npm run test:e2e` against the already-running staging app.
7. Smoke-test availability, create, unchanged edit, rename, 409 conflict, deletion, and immediate handle reuse.

## Implemented commits

| Phase | Commit |
|---|---|
| Policy and plan | `4335043` |
| Rules and database migration | `5fa27c1` |
| Atomic backend API | `b52b008` |
| Legacy and shared compatibility | `998eb14` |
| Frontend validation and persistence | `d7327b5` |
