import assert from "node:assert/strict";
import test from "node:test";
import { analysisFallbackProfile } from "../../src/domain/app/analysisFallback.js";

test("analysis fallback keeps the creation input startable without manual profile fields", () => {
  const actual = analysisFallbackProfile("[기본 정보]\n리안, 21세. 마법학교 조교.\n\n[성격]\n낯선 사람에게는 시크하다.", "짧은 존댓말을 쓴다.", "a1b2c3");
  assert.deepEqual(actual, { age: "21세", handle: "character-a1b2c3", name: "리안", persona: "낯선 사람에게는 시크하다.", speech: "짧은 존댓말을 쓴다." });
});

test("analysis fallback uses a readable handle base when the name is latin text", () => {
  const actual = analysisFallbackProfile("Lian, 21 years old", "", "z9y8x7");
  assert.equal(actual.handle, "lian-z9y8x7");
});
