---
name: alive-engineering-workflow
description: Use for ALIVE project-level analysis, planning, cross-layer implementation, review, release-readiness, and evidence handoff across the React/Vite frontend, FastAPI/PostgreSQL backend, AI generation, media storage, and Capacitor shells. Route isolated frontend architecture, discovery, debugging, QA, or AI evaluation to its focused skill.
---

# ALIVE Engineering Workflow

Keep the main agent responsible for scope, decisions, and final communication. Use narrow custom agents only for bounded exploration, implementation, review, or release checks. Load only the reference for the current mode; do not load every reference for every task.

## Classify the task

Choose one primary mode before acting:

- **Analyze**: inspect and report; do not edit application code.
- **Plan**: define assumptions, scope, success criteria, and verification; save a Korean plan under `documents/plans/`.
- **Change**: implement the requested behavior with the smallest defensible diff.
- **Review**: inspect correctness, security, regressions, and test gaps; do not edit unless requested.
- **Release**: verify build, backend, migration, environment, integration, and native-release gates; do not start app processes.

If a request mixes modes, complete analysis and planning before editing.

Route specialized work to its focused skill instead of expanding this workflow:

- Ambiguous product idea, requirements, or scope -> `$alive-discovery`
- React/Vite component, folder, state, overlay, or UI architecture -> `$alive-frontend-architecture`
- Bug, regression, or unexpected failure -> `$alive-debugging`
- User-flow, browser, test selection, or QA evidence -> `$alive-qa`
- Prompt, generation, character consistency, AI safety, cost, or latency -> `$alive-ai-quality`

Use this skill as the project-level coordinator; focused skills supply only their domain rules.

## Match process to risk

- **S**: one local, low-risk edit; inspect, change, and run the smallest relevant check.
- **M**: one feature or several related files; state scope, add focused tests, and review the diff.
- **L**: cross-layer, persistence, auth, AI, media, or architecture change; plan first and use a separate review pass.
- **XL**: migration, release, security, or destructive behavior; require explicit release gates and rollback evidence.

Do not apply an L/XL process to an S task merely for ceremony.

## Adopted external patterns

- [Superpowers](https://github.com/obra/superpowers): brainstorm/plan, focused execution, review, and verification; adapted to ALIVE's risk levels.
- [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills): progressive disclosure and task-specific loading; never load every reference by default.
- [Toss Slash](https://www.slash.page/): declarative, typed abstractions are candidates only when ALIVE has a demonstrated repeated problem.

## Selective reference loading

After classification, read only the matching file:

| Mode | Read |
|---|---|
| Analyze | [analysis.md](references/analysis.md) |
| Plan | [planning.md](references/planning.md) |
| Change | [change.md](references/change.md) and the relevant rows in [verification-matrix.md](references/verification-matrix.md) |
| Review | [review.md](references/review.md) and the relevant rows in [verification-matrix.md](references/verification-matrix.md) |
| Release | [release.md](references/release.md) and [verification-matrix.md](references/verification-matrix.md) |

Read [handoff-template.md](references/handoff-template.md) only when creating a plan, report, review, or final handoff artifact.

## Universal workflow

1. Read the root `AGENTS.md` and `documents/references/README.md` when they are not already in context.
2. Inspect the real execution path with `rg`, targeted file reads, and current tests.
3. State assumptions, scope, non-goals, and success criteria before edits.
4. Preserve user changes and unrelated files.
5. Never start frontend or backend app processes in this repository.
6. Report passed, failed, not run, and not applicable verification separately.

For cross-layer changes, map:

```text
user action -> UI route -> hook/domain state -> API client -> FastAPI route
-> service/repository -> database/storage/provider -> response adapter -> UI state
```

Do not claim production readiness from a build pass alone. Do not claim completion when a required verification gate was skipped.
