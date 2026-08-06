---
title: Native safe-area QA
author: black (black@ashwoodfriends.com)
created: 2026-07-24
updated: 2026-07-24
version: 1.0.0
status: complete
---

# Native safe-area QA

- Date: 2026-07-24
- Android: running emulator (`emulator-5554`)
- iOS: iPhone 17 Pro Max Simulator (`iOS 26.3`)
- Package: `app.instarcharacterbot.alive`
- Status: PASSED

## Root cause

The app opts into an edge-to-edge viewport with `viewport-fit=cover`, but the
native shell did not consume either iOS `env(safe-area-inset-*)` values or the
`--safe-area-inset-*` values injected by Capacitor SystemBars on Android.

## Fix

- The shared `.al-phone` shell now applies all four safe-area insets as padding.
- Capacitor SystemBars explicitly exposes Android insets through CSS variables.
- iOS `contentInset` is `never`, so responsive CSS is the single owner of
  safe-area layout instead of stacking native and web insets.
- System bar content uses the light-on-dark style.

## Verification

- Android debug build installed and launched with the account bar below the
  status bar and white system icons.
- iOS debug build installed and launched with the account bar below the Dynamic
  Island and status bar.
- Existing authenticated sessions and character data remained available on both
  platforms.
- Frontend domain tests: 70 passed.
- Frontend type check: passed.

## Evidence

- `android-safe-area-before-2026-07-24.png`
- `android-safe-area-after-2026-07-24.png`
- `ios-safe-area-before-2026-07-24.png`
- `ios-safe-area-after-2026-07-24.png`
- `ios-safe-area-responsive-after-2026-07-24.png`
