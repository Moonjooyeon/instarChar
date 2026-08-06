# AI evaluation reference

## Minimum evaluation matrix

| Dimension | Evidence to seek |
|---|---|
| Contract | Required fields, valid enum/JSON shape, empty response behavior |
| Character | Voice, worldview, relationships, continuity, anti-repeat behavior |
| Safety | Prompt injection, disallowed content, privacy, moderation/fallback |
| Authority | Server-owned character, user, quota, and persistence decisions |
| Reliability | Timeout, provider error, malformed output, retry, cancellation |
| Cost | Model, token limits, daily/monthly usage, duplicate generation prevention |
| UX | Loading, retry, partial failure, optimistic rollback, latency expectations |

## Fixture practice

Keep fixtures small and representative. Include at least one normal case and one failure/boundary case for each changed branch. Store stable evaluation artifacts under `documents/reports/` when the task produces a report; keep code fixtures beside the relevant test layer.

Record:

- flow and input fixture;
- model/provider and prompt/config revision;
- expected schema or behavioral rubric;
- raw failure category without unnecessary personal data;
- pass/fail and whether the result is deterministic or qualitative.

Do not require exact natural-language equality for creative output unless the contract is explicitly structured. Prefer schema assertions, safety assertions, invariant checks, and a small human rubric.
