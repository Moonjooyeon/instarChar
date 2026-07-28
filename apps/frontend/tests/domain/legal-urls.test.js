import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
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

test("static legal pages prefer native Korean system fonts", () => {
  const css = readFileSync(path.resolve(process.cwd(), "public/legal.css"), "utf8");
  assert.match(css, /font-family: -apple-system/);
  assert.doesNotMatch(css, /font-family: Pretendard/);
});
