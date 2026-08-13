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

test("the legacy Apps in Toss packager preserves its runtime and API URL", () => {
  const config = readFileSync(path.resolve(process.cwd(), "granite.config.ts"), "utf8");
  const environment = readFileSync(path.resolve(process.cwd(), "../../.env.toss"), "utf8");
  assert.match(config, /vite build --mode toss/);
  assert.match(environment, /VITE_ALIVE_RUNTIME=apps-in-toss/);
  assert.match(environment, /VITE_API_BASE_URL=https:\/\/alive\.imagebgremover\.net\/api/);
});
