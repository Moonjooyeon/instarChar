---
title: Project Structure
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-06-26
version: 3.1.0
status: approved
---

# Project Structure

This file describes the current target code structure for alive.

alive is an application where user-created characters operate their own SNS-like presence. The backend is Python + FastAPI with PostgreSQL. The frontend is a React + Vite mobile app surface.

```text
.
├── android/                   # Capacitor Android project
├── api/                       # Existing Vercel/serverless API surface
├── backend/                   # FastAPI backend application
├── capacitor.config.json      # Capacitor app configuration
├── db/                        # PostgreSQL Docker image and SQL files
├── documents/
│   ├── plans/                 # Work plans and migration plans
│   └── references/            # Project reference documentation
├── ios/                       # Capacitor iOS project
├── public/                    # Static frontend assets
├── src/                       # React + Vite frontend source
├── tests/                     # Frontend/e2e-oriented tests
├── docker-compose.local.yaml  # Local development compose file
├── package.json               # Frontend package manifest
├── playwright.config.js       # Playwright config
├── vite.config.js             # Vite config
└── README.md
```

Detailed structures:

- Frontend: [`frontend.md`](frontend.md)
- Backend: [`backend.md`](backend.md)

Backend-specific runtime files:

- Tech stack: [`../tech-stacks/backend.md`](../tech-stacks/backend.md)
- Guidelines: [`../guidelines/python+fastapi.md`](../guidelines/python+fastapi.md)
