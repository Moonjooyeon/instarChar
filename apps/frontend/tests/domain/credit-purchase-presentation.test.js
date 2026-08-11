import assert from "node:assert/strict";
import test from "node:test";

import {
  creditPurchaseCredits,
  creditPurchaseStatusText,
  creditPurchaseTime,
} from "../../src/domain/credits/creditPurchasePresentation.js";

const purchase = {
  provider_order_id: "order-1",
  sku: "sku-500",
  status: "granted",
  base_credits: 500,
  product_bonus_credits: 0,
  first_purchase_bonus_credits: 50,
  granted_credits: 550,
  chargeback_credits: 0,
  created_at: "2026-08-11T10:00:00Z",
  granted_at: "2026-08-11T10:01:00Z",
  refunded_at: null,
};

test("purchase presentation uses the granted snapshot and latest event time", () => {
  assert.equal(creditPurchaseCredits(purchase), 550);
  assert.equal(creditPurchaseStatusText(purchase.status), "지급 완료");
  assert.equal(creditPurchaseTime(purchase), purchase.granted_at);
});

test("purchase presentation falls back to configured credits before grant", () => {
  const processing = { ...purchase, status: "processing", granted_credits: 0, granted_at: null };
  assert.equal(creditPurchaseCredits(processing), 500);
  assert.equal(creditPurchaseStatusText(processing.status), "처리 중");
  assert.equal(creditPurchaseTime(processing), processing.created_at);
});

test("purchase presentation describes refunds and failures", () => {
  assert.equal(creditPurchaseStatusText("refunded"), "환불 완료");
  assert.equal(creditPurchaseStatusText("failed"), "결제 실패");
  assert.equal(creditPurchaseStatusText("review"), "확인 필요");
});
