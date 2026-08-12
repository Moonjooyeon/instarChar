import assert from "node:assert/strict";
import test from "node:test";
import { creditCostSummary, creditFlowMeta, creditUsageAmount, creditUsagePreview } from "../../src/domain/credits/creditPresentation.js";

test("credit cost copy explains energy-first fallback without hiding credits", () => {
  const flow = { code: "direct_dm_basic", label: "기본 대화", energy_percent: 8, credits: 1 };
  assert.equal(creditCostSummary(flow), "에너지 8% 우선 · 부족하면 1C");
  assert.equal(creditCostSummary(flow, 6), "회당 에너지 8% 또는 1C · 최대 6C");
});

test("credit flow metadata makes every DM response tier available", () => {
  assert.deepEqual(creditFlowMeta("direct_dm_basic"), { available: true, category: "conversation", description: "짧고 빠르게 이어가는 일상 대화", tier: "기본 대화" });
  assert.equal(creditFlowMeta("direct_dm_pro").available, true);
  assert.equal(creditFlowMeta("auto_feed_post").tier, "혼자 남기는 근황");
  assert.equal(creditFlowMeta("character_analysis").tier, "첫 1회 무료");
  assert.equal(creditFlowMeta("character_interaction").category, "content");
});

test("credit usage copy separates free and purchased balance sources", () => {
  const usage = { credits: 3, energy_percent: 0, bonus_credits: 2, purchased_credits: 1 };
  assert.equal(creditUsageAmount(usage), "무료 보너스 2C + 구매 크레딧 1C");
  assert.equal(creditUsageAmount({ ...usage, credits: 0, energy_percent: 20, bonus_credits: 0, purchased_credits: 0 }), "무료 에너지 20%");
});

test("DM credit preview makes the next payment source and shortage explicit", () => {
  const flow = { code: "direct_dm_basic", label: "기본 대화", energy_percent: 8, credits: 1 };
  assert.deepEqual(creditUsagePreview(flow, { energy_percent: 20, purchased_credits: 0, total_credits: 0 }), { action: "none", detail: "이번 답장에 에너지 8% 사용 예상", label: "무료 에너지 20%", state: "energy" });
  assert.deepEqual(creditUsagePreview(flow, { energy_percent: 0, purchased_credits: 2, total_credits: 3 }), { action: "none", detail: "에너지 부족 시 1C 사용 예상", label: "보유 크레딧 3C", state: "credits" });
  assert.deepEqual(creditUsagePreview(flow, { energy_percent: 0, purchased_credits: 0, total_credits: 0 }), { action: "open-credits", detail: "이번 답장에 1C 필요 · 보유 0C", label: "크레딧이 부족해요", state: "insufficient" });
  const pro = { code: "direct_dm_pro", label: "중요한 답장", energy_percent: 25, credits: 9, energy_eligible: false, bonus_eligible: false };
  assert.deepEqual(creditUsagePreview(pro, { energy_percent: 100, purchased_credits: 9, total_credits: 59 }), { action: "none", detail: "이번 답장에 9C 사용 예상", label: "구매 크레딧 9C", state: "credits" });
  assert.deepEqual(creditUsagePreview(pro, { energy_percent: 100, purchased_credits: 0, total_credits: 55 }), { action: "open-credits", detail: "중요한 답장은 구매 C만 사용해요 · 9C 필요, 현재 0C", label: "구매 크레딧이 부족해요", state: "insufficient" });
});
