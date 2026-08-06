# Systematic debugging reference

## Evidence loop

Keep a short ledger:

| Item | Record |
|---|---|
| Symptom | What the user or test observes |
| Expected | The contract or intended state |
| Reproduction | Exact input, route, fixture, or command |
| Boundary | First layer where actual state diverges |
| Hypothesis | One cause that can be disproved |
| Check | Observation that confirms or rejects it |

Prefer a minimal reproducer over broad logging. Read the caller and the callee before changing either.

## ALIVE boundaries

- UI-only mismatch: inspect component props, render branches, and local state.
- State mismatch: inspect hook ownership, derived values, persistence hydration, and stale async responses.
- API mismatch: inspect request shape, response adapter, error mapping, and authorization.
- Persistence mismatch: inspect repository ownership, revision/uniqueness rules, migration state, and delete behavior.
- AI mismatch: inspect prompt version, structured output parsing, fallback, usage limits, and server authority.
- Media mismatch: inspect asset ID/URL boundaries, signed access, upload completion, and cleanup.

## Fix discipline

- Change the first proven cause, not every suspicious line.
- Preserve unrelated working behavior.
- A bug fix without a regression check is incomplete unless the failure is genuinely untestable; state why.
- If the cause is architectural, stop after the minimal safe mitigation and make the larger change a separate plan.
