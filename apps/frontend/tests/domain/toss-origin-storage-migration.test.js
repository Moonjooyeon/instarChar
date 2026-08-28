import assert from "node:assert/strict";
import test from "node:test";
import { missingAliveStorageEntries } from "../../src/domain/app/tossOriginStorageMigration.js";

test("origin storage migration preserves current values and restores missing app data", () => {
  const previous = {
    "alive_app_state_v1": "previous-state",
    "alive_toss_session": "previous-token",
    "alive_feed_help_seen_v2:user-1": "true",
  };
  const current = {
    "alive_app_state_v1": "current-state",
  };
  assert.deepEqual(missingAliveStorageEntries(previous, current), [
    ["alive_toss_session", "previous-token"],
    ["alive_feed_help_seen_v2:user-1", "true"],
  ]);
});

test("origin storage migration ignores null and unrelated values", () => {
  const previous = {
    "alive_app_state_v1": null,
    "alive-theme": "dark",
    "third-party-key": "value",
  };
  assert.deepEqual(missingAliveStorageEntries(previous, {}), []);
});
