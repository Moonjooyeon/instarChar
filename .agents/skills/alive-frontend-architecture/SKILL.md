---
name: alive-frontend-architecture
description: Use for ALIVE React/Vite frontend architecture, component design, folder placement, state ownership, overlay flows, onboarding funnels, UI refactors, and frontend code review. Apply when deciding where a component, hook, type, style, test, or feature should live; do not use for backend-only work.
---

# ALIVE Frontend Architecture

Use ALIVE's existing feature-based structure and apply Toss-inspired principles selectively. Optimize for changeability and readability, not for copying a library or maximizing abstraction.

## Selective reference loading

Read only the reference needed for the request:

| Question | Read |
|---|---|
| Where should files/components live? | [folder-rules.md](references/folder-rules.md) |
| How should a component be designed? | [component-rules.md](references/component-rules.md) |
| Where should state and data fetching live? | [state-rules.md](references/state-rules.md) |
| Should a Toss/Slash library be adopted? | [slash-adoption.md](references/slash-adoption.md) |

## Universal rules

1. Identify the owner of the behavior before creating a file.
2. Keep screen composition, feature behavior, domain logic, API access, and shared UI separate.
3. Prefer composition and focused hooks over prop drilling or a mega-context.
4. Do not abstract two similar components until their behavior is truly shared.
5. Keep changes local to the feature unless reuse is demonstrated.
6. Add a test at the layer where the behavior lives.
7. Do not perform a broad migration just to make the folder tree look cleaner.

## Existing ALIVE fit

- `src/features/`: product-area screens and feature-local components.
- `src/app/`: route composition and app-level orchestration.
- `src/components/ui/`: genuinely reusable visual primitives.
- `src/hooks/`: stateful behavior and persistence orchestration.
- `src/domain/`: pure, framework-independent rules and transformations.
- `src/api/`: FastAPI boundary and response adapters.
- `useAliveAppController.tsx`: existing composition root; keep it for wiring and navigation, and put new feature behavior in focused hooks or feature modules.

When a new rule conflicts with existing code, document the boundary and migrate incrementally instead of mixing a new architecture into an unrelated change.
