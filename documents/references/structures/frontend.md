---
title: Frontend Structure
author: black (black@ashwoodfriends.com)
created: 2026-05-07
updated: 2026-05-07
version: 3.0.0
status: approved
---

# frontend.md

This file describes the target React+Vite frontend structure for Novelvity.

```
front/
├── Dockerfile
├── index.html
├── package-lock.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── index.css
    ├── main.tsx
    ├── types.ts
    ├── vite-env.d.ts
    ├── api/
    |   ├── ai.ts
    |   ├── auth.ts
    |   ├── chapters.ts
    |   ├── characters.ts
    |   ├── client.ts
    |   ├── ideas.ts
    |   ├── novels.ts
    |   ├── plotCards.ts
    |   └── worldItems.ts
    ├── assets/
    |   ├── logo-icon.svg
    |   └── logo.svg
    ├── components/
    |   ├── GoogleLoginButton.tsx
    |   └── Sidebar.tsx
    ├── context/
    |   ├── AuthContext.tsx
    |   └── ThemeContext.tsx
    ├── data/
    |   └── mockData.ts
    ├── utils/
    |   └── time.ts
    └── views/
        ├── AIGuideView.tsx
        ├── ArchiveView.tsx
        ├── CharactersView.tsx
        ├── EditorView.tsx
        ├── HomeView.tsx
        ├── IdeasView.tsx
        ├── LandingView.tsx
        ├── NovelsView.tsx
        ├── PlotView.tsx
        ├── SettingsView.tsx
        ├── StatsView.tsx
        └── WorldView.tsx
```
