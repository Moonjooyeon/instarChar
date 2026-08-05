import assert from "node:assert/strict";
import test from "node:test";
import {
  THEME_STORAGE_KEY,
  persistThemePreference,
  readThemePreference,
  resolveTheme,
} from "../../src/domain/app/themeUtils.js";

test("theme preference accepts stored light and dark values", () => {
  assert.equal(readThemePreference({ getItem: () => "light" }), "light");
  assert.equal(readThemePreference({ getItem: () => "dark" }), "dark");
  assert.equal(readThemePreference({ getItem: () => "unexpected" }), "system");
});

test("system theme resolves from the current media preference", () => {
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("explicit theme preferences persist and system removes the override", () => {
  const calls = [];
  const storage = {
    removeItem: (key) => calls.push(["remove", key]),
    setItem: (key, value) => calls.push(["set", key, value]),
  };
  persistThemePreference(storage, "dark");
  persistThemePreference(storage, "system");
  assert.deepEqual(calls, [["set", THEME_STORAGE_KEY, "dark"], ["remove", THEME_STORAGE_KEY]]);
});

test("unavailable storage falls back without breaking theme rendering", () => {
  const error = new Error("storage unavailable");
  assert.equal(readThemePreference({ getItem: () => { throw error; } }), "system");
  assert.doesNotThrow(() => persistThemePreference({ removeItem: () => { throw error; }, setItem: () => { throw error; } }, "dark"));
});
