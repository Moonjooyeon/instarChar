---
name: alive-ai-quality
description: Use for ALIVE AI generation, prompt changes, character voice or consistency, structured output, safety, usage limits, latency, cost, or AI regression evaluation. Do not use for generic UI or backend work without AI behavior.
---

# ALIVE AI Quality

Use this skill whenever a change can alter generated character behavior or AI operating cost. Read [ai-evaluation.md](references/ai-evaluation.md). Keep generation server-authoritative and avoid judging a prompt from one lucky sample.

1. Identify the generation flow, user-visible contract, prompt/config version, model, fallback, and structured output schema.
2. Define a small fixture set covering normal, empty, malformed, adversarial, repeated, and boundary inputs relevant to the flow.
3. Evaluate correctness, character consistency, safety, parsing, usage limits, latency, and cost separately.
4. Verify that client input cannot bypass backend authorization, quota, moderation, or persistence rules.
5. Add or update focused fixtures/tests before changing prompt or parser behavior when feasible.
6. Record model/config and distinguish deterministic test evidence from qualitative sample review.

If no evaluation harness exists, use the smallest fixture-based check and document the gap; do not introduce a large framework as part of an unrelated prompt change. Hand non-AI failures to `$alive-debugging` and cross-layer verification to `$alive-qa`.

Return: flow and contract, fixture coverage, results by quality dimension, safety/cost risks, changed prompt/schema boundary, and remaining uncertainty.
