# DM response mode runtime audit — 2026-08-10

> **Historical policy notice — 2026-08-11**: 이 감사의 다섯 단계 DM과 사진 첨부 상태는 현재 제품 정책이 아니다. 현재 정책은 기본 1C·기억 반영 2C·중요한 답장 5C이며, DM 사진 첨부와 이미지 이해 flow는 제거됐다. 최신 범위는 [DM 피드백 단순화 계획](../../../plans/product/app-flow/plan_dm-feedback-simplification_2026-08-11.md)을 따른다.

## Scope

Android Pixel 9 (`emulator-5554`) running the locally configured Capacitor build. The flow reviewed was an existing DM with the `서사 집중` response mode selected and the insufficient purchased-credit state.

## Evidence

1. `01-dm-failure-state.jpeg` — Existing DM, selected `서사 집중`, response mode disclosure, and credit shortage CTA.
2. `02-fresh-install-sign-in.jpeg` — Fresh local-install entry state after the updated bundle was deployed.
3. `03-pro-credit-shortage-explained.jpeg` — Authenticated local DM showing `150C` total, a Pro 5C selection, and the purchased-credit-only shortage explanation.
4. `04-response-mode-selector.jpeg` — Authenticated Pixel 9 DM with the full five-tier selector open and `긴 맥락` selected.
5. `05-live-basic-response.jpeg` — User-entered live DM receiving a persisted basic-mode Flash response on the authenticated Pixel 9 build.
6. Local runtime ledger query — the 17:42:34 KST request is `direct_dm_basic · committed · Flash · success`, charged as `무료 에너지 8%` with `0C` from both bonus and purchased balances.

## Findings and actions

1. **DM response and cost state — improved.** The selected mode is visible directly above the composer, with its model and cost. The captured state also showed a total `150C` shortcut next to a shortage state. The shortage was correct because Pro modes use purchased credits only, but the old wording did not explain that distinction.
   - Changed the shortage label to `구매 크레딧이 부족해요`.
   - The message now names the selected tier and says that it uses purchased credits only, with the required and usable amount.

2. **Mode scope — improved.** Response mode had been held as one app-wide value, so a high-cost choice could carry into a different DM. It is now keyed by DM thread and stored with app state: returning to the same conversation after navigation or restart keeps the deliberate choice, while another conversation starts with `기본 대화`.

3. **Control density — remaining risk.** Conversation settings, response mode, cost status, attachment, composer, and send action occupy the lower portion of the phone. Each control is compact and the selected state is visible, but a long shortage explanation can still wrap to two lines. Recheck this at 320 px and with the largest Android font scale.

4. **Recovery flow — partially verified.** The shortage CTA is exposed in the DM composer, and an authenticated local account is active in the installed build. A user-entered 기본 대화 request produced and displayed a character reply on Pixel 9. The local runtime ledger confirms the same request committed successfully from free energy (8%), so the visible `150C` balance correctly remained unchanged. Refund-on-failure remains unverified in a live provider-failure run.

5. **Draft isolation — improved.** An unsent composer draft, including its attachment, is now scoped to its DM key instead of the entire app. Moving to another DM no longer exposes a sentence or image meant for a different character. Deleting a DM or character removes its in-memory draft as well; local, owner-scoped DM state for a deleted character is now cleaned together.

## Verification

- Frontend typecheck: passed.
- Domain tests: 142 passed after the draft-isolation change, including the purchased-credit shortage copy assertion.
- Frontend production build: passed.
- Backend source compile: passed.
- Backend credit, policy, AI, and credit-API tests: 52 passed in the running backend container, including cancellation refund and original-balance-source refund cases.
- DM response mode return-to-thread E2E scenario: added and syntax-checked; it still needs execution against an already-running frontend process.
- `make cap-sync-local`: passed for `emulator-5554`.
- Android debug build and deployment: passed after replacing one corrupted generated APK.

## Evidence limits

These screenshots do not establish screen-reader behavior, font-scale reflow, focus order, or refund behavior after a live provider failure. The committed credit-usage source was confirmed separately against the local runtime ledger.
