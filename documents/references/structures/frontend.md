---
title: Frontend Structure
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-08-05
version: 3.4.0
status: approved
---

# Frontend Structure

This file describes the current React + Vite frontend workspace for alive.

```text
apps/frontend/
├── index.html
├── package.json
├── playwright.config.js
├── tsconfig.domain-tests.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   ├── icon.svg
│   └── manifest.webmanifest
├── tests/
│   ├── domain/
│   └── e2e/
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── api/
    │   ├── auth.ts
    │   ├── characters.ts
    │   ├── client.ts
    │   ├── discover.ts
    │   ├── dm.ts
    │   ├── generate.ts
    │   ├── postLikes.ts
    │   ├── profiles.ts
    │   └── structured.ts
    ├── app/
    │   ├── dm/
    │   ├── feed/
    │   └── modals/
    ├── components/
    │   └── ui/
    ├── domain/
    │   ├── app/
    │   ├── discover/
    │   ├── dm/
    │   ├── feed/
    │   ├── relationships/
    │   └── sessionBootstrap.ts
    ├── features/
    │   ├── auth/
    │   ├── character-setup/
    │   ├── discover/
    │   ├── dm/
    │   ├── home/
    │   └── relationships/
    ├── hooks/
    ├── styles/
    │   ├── index.css
    │   ├── legacy.css
    │   ├── theme.css
    │   └── screens/
    └── types/
```

## Layers

| Layer | Path | Responsibility |
|-------|------|----------------|
| Entry | `apps/frontend/src/main.tsx` | React DOM bootstrap |
| App shell | `apps/frontend/src/app/` | Route-level composition, feed/DM panels, shared modals |
| Features | `apps/frontend/src/features/` | Screen-level UI grouped by product area |
| Hooks | `apps/frontend/src/hooks/` | Stateful app behavior and persistence orchestration |
| Domain | `apps/frontend/src/domain/` | Pure helpers for app state, feed, DM, discover, relationships, and session state |
| API client | `apps/frontend/src/api/` | FastAPI fetch boundary and response adapters |
| Shared UI | `apps/frontend/src/components/ui/` | Small reusable UI controls |
| Styles | `apps/frontend/src/styles/` | Tailwind entry point, theme tokens, temporary legacy CSS, and screen migration layers |
| Tests | `apps/frontend/tests/` | Domain unit tests and Playwright E2E tests |

## Character Handle Flow

- `textUtils.ts` mirrors the backend lowercase, character-set, length, and exact reserved-word policy.
- `useCharacterHandleAvailability.ts` debounces advisory availability checks and ignores stale responses.
- Character creation and editing call `PUT /api/characters/{source_account_id}` before changing local state.
- A new-character draft keeps one stable source ID across failed retries.
- `CHARACTER_HANDLE_TAKEN` keeps the confirmation screen and its inputs intact.
- Structured hydration gives the top-level database handle priority over cached JSON snapshots.

## Verification

```bash
npm run typecheck
npm run test:domain
npm run build
```

The current domain suite contains 121 passing tests. Playwright handle scenarios require an already-running app at `ALIVE_E2E_BASE_URL` (default `http://127.0.0.1:5179`).

## Build Output

Vite writes the frontend build to `apps/frontend/dist`.
Capacitor and Vercel both use that directory as the active web artifact.
