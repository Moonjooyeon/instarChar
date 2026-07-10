import assert from "node:assert/strict";
import test from "node:test";
import {
  chatSafetyRules,
  fieldText,
  normalizeHandle,
  recentLinesBlock,
  worldBridgeBlock,
} from "../../src/domain/app/textUtils.js";

test("fieldText normalizes arrays and object fields", () => {
  assert.equal(fieldText([" 차분함 ", "", "단호함"]), "차분함, 단호함");
  assert.equal(fieldText({ tone: "차분", rule: ["짧게", "존댓말"] }), "tone: 차분 / rule: 짧게, 존댓말");
});

test("normalizeHandle strips symbols and falls back safely", () => {
  assert.equal(normalizeHandle("@Test.User / alt", "fallback"), "test.user");
  assert.equal(normalizeHandle("!!!", "캐릭터"), "character");
  assert.equal(normalizeHandle("", "Alive Hero"), "alive");
});

test("worldBridgeBlock reflects selected world mode", () => {
  const a = { name: "세인", world: "해적 세계" };
  const b = { name: "하루", world: "마법학교" };
  assert.match(worldBridgeBlock(a, b, { mode: "their", note: "항구에서 만난다" }), /상대 세계관/);
  assert.match(worldBridgeBlock(a, b, { mode: "mine" }), /내 세계관/);
  assert.match(worldBridgeBlock(a, b), /중립 교차점/);
});

test("prompt helper blocks are present only when needed", () => {
  assert.equal(recentLinesBlock([]), "");
  assert.match(recentLinesBlock(["첫 말", "둘째 말"]), /이미 나온 말/);
  assert.match(chatSafetyRules({ chatKind: "npc" }), /AI 티 금지/);
});
