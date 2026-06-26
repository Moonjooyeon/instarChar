---
title: Frontend Tech Stack
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-06-26
version: 2.1.0
status: approved
---

# Tech Stack

alive's frontend is currently a JavaScript React app built with Vite and wrapped with Capacitor for iOS and Android mobile app shells.

## Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | `^18.3.1` | UI runtime |
| `react-dom` | `^18.3.1` | Browser DOM renderer |

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@vitejs/plugin-react` | `^4.3.1` | React support for Vite |
| `vite` | `^5.4.0` | Frontend dev server and build tool |
| `@capacitor/cli` | `^8.4.0` | Capacitor project sync and native app commands |
| `@capacitor/core` | `^8.4.0` | Capacitor runtime bridge |
| `@capacitor/ios` | `^8.4.0` | iOS native shell integration |
| `@capacitor/android` | `^8.4.0` | Android native shell integration |
| `@playwright/test` | `^1.61.0` | Frontend end-to-end tests |

## Source Shape

- The app entry point is `src/main.jsx`.
- The main React surface is `src/App.jsx`.
- Shared app constants and helper functions live in `src/aliveCore.js`.
- CSS is currently defined as a JavaScript string in `src/appStyles.js` and injected by the app.
- The Vite config includes a local `/api/generate` development middleware in `vite.config.js`.

## Not Currently Used

- TypeScript is not configured in the current frontend source.
- Tailwind CSS is not installed or configured.
- Lucide React is not installed.

## Planned Removal

`@supabase/supabase-js` and `src/supabaseClient.js` are still present in the current frontend, but Supabase-related code is scheduled for removal as the project moves to the FastAPI and PostgreSQL backend.
