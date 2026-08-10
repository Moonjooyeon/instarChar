import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSavedStep,
  pathForStep,
  resolveCreditReturnStep,
  sharedIdFromSearch,
  sharedSearchForNavigation,
  stepFromPath,
} from "../../src/domain/app/aliveCore.js";

test("sharedSearchForNavigation preserves shared query during route normalization", () => {
  assert.equal(sharedIdFromSearch("?shared=abc-123&other=drop"), "abc-123");
  assert.equal(sharedSearchForNavigation("?shared=abc-123&other=drop"), "?shared=abc-123");
  assert.equal(sharedSearchForNavigation("?other=drop"), "");
});

test("credit store remains an account route without requiring a character", () => {
  assert.equal(pathForStep("credits"), "/app/credits");
  assert.equal(stepFromPath("/app/credits", false), "credits");
  assert.equal(normalizeSavedStep("credits", false), "credits");
});

test("credit store returns to its source only when that source is still valid", () => {
  assert.equal(resolveCreditReturnStep("feed", true), "feed");
  assert.equal(resolveCreditReturnStep("feed", false), "home");
  assert.equal(resolveCreditReturnStep("credits", true), "home");
});
