import assert from "node:assert/strict";
import test from "node:test";

import { googlePlayIapErrorMessage, isGooglePlayIapRuntime } from "../../src/api/googlePlayIap.js";


test("Google Play IAP is exposed only to the independent Android runtime", () => {
  assert.equal(isGooglePlayIapRuntime("android", true, "capacitor"), true);
  assert.equal(isGooglePlayIapRuntime("android", true, "apps-in-toss"), false);
  assert.equal(isGooglePlayIapRuntime("ios", true, "capacitor"), false);
  assert.equal(isGooglePlayIapRuntime("android", false, "web"), false);
});


test("Google Play IAP surfaces cancellation and unavailable product messages", () => {
  assert.equal(googlePlayIapErrorMessage(new Error("Google Play Billing error 1: cancelled")), "결제를 취소했어요.");
  assert.match(googlePlayIapErrorMessage(new Error("Google Play product is unavailable")), /구매할 수 없어요/);
});
