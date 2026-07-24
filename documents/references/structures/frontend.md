---
title: Frontend Structure
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-07-24
version: 3.2.0
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
    ├── appStyles.ts
    ├── main.tsx
    ├── api/
    │   ├── auth.ts
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
| Tests | `apps/frontend/tests/` | Domain unit tests and Playwright E2E tests |

## Build Output

Vite writes the frontend build to `apps/frontend/dist`.
Capacitor and Vercel both use that directory as the active web artifact.
