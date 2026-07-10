# Phase 6 Domain Hook Slice Report

## Scope

- Added state ownership hooks for controller split:
  - `apps/frontend/src/hooks/useCharacterAccounts.js`
  - `apps/frontend/src/hooks/useAliveFeed.js`
  - `apps/frontend/src/hooks/useAliveDm.js`
  - `apps/frontend/src/hooks/useAliveDiscover.js`
  - `apps/frontend/src/hooks/useAliveMemory.jsx`
  - `apps/frontend/src/hooks/useAliveRelationships.js`
- Moved low-risk handlers and derived helpers out of `useAliveAppController.jsx`:
  - character factory, profile/gallery image upload, field update
  - feed comment/post edit, delete, like, time label, public post snapshot, visible timeline derivation
  - DM image draft, DM title rename, current-room derived state, conversation list helpers, persona delete helper
  - memory CRUD, room memory CRUD, lore peer select rendering, prompt memory blocks, profile panel toggles
  - discover follower count, following-state, shared character/follower query helpers
  - discover shared-character publishing and follow persistence helpers
  - relationship affinity lookup and room affinity helpers
  - structured table save/load/delete persistence helpers
  - auth submit, magic link, password recovery, sign-out, onboarding, recovery actions
  - app state snapshot, apply, reset, profile backup, save helpers
  - autosave and pagehide persistence effects
  - session/OAuth bootstrap, auth state subscription, slow auth watchdog
  - profile/cache/structured-state bootstrap
  - discover shared-character sync, deep-link handling, relationship follow-back sync
  - relationship auto-follow normalization sync
  - DM room lifecycle, settings, deletion, key migration, local-room affinity repair
  - character account lifecycle, switch/edit/delete/start/wake helpers
  - relationship label normalization, affinity mutation, proposal/acceptance helpers
  - session affinity and memory analysis helpers
  - feed post, comment, follower reaction, and auto-post generation helpers
  - DM send, reply generation, and auto-chat generation helpers
  - character correction note and prompt block helpers
  - character setup analysis API and JSON parsing helpers
  - discover share/follow action wrappers with feed snapshot binding
  - peer lookup across active, owned, followed, shared, and current DM peer characters
  - relationship auto-follow calculation and discover follow toggling
  - share status flash timer ownership
- Added pure domain utilities:
  - `apps/frontend/src/domain/relationships/affinityUtils.js`
  - `apps/frontend/src/domain/dm/dmKeyUtils.js`
  - `apps/frontend/src/domain/app/textUtils.js`
  - `apps/frontend/src/domain/app/asyncUtils.js`
- Added persistence boundary hook:
  - `apps/frontend/src/hooks/useAliveStructuredPersistence.js`
- Added auth boundary hook:
  - `apps/frontend/src/hooks/useAliveAuthActions.js`
- Added app-state persistence hooks:
  - `apps/frontend/src/hooks/useAliveAppStatePersistence.js`
  - `apps/frontend/src/hooks/useAliveAutosave.js`
- Added bootstrap/sync hooks:
  - `apps/frontend/src/hooks/useAliveSessionBootstrap.js`
  - `apps/frontend/src/hooks/useAliveProfileBootstrap.js`
  - `apps/frontend/src/hooks/useAliveDiscoverSync.js`
  - `apps/frontend/src/hooks/useAliveRelationshipSync.js`
- Added DM lifecycle hook:
  - `apps/frontend/src/hooks/useAliveDmLifecycle.js`
- Added character lifecycle hook:
  - `apps/frontend/src/hooks/useAliveCharacterLifecycle.js`
- Added relationship mutation hook:
  - `apps/frontend/src/hooks/useAliveRelationshipMutations.js`
- Added session analysis hook:
  - `apps/frontend/src/hooks/useAliveSessionAnalysis.js`
- Added feed generation hook:
  - `apps/frontend/src/hooks/useAliveFeedGeneration.js`
- Added DM generation hook:
  - `apps/frontend/src/hooks/useAliveDmGeneration.js`
- Added correction hook:
  - `apps/frontend/src/hooks/useAliveCorrections.js`
- Added character analysis hook:
  - `apps/frontend/src/hooks/useAliveCharacterAnalysis.js`
- Added discover action hook:
  - `apps/frontend/src/hooks/useAliveDiscoverActions.js`
- Added peer lookup hook:
  - `apps/frontend/src/hooks/useAlivePeerLookup.js`
- Added follow action hook:
  - `apps/frontend/src/hooks/useAliveFollowActions.js`

## Verification

- `npm run build` passed.
- Existing Vite chunk-size warning remains and is not introduced by this slice.
- App process was not started, following repository process rules.

## Line Count

- Before this slice: `apps/frontend/src/hooks/useAliveAppController.jsx` 4,516 lines.
- After this slice: `apps/frontend/src/hooks/useAliveAppController.jsx` 1,498 lines.

## Remaining T6 Work

- None. The remaining `deletePersona` bridge is intentionally kept in the controller because it connects DM persona ownership with feed comment identity state.
- Domain/unit test harness work moves to T7.
