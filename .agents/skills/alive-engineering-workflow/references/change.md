# Change Mode

Use this mode for implementation, bug fixes, refactors, API changes, migrations, and UI behavior changes.

## Behavioral contract

- State assumptions before editing. Ask when ambiguity would materially change behavior.
- Implement the minimum code that satisfies the request.
- Do not add speculative features, abstractions, or unrelated cleanup.
- Touch only files required by the request and remove only orphans created by the change.
- Add or update the smallest relevant regression test.
- Keep functions single-purpose and honor the repository's type, async, and line-length rules.

## ALIVE boundaries

- Keep server authority for authorization, handles, revisions, AI usage, media references, and durable state.
- Keep provider keys and provider calls on the backend; validate structured AI output before persistence.
- Treat `asset:<UUID>` as the new media reference contract; do not reintroduce Base64 persistence.
- For deletes, confirm server success before clearing local state and cover empty-state rehydration.
- For optimistic social actions, handle rejection, network failure, and rollback explicitly.
- Preserve applied PostgreSQL migrations; add a new migration for schema changes.
- Keep prompts, relationship rules, and memory behavior versionable.

## Verification

Run the smallest complete gate from `verification-matrix.md`. If a required environment is missing, stop claiming success at the highest proven level and give the user the exact next command or manual check.
