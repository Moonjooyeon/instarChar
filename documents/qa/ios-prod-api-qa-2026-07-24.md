# iOS production API QA

- Date: 2026-07-24
- Device: iPhone 17 Pro Max Simulator (`iOS 26.3`)
- Device ID: `FC5F5AF6-D842-4E53-BCE1-1D0E3A2AC3BA`
- Package: `app.instarcharacterbot.alive`
- API: `https://alive.imagebgremover.net/api`
- Status: PASSED

## Verified

- Fresh Capacitor production build completed.
- Fresh iOS Simulator build completed.
- App installation and cold start completed.
- The app called the production authentication API.
- Google authentication and the backend callback completed.
- Safari recognized `app.instarcharacterbot.alive://oauth/callback` and returned to ALIVE.
- `POST /api/auth/native/exchange` returned `204`.
- `GET /api/auth/me` returned `200`.
- The one-time OAuth code was marked as used.
- The secure session cookie was present in both iOS app cookie files.
- Reinstalling and relaunching the app preserved the authenticated session.
- The authenticated character list loaded from the production API.
- Korean text and the app's star symbol render correctly.

## Resolved: authenticated native API requests

The original WebView request sent no session cookie because WebKit treated
`capacitor://localhost` to `alive.imagebgremover.net` as cross-site traffic.
Capacitor native HTTP is now enabled globally, so native API requests use the
native cookie store. Google OAuth completes with `POST /api/auth/native/exchange`
returning `204`, followed by `GET /api/auth/me` returning `200`.

## Resolved: Korean glyph rendering

The iOS Simulator WebView did not provide a usable Korean fallback for the
unbundled font stack. Pretendard Variable's dynamic Korean subsets are now part
of the frontend bundle and are the primary app font. The unsupported `✶`
decorative character was replaced with the bundled font's supported `★`.

## Evidence

- `ios-prod-api-login-2026-07-24.png`: fresh-build login screen and missing glyphs
- `ios-google-oauth-session-failed-2026-07-24.png`: OAuth return with unauthorized session
- `ios-oauth-relaunch-result-2026-07-24.png`: session missing after relaunch
- `ios-native-http-auth-success-2026-07-24.png`: authenticated native HTTP session
- `ios-native-http-font-success-2026-07-24.png`: final authenticated screen with Korean glyphs
