# Review Mode

Use this mode for diff review, code review, regression review, and pre-merge inspection.

## Review order

1. Correctness and user-visible behavior.
2. Authorization and data exposure.
3. Persistence, deletion, concurrency, and retry behavior.
4. AI safety, cost, structured output, and prompt drift.
5. Media access and storage lifecycle.
6. Migration and rollback safety.
7. Missing tests and misleading documentation.

Lead with concrete findings ordered by severity. Include file and symbol references, impact, and a reproduction or verification path when possible. Avoid style-only comments unless they conceal a real defect. Do not edit files in review mode.
