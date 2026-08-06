---
name: alive-debugging
description: Use for ALIVE bugs, regressions, failed tests, broken user flows, or unexpected runtime behavior. Reproduce and isolate the cause before proposing or implementing a fix; do not use for ordinary feature planning.
---

# ALIVE Debugging

Use this skill as the diagnostic owner. Read [systematic-debugging.md](references/systematic-debugging.md), then hand a confirmed cause to the engineering change workflow or implementer.

1. Capture the exact symptom, expected behavior, environment, and first failing evidence.
2. Reproduce with the smallest available test, existing running process, or focused inspection.
3. Trace the real path across UI, hook/domain state, API, service, persistence, and provider only as far as evidence requires.
4. Form one falsifiable root-cause hypothesis at a time and test it.
5. Add or identify a regression check before applying the smallest fix.
6. Verify the fix and distinguish passed, failed, not run, and still-unverified checks.

Never start frontend or backend processes in this repository. If the failure cannot be reproduced, report evidence, narrowed hypotheses, and the next safe observation instead of making a speculative fix.

Return: symptom, reproduction, root cause, changed boundary, regression check, verification, and remaining uncertainty.
