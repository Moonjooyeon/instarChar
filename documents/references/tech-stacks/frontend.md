---
title: Frontend Tech Stack
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-08-12
version: 2.3.0
status: approved
---

# Tech Stack

alive's frontend is currently a TypeScript React app built with Vite and wrapped with Capacitor for iOS and Android mobile app shells.

## Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | `18.3.1` | UI runtime |
| `react-dom` | `18.3.1` | Browser DOM renderer |
| `@apps-in-toss/web-framework` | `2.10.8` | Apps in Toss bridge, login, environment, and IAP APIs; pinned to the prior release SDK on 2026-08-13 |

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@vitejs/plugin-react` | `6.0.5` | React support for Vite |
| `vite` | `8.2.1` | Frontend dev server and build tool |
| `@types/react` | `18.3.28` | React TypeScript declarations; added 2026-08-12 |
| `@types/react-dom` | `18.3.7` | React DOM TypeScript declarations; added 2026-08-12 |
| `@capacitor/cli` | `^8.4.0` | Capacitor project sync and native app commands |
| `@capacitor/core` | `^8.4.0` | Capacitor runtime bridge |
| `@capacitor/ios` | `^8.4.0` | iOS native shell integration |
| `@capacitor/android` | `^8.4.0` | Android native shell integration |
| `@playwright/test` | `^1.61.0` | Frontend end-to-end tests |
| `tailwindcss` | `^4.3.3` | Utility-first styling and CSS design-token generation; added 2026-08-05 |
| `@tailwindcss/vite` | `^4.3.3` | Tailwind CSS integration for Vite; added 2026-08-05 |

## Source Shape

- The app entry point is `src/main.tsx`.
- The main React surface is split across `src/app`, `src/features`, `src/hooks`, and `src/domain`.
- Shared app constants and helper functions live in `src/domain/app/aliveCore.ts`.
- CSS enters through `src/styles/index.css`; theme tokens live in `src/styles/theme.css` and unmigrated rules remain temporarily in `src/styles/legacy.css`.
- AI generation requests are routed through the FastAPI `/api/ai/generate` endpoint.

## Not Currently Used

- Lucide React is not installed.

## Removed Runtime Dependencies

`@supabase/supabase-js` and `src/supabaseClient.js` have been removed from the frontend runtime. Supabase schema files remain only as legacy migration references.
