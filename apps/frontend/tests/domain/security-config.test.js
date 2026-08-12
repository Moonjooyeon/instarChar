import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("the app shell enforces a restrictive content security policy", () => {
  const html = readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /object-src 'none'/);
  assert.doesNotMatch(html, /script-src[^;]*'unsafe-inline'/);
});
