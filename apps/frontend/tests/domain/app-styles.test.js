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

test("Apple login uses the bundled official Korean button", () => {
  const screenPath = path.resolve(process.cwd(), "src/features/auth/AuthScreens.tsx");
  const assetPath = path.resolve(process.cwd(), "public/apple-sign-in-continue-ko.png");
  const screen = readFileSync(screenPath, "utf8");
  const asset = readFileSync(assetPath);
  assert.match(screen, /aria-label="Apple로 계속"/);
  assert.match(screen, /src="\/apple-sign-in-continue-ko\.png"/);
  assert.deepEqual([...asset.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
