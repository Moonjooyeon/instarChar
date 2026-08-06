---
title: Entry Flow Visual Review Guide
author: Codex
created: 2026-08-05
updated: 2026-08-05
version: 1.2.0
status: ready
---

# Entry Flow Visual Review Guide

No frontend process was running during implementation, so the app was not started for visual QA. Use the project's existing running environment for the following review.

## Review Steps

1. Open the signed-out screen at a 353 × 738 CSS viewport.
   - Confirm that the archive sequence has three even columns.
   - Confirm that Google and Apple brand assets preserve their original proportions.
2. Sign in with an account that has no characters.
   - Confirm that all three story-sequence rows fit without horizontal clipping.
   - Confirm that the primary action and service-tour action remain visible at 680 px viewport height.
3. Open an account with at least one character.
   - Confirm that long handles and persona descriptions truncate without moving the open action.
   - Confirm that profile edit and delete remain separate from the account-open target.
4. Start character creation and move through all three stages.
   - Confirm that only the current stage is emphasized.
   - Confirm that the screen does not summon the software keyboard until a text area is tapped.
   - Confirm that back navigation preserves text already entered in earlier stages.
5. Continue to the parsed profile.
   - Confirm that the header reads as a final check and does not appear to be a fourth numbered stage.
   - Confirm that only the AI summary is visible initially and “틀린 부분 수정” opens the three core fields.
   - Open and close “더 다듬기” and confirm that the final action remains reachable by scrolling.
6. Create the character and arrive at its feed.
   - Confirm that profile editing, memory, relationships, publishing, and discovery controls are hidden before the first post.
   - Confirm that “첫 글의 장면 고르기” is the only dominant action and opens the existing scene picker.
   - Create the first post and confirm that “대화” and “기억·관계·공개 설정” then appear.
   - Confirm that a long name or handle does not collide with “대화”, and that age and world appear on their own secondary row.
   - Confirm that the muted header, solid writing controls, and outlined “대화” action do not compete with the profile content.
   - While a post is being generated, confirm that the composer disappears and the animated “새 글을 쓰는 중” state appears at the top of the feed.
   - Confirm that the generated post replaces that state without leaving the scene buttons visible.
7. Open the advanced profile section.
   - Confirm that memory is described as remembered moments, not database management.
   - Confirm that discovery says what adding a character changes before asking the user to act.
8. Open the conversation list.
   - Confirm that “나 · 바로 대화하기” is visually primary.
   - Confirm that character-to-character conversation and scene sharing are secondary options.
9. Generate the first post and review the feed help tour.
   - Confirm that the five-step help tour opens automatically only once for the signed-in account.
   - Confirm that each step scrolls its target into view and leaves only that target bright inside the dimmed screen.
   - Confirm that the coach card chooses an available space above or below the target, or docks above the bottom edge when neither fits, without clipping at 353 × 738 CSS pixels.
   - Confirm that the tap indicator remains inside every viewport edge, including at 320 px width.
   - Close the tour, reload the feed, and switch characters; confirm that it does not reopen automatically.
   - Press the top-right “? 도움말” button and confirm that the tour can always be opened manually.
   - Before a first post exists, confirm that manual help shows only the profile and first-post steps.
10. Review text hierarchy at 320 px and 353 px widths.
   - Confirm that creation screens show the three-step bar only once and do not repeat the current step above the question.
   - Confirm that body copy and helper text remain readable without zooming; only numbering and compact badges may use the smallest text tier.
   - Confirm that character descriptions and discovery summaries stop after two lines without changing the stored text.
   - Confirm that login, confirmation, DM, and first-feed screens do not repeat the same benefit in adjacent text blocks.
   - Confirm that larger helper text does not push the primary action below the reachable area at 680 px viewport height.
11. Review character avatar fallbacks without uploaded images.
   - Confirm that profile, first-post, generating, feed post, quoted post, comment, relationship, and memory surfaces use the same default character icon.
   - Confirm that discovery, public profile, follow list, DM list, DM header, DM bubbles, and character target selectors use the same icon.
   - Confirm that uploaded character images still replace the fallback at every supported size without stretching.
   - Confirm that owner and persona markers remain distinct from character avatars.
12. Review first-post and post-management edge cases.
   - Open the first-scene picker and confirm that the lower “first post” empty-state card disappears while choosing a scene.
   - Create a post, scroll its action row to the bottom edge, and open “관리”.
   - Confirm that the menu opens above the trigger and both “수정” and “삭제” remain fully tappable.

## Automated Checks

- Production build: passed.
- Domain tests: 92 passed.
- Playwright specification discovery: 9 scenarios loaded successfully.
- Type checking: blocked by eight pre-existing type mismatches in `useAliveAppController.tsx`; none are in the edited UI files.
