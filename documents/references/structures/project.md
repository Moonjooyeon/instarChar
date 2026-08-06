---
title: Project Structure
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-08-06
version: 3.3.0
status: approved
---

# Project Structure

This file describes the current target code structure for alive.

alive is an application where user-created characters operate their own SNS-like presence. The backend is Python + FastAPI with PostgreSQL. The frontend is a React + Vite mobile app surface.

```text
.
├── android/                   # Capacitor Android project
├── apps/
│   └── frontend/              # React + Vite frontend workspace
├── backend/                   # FastAPI backend application
├── capacitor.config.json      # Capacitor app configuration
├── db/                        # PostgreSQL Docker image and SQL files
├── documents/
│   ├── README.md              # Work-document index and placement rules
│   ├── guides/                # Reusable store and release guides
│   ├── plans/                 # Work plans and migration plans
│   ├── specs/                 # Technical contracts and architecture specs
│   ├── reports/               # Analysis, review, and operations reports
│   ├── qa/                    # QA guides, reports, and raw evidence
│   └── references/            # Stable English project references
├── ios/                       # Capacitor iOS project
├── docker-compose.local.yaml  # Local development compose file
├── package.json               # npm workspace orchestrator
├── supabase-schema.sql        # Legacy Supabase schema reference
├── vercel.json                # Static frontend deployment config
└── README.md
```

The active frontend source, static assets, Vite config, and Playwright tests live under `apps/frontend/`.
The root `dist/` directory, when present locally, is an ignored legacy build artifact; Capacitor and Vercel use `apps/frontend/dist`.

Document indexes:

- [`../../README.md`](../../README.md)
- [`../../plans/README.md`](../../plans/README.md)
- [`../../specs/README.md`](../../specs/README.md)
- [`../../reports/README.md`](../../reports/README.md)
- [`../../qa/README.md`](../../qa/README.md)

Detailed structures:

- Frontend: [`frontend.md`](frontend.md)
- Backend: [`backend.md`](backend.md)

Backend-specific runtime files:

- Tech stack: [`../tech-stacks/backend.md`](../tech-stacks/backend.md)
- Guidelines: [`../guidelines/python+fastapi.md`](../guidelines/python+fastapi.md)
