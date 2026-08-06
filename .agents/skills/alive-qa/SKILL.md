---
name: alive-qa
description: Use for ALIVE verification of user flows, browser behavior, test selection, smoke checks, accessibility observations, or evidence collection. Do not use as a substitute for diagnosing or fixing a bug.
---

# ALIVE QA

Use this skill to choose the smallest reliable verification surface. Read [verification-routes.md](references/verification-routes.md) and use the browser skill only when an already-running app process is available.

1. State the user-visible contract and risk.
2. Select the narrowest check that can prove it: domain test, component check, API/backend test, build, Playwright, or browser observation.
3. Run only allowed existing commands and inspect the actual result.
4. For Playwright or browser work, record base URL, route, fixture/auth state, and observed result.
5. Report passed, failed, not run, and not applicable separately.

Do not start frontend or backend app processes. Do not silently treat mocked E2E or a successful build as proof of real OAuth, S3, Gemini, scheduler, database, or native-shell behavior. If a failure needs diagnosis, hand it to `$alive-debugging`.

Return: contract, checks selected, evidence, result by gate, and remaining unverified behavior.
