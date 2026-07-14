import assert from "node:assert/strict";
import test from "node:test";
import {
  sharedCharacterUrl,
  sharedIdFromSearch,
  sharedSearchForNavigation,
} from "../../src/domain/app/aliveCore.js";

test("sharedCharacterUrl points shared links at the discover route", () => {
  assert.equal(
    sharedCharacterUrl("http://localhost:5173", "6734b3b5-8b80-46f3-b6d9-b472e3288aa6"),
    "http://localhost:5173/app/discover?shared=6734b3b5-8b80-46f3-b6d9-b472e3288aa6",
  );
});

test("sharedSearchForNavigation preserves shared query during route normalization", () => {
  assert.equal(sharedIdFromSearch("?shared=abc-123&other=drop"), "abc-123");
  assert.equal(sharedSearchForNavigation("?shared=abc-123&other=drop"), "?shared=abc-123");
  assert.equal(sharedSearchForNavigation("?other=drop"), "");
});
