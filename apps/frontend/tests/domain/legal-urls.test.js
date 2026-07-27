import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_DELETION_URL,
  PRIVACY_POLICY_URL,
  TERMS_URL,
} from "../../src/domain/app/legal.js";

test("legal URLs use public HTTPS pages", () => {
  assert.equal(PRIVACY_POLICY_URL, "https://alive.imagebgremover.net/privacy/");
  assert.equal(TERMS_URL, "https://alive.imagebgremover.net/terms/");
  assert.equal(
    ACCOUNT_DELETION_URL,
    "https://alive.imagebgremover.net/account-deletion/",
  );
});
