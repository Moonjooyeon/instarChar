import assert from "node:assert/strict";
import test from "node:test";
import {
  USER_PERSONA_FEATURE_ENABLED,
  normalizeUserPersonaSpeaker,
} from "../../src/domain/app/featureFlags.js";

test("user persona feature is disabled by default", () => {
  assert.equal(USER_PERSONA_FEATURE_ENABLED, false);
});

test("disabled user persona speakers fall back to the current character", () => {
  assert.equal(normalizeUserPersonaSpeaker("p:123"), "char");
  assert.equal(normalizeUserPersonaSpeaker("char"), "char");
  assert.equal(normalizeUserPersonaSpeaker("owner"), "owner");
  assert.equal(normalizeUserPersonaSpeaker(null), "char");
});
