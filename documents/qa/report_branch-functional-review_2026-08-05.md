# Current Branch Functional Review

- Branch: `style/mockups-design`
- HEAD: `dce5ebe feat: refine first character onboarding`
- Scope: committed branch delta plus the current unstaged and untracked UI work
- Review date: 2026-08-05

## Findings

## Resolution pass

The release-blocking and direct regression findings below were resolved without changing the intentional first-post feature gate:

- Synchronized the latest production bundle into Android and verified identical `index.html` hashes.
- Added visible first-post generation failure feedback with an explicit retry path.
- Restored the separate identity and personality drafts when returning from confirmation.
- Added vertical scroll fallback for keyboard-reduced creation screens.
- Resolved DM peer avatars from actual account/follow/discover data and added broken-image fallback.
- Increased the help-tour and post-management touch targets and adjusted tooltip spacing.
- Cleared all eight TypeScript errors found in the review.
- Added focused domain coverage for creation-draft persistence and E2E scenarios for draft restoration and generation failure.

The account-level help-tour sync remains device-local by design in this pass because changing it requires a backend data contract. The first-post gate also remains unchanged because the current product E2E contract explicitly requires it.

### P1 — The running Android app does not contain the current frontend bundle — resolved in source assets

`apps/frontend/dist/index.html` was built at 11:56, while `android/app/src/main/assets/public/index.html` is from 11:24 and has a different hash. The running emulator still renders the previous sticker glyphs and the old downward-opening post menu. The current source and `dist` contain the new local SVG icons and upward-opening menu, but those files have not been synchronized into the native shell.

Impact: source-level fixes can look complete while the APK still ships the old UI and the bottom-clipped management menu.

Evidence: [alive_branch_review.png](alive_branch_review.png)

### P1 — First-post generation failures have no visible feedback on the feed — resolved

`useAliveFeedGeneration.generatePost` closes the mood picker, writes failures to `saveStatus`, and then clears `loading`. The current UI only renders `saveStatus` in `HomeScreen`; the feed route does not render it. A failed first generation therefore returns to the first-post card without explaining what failed or offering an explicit retry.

Impact: users can interpret an API failure as an ignored tap or broken button.

### P1 — The branch is not type-clean — resolved

`npm run typecheck` fails with eight errors in `useAliveAppController.tsx`. These errors are outside the lines changed by the current UI work, so they appear pre-existing rather than introduced by this pass, but they still block a clean release check.

## P2 Findings

### Three-step creation fields do not survive a round trip through confirmation — resolved

`DumpScreen` keeps `identity` and `personality` only in local component state, while the shared `dump` value stores both fields joined by a newline. Returning from confirmation remounts the screen with the full joined text in `identity` and an empty `personality` field.

Impact: a user who chooses “다시 입력” sees their second-stage answer moved into the first stage and must reconstruct the split manually.

### The creation wizard can clip controls when the software keyboard reduces viewport height — resolved

`.al-phone-wizard` uses a fixed `100dvh` height and `.al-setup-wizard` uses `overflow:hidden`. The layout has a compact-height media query but no scroll fallback.

Impact: on short devices or with a large keyboard/accessibility font, the current stage button can become unreachable.

### DM conversation avatars are never connected to peer image data — resolved

`DmListScreen` reads `c.avatarImg`, but `conversationFromThread` does not include `avatarImg` in `DmConversation`. Non-owner conversation rows therefore always fall back to the generic placeholder even when the matched peer has an uploaded image.

### Non-empty broken avatar URLs do not fall back to the placeholder — resolved

`CharacterAvatarImage` substitutes the placeholder only when `src` is empty. It has no image-error fallback, so expired remote URLs or invalid cached data render a broken image.

### Existing features are deliberately gated behind the first generated post

Before the first owned post, the current code hides direct writing, DM entry, profile image editing, memory/relationship/public settings, and discovery. The E2E suite explicitly expects the DM button to be absent, so this is a deliberate product gate rather than an accidental conditional.

Impact: users cannot choose “직접 쓰기” or start a conversation first. Confirm this remains the intended onboarding rule.

## P3 Findings

### “Show once” help state is device-local, not account-level

The feed help completion flag is stored in `localStorage` under the user ID. It works once per account on the same installation, but appears again after app data is cleared, the app is reinstalled, or the user changes device.

### Several new controls remain below mobile touch-target guidance — resolved for reviewed controls

Examples include the 28px post-management summary, 25px help close control, and 31×30px previous-help control. They are clickable but less forgiving on a phone.

### New stateful UI lacks focused regression coverage — partially resolved

The E2E update checks that help opens after the first post and that the management menu opens upward. It does not cover help persistence after reload, generation failure feedback, setup field preservation, keyboard-resized wizard behavior, or broken-avatar fallback.

## Verification Results

- `npm run typecheck`: pass, 0 errors
- `npm run test:domain`: pass, 95/95
- `npm run build`: pass
- `npm run test:e2e -- --list`: pass, 12 tests discovered
- `git diff --check`: pass
- Android `:app:compileDebugJavaWithJavac`: pass using Android Studio JBR
- Android `:app:assembleDebug`: pass
- Capacitor Android sync: pass; frontend and native `index.html` hashes match
- Running Android WebView log review: no app JavaScript/Capacitor exception found in the inspected log window
- Full Playwright run: not executed because no frontend server was already listening and repository rules prohibit starting one for review
