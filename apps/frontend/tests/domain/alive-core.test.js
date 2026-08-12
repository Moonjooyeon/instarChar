import assert from "node:assert/strict";
import test from "node:test";
import { josa, selfSettingPriorityBlock } from "../../src/domain/app/aliveCore.js";

test("self setting priority preserves the character age", () => {
  const actual = selfSettingPriorityBlock({ name: "리안", age: "21", persona: "차분함" });
  assert.match(actual, /나이: 21/);
});

test("josa selects the natural Korean conjunction", () => {
  assert.equal(josa("리안", "과/와"), "리안과");
  assert.equal(josa("하루", "과/와"), "하루와");
});
