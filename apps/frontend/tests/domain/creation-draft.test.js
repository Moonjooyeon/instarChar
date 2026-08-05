import assert from "node:assert/strict";
import test from "node:test";
import { joinCreationDump, splitCreationDump } from "../../src/domain/app/creationDraft.js";

test("legacy creation text remains in the identity step", () => {
  const actual = splitCreationDump("리안, 21세. 마법학교 조교.");
  assert.deepEqual(actual, { identity: "리안, 21세. 마법학교 조교.", personality: "" });
});

test("creation identity and personality survive serialization", () => {
  const serialized = joinCreationDump("리안, 21세.", "낯선 사람에게는 시크하다.");
  const actual = splitCreationDump(serialized);
  assert.deepEqual(actual, { identity: "리안, 21세.", personality: "낯선 사람에게는 시크하다." });
});

test("an empty personality keeps the original analysis input", () => {
  const actual = joinCreationDump("리안, 21세.", "   ");
  assert.equal(actual, "리안, 21세.");
});
