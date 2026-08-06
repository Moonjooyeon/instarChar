# Toss/Slash Adoption Guide

Use official Toss Frontend and Slash projects as patterns, not as a mandate to add dependencies.

## Candidates

| Project | ALIVE fit | Decision |
|---|---|---|
| [`overlay-kit`](https://github.com/toss/overlay-kit) | Promise-returning dialogs, sheets, and confirmation flows | Consider for new overlay-heavy flows; do not migrate all existing modals at once |
| [`@use-funnel`](https://github.com/toss/use-funnel) | Typed onboarding and character-creation steps with back/forward history | Strong candidate for a future setup-flow migration; first write a behavior-preserving spike |
| [`suspensive`](https://github.com/toss/suspensive) | Suspense/ErrorBoundary/async UI boundaries | Consider only when async boundaries become a repeated problem |
| [`react-simplikit`](https://github.com/toss/react-simplikit) | Small React utilities | Adopt individual utilities only when they remove proven repeated code |
| [`es-toolkit`](https://github.com/toss/es-toolkit) | Modern tree-shakeable general utilities | Consider for repeated utility needs; do not replace working domain helpers mechanically |
| [`es-hangul`](https://github.com/toss/es-hangul) | Korean Hangul parsing and particle utilities | Evaluate against existing `hasBatchim`/`josa` behavior with compatibility tests first |
| [`h6s`](https://github.com/toss/h6s) | Headless production UI primitives | Evaluate only if ALIVE needs a larger accessibility-focused primitive layer |

## Adoption gate

Before adding a dependency:

1. Identify the repeated problem and current local implementations.
2. Confirm the library supports the current React/Vite/Capacitor target.
3. Compare bundle, API, accessibility, maintenance, and migration cost.
4. Add one isolated usage with tests.
5. Record the decision in `documents/reports/` or `documents/specs/` when it changes architecture.

Do not add a library because it is associated with Toss. Add it only when its abstraction is a better fit for a demonstrated ALIVE problem.
