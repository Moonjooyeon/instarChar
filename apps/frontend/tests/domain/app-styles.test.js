import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("the app bundles and uses a Korean-capable font", () => {
  const entryPath = path.resolve(process.cwd(), "src/main.tsx");
  const stylesPath = path.resolve(process.cwd(), "src/appStyles.ts");
  const entry = readFileSync(entryPath, "utf8");
  const styles = readFileSync(stylesPath, "utf8");
  assert.match(entry, /pretendardvariable-dynamic-subset\.css/);
  assert.match(
    styles,
    /font-family:'Pretendard Variable','Apple Color Emoji','Apple Symbols',-apple-system/,
  );
});

test("the native app shell consumes system safe-area insets", () => {
  const stylesPath = path.resolve(process.cwd(), "src/appStyles.ts");
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
  const stylesPath = path.resolve(process.cwd(), "src/appStyles.ts");
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
