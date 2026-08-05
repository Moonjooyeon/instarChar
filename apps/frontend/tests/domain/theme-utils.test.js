import assert from "node:assert/strict";
import test from "node:test";
import {
  THEME_STORAGE_KEY,
  clearThemePreference,
} from "../../src/domain/app/themeUtils.js";

test("dark-only mode removes a previously stored theme preference", () => {
  const calls = [];
  const storage = {
    removeItem: (key) => calls.push(["remove", key]),
  };
  clearThemePreference(storage);
  assert.deepEqual(calls, [["remove", THEME_STORAGE_KEY]]);
});

test("unavailable storage does not block dark theme initialization", () => {
  const error = new Error("storage unavailable");
  assert.doesNotThrow(() => clearThemePreference({ removeItem: () => { throw error; } }));
});
