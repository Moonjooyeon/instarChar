import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("the app bundles and uses a Korean-capable font", () => {
  const entryPath = path.resolve(process.cwd(), "src/main.tsx");
  const stylesPath = path.resolve(process.cwd(), "src/styles/theme.css");
  const entry = readFileSync(entryPath, "utf8");
  const styles = readFileSync(stylesPath, "utf8");
  assert.match(entry, /pretendardvariable-dynamic-subset\.css/);
  assert.match(
    styles,
    /--alive-font-sans: 'Pretendard Variable', 'Apple Color Emoji', 'Apple Symbols', -apple-system/,
  );
});

test("the native app shell consumes system safe-area insets", () => {
  const stylesPath = path.resolve(process.cwd(), "src/styles/legacy.css");
  const styles = readFileSync(stylesPath, "utf8");
  for (const side of ["top", "right", "bottom", "left"]) {
    assert.ok(
      styles.includes(
        `--al-safe-${side}:var(--safe-area-inset-${side},env(safe-area-inset-${side},0px))`,
      ),
    );
  }
  assert.match(
    styles,
    /padding:var\(--al-safe-top\) var\(--al-safe-right\) var\(--al-safe-bottom\) var\(--al-safe-left\)/,
  );
});

test("social login uses bundled official brand assets", () => {
  const screenPath = path.resolve(process.cwd(), "src/features/auth/AuthScreens.tsx");
  const appleAssetPath = path.resolve(process.cwd(), "public/apple-sign-in-continue-ko.png");
  const googleAssetPath = path.resolve(process.cwd(), "public/google-g-logo.png");
  const screen = readFileSync(screenPath, "utf8");
  const appleAsset = readFileSync(appleAssetPath);
  const googleAsset = readFileSync(googleAssetPath);
  assert.match(screen, /const showAppleLogin = shouldShowAppleLogin\(\)/);
  assert.match(screen, /"계정으로 시작하고 설정 한 줄만 남겨보세요\. 나머지는 ALIVE가 이어가요\."/);
  assert.match(screen, /aria-label="Apple로 계속"/);
  assert.match(screen, /src="\/apple-sign-in-continue-ko\.png"/);
  assert.match(screen, /src="\/google-g-logo\.png"/);
  assert.deepEqual([...appleAsset.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual([...googleAsset.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("empty character avatars preserve the neutral square default artwork", () => {
  const componentPath = path.resolve(process.cwd(), "src/components/ui/CharacterAvatarImage.tsx");
  const confirmPath = path.resolve(process.cwd(), "src/features/character-setup/ConfirmScreen.tsx");
  const assetPath = path.resolve(process.cwd(), "public/character-placeholder.svg");
  const stylesPath = path.resolve(process.cwd(), "src/styles/legacy.css");
  const component = readFileSync(componentPath, "utf8");
  const confirm = readFileSync(confirmPath, "utf8");
  const asset = readFileSync(assetPath, "utf8");
  const styles = readFileSync(stylesPath, "utf8");
  assert.match(component, /DEFAULT_CHARACTER_AVATAR = "\/character-placeholder\.svg"/);
  assert.match(confirm, /<CharacterAvatarImage src=\{char\.avatarImg\} \/>/);
  assert.match(asset, /viewBox="0 0 160 160"/);
  assert.match(asset, /width="160" height="160"/);
  assert.doesNotMatch(asset, /#756180/);
  assert.match(styles, /\.al-cast-avatar\{ width:64px; height:64px; flex-basis:64px/);
  assert.match(styles, /\.al-cmtbox-cancel\{ position:absolute;[^}]*width:44px; height:44px/);
});

test("theme-ready entry screens use layered legacy CSS and Tailwind utilities", () => {
  const indexStyles = readFileSync(path.resolve(process.cwd(), "src/styles/index.css"), "utf8");
  const authScreen = readFileSync(path.resolve(process.cwd(), "src/features/auth/AuthScreens.tsx"), "utf8");
  const tourScreen = readFileSync(path.resolve(process.cwd(), "src/features/onboarding/ServiceTour.tsx"), "utf8");
  const dumpScreen = readFileSync(path.resolve(process.cwd(), "src/features/character-setup/DumpScreen.tsx"), "utf8");
  const confirmScreen = readFileSync(path.resolve(process.cwd(), "src/features/character-setup/ConfirmScreen.tsx"), "utf8");
  assert.match(indexStyles, /legacy\.css" layer\(components\)/);
  assert.match(indexStyles, /screens\/entry\.css" layer\(components\)/);
  assert.match(authScreen, /al-phone al-theme-ready/);
  assert.match(tourScreen, /al-phone al-theme-ready/);
  assert.match(dumpScreen, /al-phone al-phone-wizard al-theme-ready/);
  assert.match(dumpScreen, /grid-cols-3 gap-2/);
  assert.match(confirmScreen, /al-phone al-theme-ready/);
});

test("the credit mockup uses a dedicated semantic screen and shared shortcuts", () => {
  const indexStyles = readFileSync(path.resolve(process.cwd(), "src/styles/index.css"), "utf8");
  const homeScreen = readFileSync(path.resolve(process.cwd(), "src/features/home/HomeScreen.tsx"), "utf8");
  const feedScreen = readFileSync(path.resolve(process.cwd(), "src/app/feed/FeedProfilePanel.tsx"), "utf8");
  const discoverScreen = readFileSync(path.resolve(process.cwd(), "src/features/discover/DiscoverScreen.tsx"), "utf8");
  const dmListScreen = readFileSync(path.resolve(process.cwd(), "src/features/dm/DmListScreen.tsx"), "utf8");
  const dmThreadScreen = readFileSync(path.resolve(process.cwd(), "src/app/dm/DmThreadRoute.tsx"), "utf8");
  const creditScreen = readFileSync(path.resolve(process.cwd(), "src/features/credits/CreditStoreScreen.tsx"), "utf8");
  const creditStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/credit.css"), "utf8");
  assert.match(indexStyles, /screens\/credit\.css" layer\(components\)/);
  assert.match(homeScreen, /CreditShortcut/);
  assert.match(feedScreen, /CreditShortcut/);
  assert.match(discoverScreen, /CreditShortcut/);
  assert.match(dmListScreen, /CreditShortcut/);
  assert.match(dmThreadScreen, /CreditShortcut/);
  assert.match(creditScreen, /al-phone al-theme-ready al-credit-theme-ready/);
  assert.match(creditStyles, /\.al-credit-theme-ready \.al-credit-screen/);
  assert.match(creditStyles, /\.al-theme-ready \.al-credit-shortcut/);
  assert.doesNotMatch(creditStyles, /#[0-9a-fA-F]{3,8}/);
});

test("the staged feed profile uses semantic Tailwind colors", () => {
  const indexStyles = readFileSync(path.resolve(process.cwd(), "src/styles/index.css"), "utf8");
  const profileScreen = readFileSync(path.resolve(process.cwd(), "src/app/feed/FeedProfilePanel.tsx"), "utf8");
  const profileStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/feed-profile.css"), "utf8");
  assert.match(indexStyles, /screens\/feed-profile\.css" layer\(components\)/);
  assert.match(profileScreen, /border-line-strong bg-surface-raised/);
  assert.match(profileScreen, /al-profile-more border-line bg-surface text-ink/);
  assert.match(profileScreen, /function FirstSceneBanner/);
  assert.match(profileScreen, /function FirstImpression/);
  assert.match(profileStyles, /\.al-feed-theme-ready \.al-profile/);
  assert.match(profileStyles, /\.al-feed-theme-ready \.al-profile-first \.al-banner/);
  assert.match(profileStyles, /\.al-feed-theme-ready \.al-first-impression/);
  assert.doesNotMatch(profileStyles.replaceAll("#fff", ""), /#[0-9a-fA-F]{3,8}/);
});

test("the staged feed relationship and memory panels use semantic surfaces", () => {
  const memoryPanel = readFileSync(path.resolve(process.cwd(), "src/app/feed/FeedMemoryPanel.tsx"), "utf8");
  const profileStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/feed-profile.css"), "utf8");
  assert.match(memoryPanel, /const MEMORY_ADD_TOGGLE_CLASS = "al-mem-add-toggle border-line-strong bg-surface-raised text-accent-ink/);
  assert.match(memoryPanel, /className=\{MEMORY_ADD_TOGGLE_CLASS\}/);
  assert.match(profileStyles, /\.al-feed-theme-ready \.al-rellist,\.al-feed-theme-ready \.al-memlist/);
  assert.match(profileStyles, /\.al-feed-theme-ready \.al-mem-card\.pinned/);
  assert.match(profileStyles, /\.al-feed-theme-ready \.al-rel-delete/);
});

test("the staged feed composer uses semantic controls and its own style bridge", () => {
  const indexStyles = readFileSync(path.resolve(process.cwd(), "src/styles/index.css"), "utf8");
  const composer = readFileSync(path.resolve(process.cwd(), "src/app/feed/FeedComposer.tsx"), "utf8");
  const composerStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/feed-composer.css"), "utf8");
  assert.match(indexStyles, /screens\/feed-composer\.css" layer\(components\)/);
  assert.match(composer, /al-wake border-line-strong bg-accent-soft text-accent-ink/);
  assert.match(composer, /al-write-post bg-accent text-white/);
  assert.match(composer, /function MoodButton/);
  assert.match(composerStyles, /\.al-feed-theme-ready \.al-composer/);
  assert.match(composerStyles, /\.al-feed-theme-ready \.al-moods-head/);
  assert.match(composerStyles, /@keyframes aliveComposerPulse/);
  assert.doesNotMatch(composerStyles, /#[0-9a-fA-F]{3,8}/);
});

test("the staged feed timeline base uses semantic states without migrating comments", () => {
  const indexStyles = readFileSync(path.resolve(process.cwd(), "src/styles/index.css"), "utf8");
  const timeline = readFileSync(path.resolve(process.cwd(), "src/app/feed/FeedTimeline.tsx"), "utf8");
  const timelineStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/feed-timeline.css"), "utf8");
  assert.match(indexStyles, /screens\/feed-timeline\.css" layer\(components\)/);
  assert.match(timeline, /function feedTabClass\(active: boolean\): string/);
  assert.match(timeline, /FIRST_POST_SCENES/);
  assert.match(timeline, /al-like \$\{post\.liked \? "on text-like"/);
  assert.match(timelineStyles, /\.al-feed-theme-ready \.al-first-stage/);
  assert.match(timelineStyles, /\.al-feed-theme-ready \.al-generating-post/);
  assert.match(timelineStyles, /\.al-feed-theme-ready \.al-post-more > div/);
  assert.doesNotMatch(timelineStyles, /\.al-comment/);
  assert.doesNotMatch(timelineStyles, /#[0-9a-fA-F]{3,8}/);
});

test("the staged feed comments use semantic author and input states", () => {
  const indexStyles = readFileSync(path.resolve(process.cwd(), "src/styles/index.css"), "utf8");
  const timeline = readFileSync(path.resolve(process.cwd(), "src/app/feed/FeedTimeline.tsx"), "utf8");
  const commentStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/feed-comments.css"), "utf8");
  assert.match(indexStyles, /screens\/feed-comments\.css" layer\(components\)/);
  assert.match(timeline, /al-cmt-open border-line bg-surface text-soft/);
  assert.match(timeline, /al-cmtbox-send bg-accent text-white/);
  assert.match(commentStyles, /\.al-feed-theme-ready \.al-comments/);
  assert.match(commentStyles, /\.al-feed-theme-ready \.al-cmtbox-input:focus/);
  assert.match(commentStyles, /\.al-feed-theme-ready \.al-cmtbox \.al-spk-chip\.persona\.on/);
  assert.doesNotMatch(commentStyles, /#[0-9a-fA-F]{3,8}/);
});

test("the feed activates theme scope after its portal-based help surface migrates", () => {
  const feedRoute = readFileSync(path.resolve(process.cwd(), "src/app/FeedRoute.tsx"), "utf8");
  const helpTour = readFileSync(path.resolve(process.cwd(), "src/app/feed/FeedHelpTour.tsx"), "utf8");
  const helpStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/feed-help.css"), "utf8");
  assert.match(feedRoute, /al-phone al-theme-ready al-feed-theme-ready/);
  assert.match(helpTour, /al-theme-ready al-feed-help-theme-ready/);
  assert.match(helpTour, /al-help-next border-accent bg-accent text-white/);
  assert.match(helpTour, /key=\{step\.selector\}/);
  assert.match(helpStyles, /\.al-feed-help-theme-ready \.al-help-highlight/);
  assert.match(helpStyles, /var\(--alive-scrim\)/);
  assert.match(helpStyles, /@keyframes aliveHelpTap/);
  assert.match(helpStyles, /@keyframes aliveHelpCopyIn/);
  assert.doesNotMatch(helpStyles, /#[0-9a-fA-F]{3,8}/);
});

test("the discover list activates a semantic theme without pulling in its modal", () => {
  const discover = readFileSync(path.resolve(process.cwd(), "src/features/discover/DiscoverScreen.tsx"), "utf8");
  const discoverStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/discover.css"), "utf8");
  assert.match(discover, /al-phone al-theme-ready al-discover-theme-ready/);
  assert.match(discover, /al-disc-dm bg-accent text-white/);
  assert.match(discover, /on border-accent bg-accent-soft text-accent-ink/);
  assert.match(discoverStyles, /\.al-discover-theme-ready \.al-disc-search input/);
  assert.match(discoverStyles, /\.al-discover-theme-ready \.al-world-chip/);
  assert.doesNotMatch(discoverStyles, /\.al-public-profile/);
  assert.doesNotMatch(discoverStyles, /#[0-9a-fA-F]{3,8}/);
});

test("the DM list themes conversations and new-chat choices without styling threads", () => {
  const dmList = readFileSync(path.resolve(process.cwd(), "src/features/dm/DmListScreen.tsx"), "utf8");
  const dmListStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/dm-list.css"), "utf8");
  assert.match(dmList, /al-phone al-theme-ready al-dm-list-theme-ready/);
  assert.match(dmList, /al-owner-entry border-accent bg-accent-soft text-ink/);
  assert.match(dmList, /al-newchat-btn border-line-strong bg-surface text-ink/);
  assert.match(dmListStyles, /\.al-dm-list-theme-ready \.al-convitem/);
  assert.match(dmListStyles, /\.al-dm-list-theme-ready \.al-newchat-target/);
  assert.doesNotMatch(dmListStyles, /\.al-bubble|\.al-dminput/);
  assert.doesNotMatch(dmListStyles, /#[0-9a-fA-F]{3,8}/);
});

test("the DM thread base themes headers and bubbles with semantic surfaces", () => {
  const route = readFileSync(path.resolve(process.cwd(), "src/app/dm/DmThreadRoute.tsx"), "utf8");
  const threadStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/dm-thread.css"), "utf8");
  assert.match(route, /al-dm-settings-btn border-line-strong bg-surface-raised text-accent-ink/);
  assert.match(threadStyles, /\.al-dm-thread-theme-ready \.al-dmscroll/);
  assert.match(threadStyles, /\.al-dm-thread-theme-ready \.al-bubble\.me/);
  assert.doesNotMatch(threadStyles, /#[0-9a-fA-F]{3,8}/);
});

test("the staged DM relationship and memory panels share semantic direction states", () => {
  const memoryPanel = readFileSync(path.resolve(process.cwd(), "src/app/dm/DmMemoryPanel.tsx"), "utf8");
  const threadStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/dm-thread.css"), "utf8");
  assert.match(memoryPanel, /const MEMORY_ACTION_CLASS = "border-line-strong bg-surface-raised text-accent-ink/);
  assert.match(memoryPanel, /const MEMORY_DANGER_ACTION_CLASS = "danger border-danger bg-danger-soft text-danger/);
  assert.match(threadStyles, /\.al-dm-thread-theme-ready \.al-affinity/);
  assert.match(threadStyles, /\.al-dm-thread-theme-ready \.al-aff-fill\.neg/);
  assert.match(threadStyles, /\.al-dm-thread-theme-ready \.al-peermem-list/);
  assert.doesNotMatch(threadStyles, /#[0-9a-fA-F]{3,8}/);
});

test("the DM thread activates after controls and message input receive semantic states", () => {
  const route = readFileSync(path.resolve(process.cwd(), "src/app/dm/DmThreadRoute.tsx"), "utf8");
  const controls = readFileSync(path.resolve(process.cwd(), "src/app/dm/DmControls.tsx"), "utf8");
  const threadStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/dm-thread.css"), "utf8");
  assert.match(route, /al-phone al-theme-ready al-dm-thread-theme-ready/);
  assert.match(controls, /al-autochat-go border-line-strong bg-surface-raised text-accent-ink/);
  assert.match(controls, /className="bg-accent text-white hover:bg-accent-strong/);
  assert.match(threadStyles, /\.al-dm-thread-theme-ready \.al-dminput input/);
  assert.match(threadStyles, /@keyframes aliveDmLivePulse/);
  assert.doesNotMatch(threadStyles, /#[0-9a-fA-F]{3,8}/);
});

test("shared account, correction, and safety modals receive an independent theme scope", () => {
  const account = readFileSync(path.resolve(process.cwd(), "src/app/modals/AccountModals.tsx"), "utf8");
  const persona = readFileSync(path.resolve(process.cwd(), "src/app/modals/PersonaFixModals.tsx"), "utf8");
  const safety = readFileSync(path.resolve(process.cwd(), "src/app/modals/SafetyModals.tsx"), "utf8");
  const modalStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/common-modals.css"), "utf8");
  assert.match(account, /al-modal-bg al-theme-ready al-common-modal-theme-ready/);
  assert.match(persona, /al-modal-bg al-theme-ready al-common-modal-theme-ready/);
  assert.match(safety, /al-safety-layer al-theme-ready al-common-modal-theme-ready/);
  assert.match(modalStyles, /\.al-common-modal-theme-ready \.al-modal/);
  assert.match(modalStyles, /\.al-common-modal-theme-ready \.al-report-select/);
  assert.doesNotMatch(modalStyles, /\.al-public-profile|\.al-world-modal|\.al-follow-modal/);
  assert.doesNotMatch(modalStyles, /#[0-9a-fA-F]{3,8}/);
});

test("public profile, world, and follow modals share a semantic overlay scope", () => {
  const modals = readFileSync(path.resolve(process.cwd(), "src/app/modals/PublicFollowModals.tsx"), "utf8");
  const modalStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/public-modals.css"), "utf8");
  assert.match(modals, /al-modal-bg al-theme-ready al-public-modal-theme-ready/);
  assert.match(modals, /function publicFollowClass\(followed: boolean\): string/);
  assert.match(modals, /al-public-dm border-line-strong bg-surface-raised text-accent-ink/);
  assert.match(modalStyles, /\.al-public-modal-theme-ready \.al-public-profile/);
  assert.match(modalStyles, /\.al-public-modal-theme-ready \.al-world-view-modal/);
  assert.match(modalStyles, /\.al-public-modal-theme-ready \.al-follow-modal/);
  assert.doesNotMatch(modalStyles, /#[0-9a-fA-F]{3,8}/);
});

test("DM setup modals theme scene choices and actions independently", () => {
  const modals = readFileSync(path.resolve(process.cwd(), "src/app/modals/DmSetupModals.tsx"), "utf8");
  const modalStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/dm-setup-modals.css"), "utf8");
  assert.match(modals, /al-modal-bg al-theme-ready al-dm-setup-modal-theme-ready/);
  assert.match(modals, /function worldOptionClass\(active: boolean\): string/);
  assert.match(modals, /primary border-accent bg-accent text-white hover:bg-accent-strong/);
  assert.match(modalStyles, /\.al-dm-setup-modal-theme-ready \.al-world-modal/);
  assert.match(modalStyles, /\.al-dm-setup-modal-theme-ready \.al-world-options button\.on/);
  assert.match(modalStyles, /\.al-dm-setup-modal-theme-ready \.al-world-note::placeholder/);
  assert.doesNotMatch(modalStyles, /#[0-9a-fA-F]{3,8}/);
});

test("relationship proposal and result modals use semantic outcome states", () => {
  const modals = readFileSync(path.resolve(process.cwd(), "src/features/relationships/RelationshipModals.tsx"), "utf8");
  const modalStyles = readFileSync(path.resolve(process.cwd(), "src/styles/screens/relationship-modals.css"), "utf8");
  assert.match(modals, /al-modal-bg al-theme-ready al-relationship-modal-theme-ready/);
  assert.match(modals, /friendship" : relationResult\.accepted \? "accepted" : "broken"/);
  assert.match(modals, /al-prop-yes border-accent bg-accent text-white hover:bg-accent-strong/);
  assert.match(modalStyles, /\.al-prop-heart\.friendship\{ color:var\(--alive-success\)/);
  assert.match(modalStyles, /\.al-prop-heart\.broken\{ color:var\(--alive-danger\)/);
  assert.doesNotMatch(modalStyles, /#[0-9a-fA-F]{3,8}/);
});

test("legacy CSS excludes obsolete authentication and setup flows", () => {
  const legacyStyles = readFileSync(path.resolve(process.cwd(), "src/styles/legacy.css"), "utf8");
  const obsoleteClasses = ["al-setup-progress", "al-tone", "al-guidechip", "al-example", "al-auth-tabs", "al-auth-input", "al-identity", "al-relchip"];
  for (const className of obsoleteClasses) assert.doesNotMatch(legacyStyles, new RegExp(`\\.${className}(?:[\\s:{.,]|$)`));
  assert.match(legacyStyles, /\.al-step-examples/);
  assert.match(legacyStyles, /\.al-rp-box/);
  assert.match(legacyStyles, /\.al-auth-linkbtn/);
});

test("legacy CSS excludes obsolete account and social panels", () => {
  const legacyStyles = readFileSync(path.resolve(process.cwd(), "src/styles/legacy.css"), "utf8");
  assert.doesNotMatch(legacyStyles, /\.al-(?:acccard|acc-actions|accedit|accdel|following|profile-follow|unfollow)/);
  assert.doesNotMatch(legacyStyles, /\.al-(?:mem-meta|mini-action|intervene|occhip|peermem-toggle|public-line|public-desc)/);
  assert.doesNotMatch(legacyStyles, /\.al-(?:auto-badge|bubble-label|build|cast-index|post-mood|speakas|user-badge)(?:[\s:{.,]|$)/);
  assert.match(legacyStyles, /\.al-cast-entry/);
  assert.match(legacyStyles, /\.al-chatmode/);
  assert.match(legacyStyles, /\.al-public-stats/);
});

test("entry routes use semantic Tailwind classes for their primary actions", () => {
  const auth = readFileSync(path.resolve(process.cwd(), "src/features/auth/AuthScreens.tsx"), "utf8");
  const home = readFileSync(path.resolve(process.cwd(), "src/features/home/HomeScreen.tsx"), "utf8");
  const tour = readFileSync(path.resolve(process.cwd(), "src/features/onboarding/ServiceTour.tsx"), "utf8");
  const confirm = readFileSync(path.resolve(process.cwd(), "src/features/character-setup/ConfirmScreen.tsx"), "utf8");
  assert.match(auth, /al-auth-btn bg-accent text-white hover:bg-accent-strong/);
  assert.match(home, /al-accadd first border-accent bg-accent text-white/);
  assert.match(tour, /al-tour-next bg-accent text-white hover:bg-accent-strong/);
  assert.match(confirm, /al-start al-confirm-go bg-accent text-white hover:bg-accent-strong/);
});

test("light and dark mode use a compact icon toggle at the top of entry screens", () => {
  const auth = readFileSync(path.resolve(process.cwd(), "src/features/auth/AuthScreens.tsx"), "utf8");
  const home = readFileSync(path.resolve(process.cwd(), "src/features/home/HomeScreen.tsx"), "utf8");
  const toggle = readFileSync(path.resolve(process.cwd(), "src/components/ui/ThemeToggle.tsx"), "utf8");
  assert.match(auth, /<ThemeToggle \{\.\.\.theme\} \/>/);
  assert.match(home, /<ThemeToggle \{\.\.\.theme\} \/>/);
  assert.doesNotMatch(home, /ThemePicker|화면 모드/);
  assert.match(toggle, /name=\{isDark \? "sun" : "moon"\}/);
});

test("shared modals use semantic Tailwind input and action states", () => {
  const account = readFileSync(path.resolve(process.cwd(), "src/app/modals/AccountModals.tsx"), "utf8");
  const persona = readFileSync(path.resolve(process.cwd(), "src/app/modals/PersonaFixModals.tsx"), "utf8");
  const safety = readFileSync(path.resolve(process.cwd(), "src/app/modals/SafetyModals.tsx"), "utf8");
  assert.match(account, /al-pd-input border-line bg-surface-raised text-ink/);
  assert.match(account, /al-modal-danger bg-danger-soft text-danger hover:bg-danger/);
  assert.match(persona, /al-pd-save bg-accent text-white hover:bg-accent-strong/);
  assert.match(persona, /al-fixchip border-accent bg-accent-soft text-accent-ink/);
  assert.match(safety, /al-modal-danger bg-danger-soft text-danger hover:bg-danger/);
});
