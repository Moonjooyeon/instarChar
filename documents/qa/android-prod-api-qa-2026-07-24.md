# Android production API QA

- Date: 2026-07-24
- Device: `emulator-5554` (`sdk_gphone64_arm64`)
- Package: `app.instarcharacterbot.alive`
- API: `https://alive.imagebgremover.net/api`
- Health score: 100/100
- Status: PASSED

## Verified

- Fresh Capacitor web build completed.
- Fresh Android debug APK build completed.
- APK reinstall and cold start completed.
- Login screen rendered without an app crash.
- The app called `GET /api/auth/me` through the production API.
- The unauthenticated request returned the expected `401`.
- Google OAuth start returned `307`.
- Google authentication and the backend callback completed with `307`.
- The callback returned to `app.instarcharacterbot.alive://oauth/callback`.
- The app exchanged the one-time code through `POST /api/auth/native/exchange`.
- Capacitor stored the secure `HttpOnly` production session cookie.
- The authenticated app advanced to the character onboarding screen.

## Resolved issue

The original flow redirected Chrome to `https://localhost`, so the browser session
could not return to the Android WebView. The native flow now sends only a
short-lived, single-use code through the app scheme. The app exchanges that code
over HTTPS and receives the session cookie through Capacitor's native HTTP stack.

## Evidence

- `android-alive-prod-api-2026-07-24.png`: fresh-build login screen
- `android-google-oauth-2026-07-24.png`: failed `https://localhost` redirect
- `android-after-google-oauth-back-2026-07-24.png`: loading state after app return
- `android-oauth-relaunch-result-2026-07-24.png`: session missing after relaunch
- `android-native-oauth-deeplink-2026-07-24.png`: native scheme routing verification
- `android-google-oauth-native-flow-2026-07-24.png`: app loading after OAuth return
- `android-google-oauth-success-2026-07-24.png`: authenticated onboarding screen
