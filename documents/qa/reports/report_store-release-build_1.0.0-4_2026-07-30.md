---
title: Store release build report — 1.0.0 (4)
author: black (black@ashwoodfriends.com)
created: 2026-07-30
updated: 2026-07-30
version: 1.0.0
status: complete
---

# Store release build report — 1.0.0 (4)

## Release metadata

- Version: `1.0.0`
- Build number / version code: `4`
- iOS bundle identifier: `com.ashwoodfriends.alive`
- Apple team: `LRLSLC2RMQ`

## Verification

- Frontend type check: passed
- Frontend domain tests: 90 passed
- Frontend production build: passed
- Playwright discovery: 9 tests detected
- Backend compile check: passed
- Backend tests: 165 passed
- Capacitor iOS/Android sync: passed

## Android

- Artifact: `dist/store/android/alive-1.0.0-4.aab`
- Size: 7,249,454 bytes
- SHA-256: `524a6d56bcb41aa0879bd77412212e418486809c267e57b693da01ed05a47ca0`
- Signing verification: passed
- Signing certificate SHA-256: `5B:03:40:AF:94:2B:35:F4:30:01:44:CA:34:0E:CD:0E:07:69:D6:62:9E:3F:23:45:48:A1:CD:53:60:35:A1:9A`

## iOS

- Archive: `ios/build/ALIVE-1.0.0-4.xcarchive`
- Exported IPA: `dist/store/ios/export-1.0.0-4/App.ipa`
- Size: 6,993,336 bytes
- SHA-256: `866ed4fb369cd21ec7eebf5a48d4f80b48f81f891abcd83deeade21de425e7cc`
- Architecture: arm64
- Distribution certificate: Cloud Managed Apple Distribution
- App Store provisioning profile: verified
- App Store Connect upload: blocked
- Apple response: HTTP 403, `FORBIDDEN_ERROR.ROLE_NOT_VALID`

The archive, export, distribution signing, and IPA validation succeeded. Upload stopped when App Store Connect attempted to create the build because the Apple account currently selected in Xcode does not have the required app role or permission.

After an Account Holder or Admin grants this account an App Manager or Developer role with access to ALIVE, retry:

```sh
xcodebuild -exportArchive \
  -archivePath ios/build/ALIVE-1.0.0-4.xcarchive \
  -exportPath dist/store/ios/upload-1.0.0-4 \
  -exportOptionsPlist ios/AppStoreExportOptions.plist \
  -allowProvisioningUpdates
```
