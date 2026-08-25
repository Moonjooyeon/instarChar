import assert from "node:assert/strict";
import test from "node:test";
import {
  getCreditBalance,
  getCreditCatalog,
  getCreditPurchases,
  getCreditUsage,
  getGooglePlayPurchaseContext,
  getAppStorePurchaseContext,
  grantAppStoreCreditPurchase,
  grantGooglePlayCreditPurchase,
  grantCreditPurchase,
} from "../../src/api/credits.js";

test("credit APIs read the server-owned balance, catalog, purchase history, and usage", async () => {
  const responses = [
    {
      total_credits: 400,
      bonus_credits: 400,
      purchased_credits: 0,
      energy_percent: 92,
      reward_missions: [{ code: "signup", credits: 50, completed: true }],
    },
    {
      offers: [{ id: "credit-30000", payment_available: false }],
      flows: [{ code: "direct_dm_basic", credits: 1 }],
    },
    {
      items: [{ provider_order_id: "order-1", status: "granted", granted_credits: 550 }],
    },
    {
      items: [{ id: "usage-1", flow: "direct_dm_basic", status: "committed", bonus_credits: 2, purchased_credits: 1 }],
    },
  ];
  const restoreFetch = stubFetch(responses);
  try {
    const balance = await getCreditBalance();
    assert.equal(balance.energy_percent, 92);
    assert.equal(balance.reward_missions[0].code, "signup");
    assert.equal((await getCreditCatalog()).offers[0].payment_available, false);
    assert.equal((await getCreditPurchases()).items[0].granted_credits, 550);
    const usage = (await getCreditUsage()).items[0];
    assert.equal(usage.status, "committed");
    assert.equal(usage.purchased_credits, 1);
    assert.deepEqual(
      globalThis.fetch.calls.map((call) => call.input),
      ["/api/credits", "/api/credits/catalog", "/api/credits/purchases", "/api/credits/usage"],
    );
  } finally {
    restoreFetch();
  }
});

test("credit purchase grant posts provider order, product, and operational environment", async () => {
  const restoreFetch = stubFetch([{ order_id: "order-1", status: "granted", granted_credits: 550 }]);
  try {
    const result = await grantCreditPurchase("order-1", "sku-500", "sandbox");
    const call = globalThis.fetch.calls[0];
    assert.equal(result.status, "granted");
    assert.equal(call.input, "/api/credits/purchases/grant");
    assert.equal(call.init.method, "POST");
    assert.deepEqual(JSON.parse(call.init.body), { order_id: "order-1", sku: "sku-500", environment: "sandbox" });
  } finally {
    restoreFetch();
  }
});


test("Google Play credit APIs request a server-owned account context and purchase-token grant", async () => {
  const restoreFetch = stubFetch([{ available: true, obfuscated_account_id: "account" }, { order_id: "token", status: "granted", granted_credits: 550 }]);
  try {
    const context = await getGooglePlayPurchaseContext();
    const result = await grantGooglePlayCreditPurchase("purchase-token");
    assert.deepEqual(context, { available: true, obfuscated_account_id: "account" });
    assert.equal(result.order_id, "token");
    assert.equal(globalThis.fetch.calls[0].input, "/api/credits/purchases/google-play/context");
    assert.equal(globalThis.fetch.calls[1].input, "/api/credits/purchases/google-play/grant");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[1].init.body), { purchase_token: "purchase-token" });
  } finally {
    restoreFetch();
  }
});

test("App Store credit APIs request an account token and send a signed transaction", async () => {
  const restoreFetch = stubFetch([{ available: true, app_account_token: "token" }, { order_id: "transaction", status: "granted", granted_credits: 550 }]);
  try {
    const context = await getAppStorePurchaseContext();
    const result = await grantAppStoreCreditPurchase("signed-transaction");
    assert.deepEqual(context, { available: true, app_account_token: "token" });
    assert.equal(result.order_id, "transaction");
    assert.equal(globalThis.fetch.calls[0].input, "/api/credits/purchases/app-store/context");
    assert.equal(globalThis.fetch.calls[1].input, "/api/credits/purchases/app-store/grant");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[1].init.body), { signed_transaction: "signed-transaction" });
  } finally {
    restoreFetch();
  }
});

function stubFetch(bodies) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ input, init });
    return new Response(JSON.stringify(bodies.shift()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  globalThis.fetch.calls = calls;
  return () => {
    globalThis.fetch = originalFetch;
  };
}
