import assert from "node:assert/strict";
import test from "node:test";
import {
  affinityStage,
  affinityWithBase,
  dirKey,
  finiteNumber,
  nameMatch,
  relationBaseFromLabel,
  relationLabelFromAffinity,
  symmetricRelationBaseFromLabel,
} from "../../src/domain/relationships/affinityUtils.js";
import {
  knownCharacterRelations,
  parseRelations,
} from "../../src/domain/app/aliveCore.js";

test("nameMatch ignores whitespace and supports single-token aliases", () => {
  assert.equal(nameMatch("세 인", "세인"), true);
  assert.equal(nameMatch("하루 세인", "세인"), true);
  assert.equal(nameMatch("세인", "하루 세인"), true);
  assert.equal(nameMatch("세인", "미나"), false);
});

test("relationship labels map to expected affinity bases", () => {
  assert.equal(relationBaseFromLabel("연인"), 100);
  assert.equal(relationBaseFromLabel("오래된 친구"), 45);
  assert.equal(symmetricRelationBaseFromLabel("약혼자"), 92);
  assert.equal(relationBaseFromLabel(""), null);
});

test("affinity helpers preserve romantic base floors", () => {
  assert.equal(dirKey("하루", "세인"), "하루>세인");
  assert.equal(finiteNumber("42", 0), 42);
  assert.equal(finiteNumber("nope", 7), 7);
  assert.equal(affinityWithBase(50, 100), 100);
  assert.equal(affinityWithBase(-5, 100), -5);
  assert.equal(affinityStage(86), "특별한 사이");
});

test("relationLabelFromAffinity crosses positive and negative bands", () => {
  assert.equal(relationLabelFromAffinity(40, ""), "호감");
  assert.equal(relationLabelFromAffinity(10, ""), "아는 사이");
  assert.equal(relationLabelFromAffinity(-25, "호감"), "미움");
  assert.equal(relationLabelFromAffinity(20, "미움"), "관심");
});

test("knownCharacterRelations excludes setting-only relations and preserves source indexes", () => {
  const relations = parseRelations("모카 — 반려묘, 세인 — 친구, 포아 — 라이벌");
  const candidates = [{ name: "세 인" }, { name: "포아" }, { name: "현재 캐릭터" }];
  const result = knownCharacterRelations(relations, candidates, "현재캐릭터");
  assert.deepEqual(result.map(({ who, sourceIndex }) => ({ who, sourceIndex })), [
    { who: "세인", sourceIndex: 1 },
    { who: "포아", sourceIndex: 2 },
  ]);
});

test("knownCharacterRelations reflects newly known characters without changing raw relations", () => {
  const raw = "모카 — 반려묘, 세인 — 친구";
  const relations = parseRelations(raw);
  assert.deepEqual(knownCharacterRelations(relations, [{ name: "세인" }]).map((item) => item.who), ["세인"]);
  assert.deepEqual(knownCharacterRelations(relations, [{ name: "세인" }, { name: "모카" }]).map((item) => item.who), ["모카", "세인"]);
  assert.equal(raw, "모카 — 반려묘, 세인 — 친구");
});

test("knownCharacterRelations requires exact normalized character names", () => {
  const relations = parseRelations("세 — 지인, 세인 — 친구");
  assert.deepEqual(knownCharacterRelations(relations, [{ name: "세인" }]).map((item) => item.who), ["세인"]);
});
