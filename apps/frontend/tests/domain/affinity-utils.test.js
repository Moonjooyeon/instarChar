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
} from "../../src/domain/relationships/affinityUtils.ts";

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
