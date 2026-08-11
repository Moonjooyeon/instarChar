import assert from "node:assert/strict";
import test from "node:test";

import { collectRefundedTossIapOrders, isAppsInTossIapRuntime, tossIapErrorMessage } from "../../src/api/tossIap.js";


test("IAP is exposed only in the Apps in Toss runtime", () => {
  assert.equal(isAppsInTossIapRuntime("apps-in-toss"), true);
  assert.equal(isAppsInTossIapRuntime("capacitor"), false);
  assert.equal(isAppsInTossIapRuntime("web"), false);
});


test("IAP errors distinguish cancellation, pending, restoration, and app updates", () => {
  assert.equal(tossIapErrorMessage({ code: "USER_CANCELED" }), "결제를 취소했어요.");
  assert.match(tossIapErrorMessage({ code: "PAYMENT_PENDING" }), /기다리고/);
  assert.match(tossIapErrorMessage({ code: "PRODUCT_NOT_GRANTED_BY_PARTNER" }), /복원/);
  assert.match(tossIapErrorMessage({ code: "UNSUPPORTED_APP_VERSION" }), /업데이트/);
  assert.match(tossIapErrorMessage({ errorCode: "INVALID_PRODUCT_ID" }), /상품 정보/);
  assert.match(tossIapErrorMessage({ errorCode: "NETWORK_ERROR" }), /서버/);
  assert.match(tossIapErrorMessage({ errorCode: "APP_MARKET_VERIFICATION_FAILED" }), /앱마켓/);
});


test("IAP refund history follows pagination and returns only refunded orders", async () => {
  const keys = [];
  const pages = [
    { hasNext: true, nextKey: "page-2", orders: [{ orderId: "done-1", sku: "sku-1", status: "COMPLETED", date: "2026-08-10" }] },
    { hasNext: false, orders: [{ orderId: "refund-1", sku: "sku-1", status: "REFUNDED", date: "2026-08-11" }] },
  ];
  const result = await collectRefundedTossIapOrders(async ({ key }) => {
    keys.push(key);
    return pages.shift();
  });
  assert.deepEqual(keys, [null, "page-2"]);
  assert.deepEqual(result.map((order) => order.orderId), ["refund-1"]);
});
