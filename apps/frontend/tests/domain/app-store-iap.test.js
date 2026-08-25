import assert from "node:assert/strict";
import test from "node:test";

import { appStoreIapErrorMessage, isAppStoreIapRuntime } from "../../src/api/appStoreIap.js";


test("App Store IAP is exposed only to the independent iOS runtime", () => {
  assert.equal(isAppStoreIapRuntime("ios", true, "capacitor"), true);
  assert.equal(isAppStoreIapRuntime("ios", true, "apps-in-toss"), false);
  assert.equal(isAppStoreIapRuntime("android", true, "capacitor"), false);
  assert.equal(isAppStoreIapRuntime("ios", false, "web"), false);
});


test("App Store IAP surfaces cancellation and unavailable product messages", () => {
  assert.equal(appStoreIapErrorMessage(new Error("App Store purchase cancelled")), "결제를 취소했어요.");
  assert.match(appStoreIapErrorMessage(new Error("App Store product is unavailable")), /구매할 수 없어요/);
});
