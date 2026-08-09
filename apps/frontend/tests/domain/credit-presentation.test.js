import assert from "node:assert/strict";
import test from "node:test";
import { creditCostSummary, creditFlowMeta } from "../../src/domain/credits/creditPresentation.js";

test("credit cost copy explains energy-first fallback without hiding credits", () => {
  const flow = { code: "direct_dm_basic", label: "기본 대화", energy_percent: 8, credits: 1 };
  assert.equal(creditCostSummary(flow), "에너지 8% 우선 · 부족하면 1C");
  assert.equal(creditCostSummary(flow, 6), "회당 에너지 8% 또는 1C · 최대 6C");
});

test("credit flow metadata separates active and planned experiences", () => {
  assert.deepEqual(creditFlowMeta("direct_dm_basic"), { available: true, category: "conversation", description: "짧고 빠르게 이어가는 일상 대화", tier: "빠른 응답" });
  assert.equal(creditFlowMeta("direct_dm_pro_story").available, false);
  assert.equal(creditFlowMeta("character_interaction").category, "content");
});
