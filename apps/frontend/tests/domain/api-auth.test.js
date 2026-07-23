import assert from "node:assert/strict";
import test from "node:test";
import { signInWithOAuthProvider } from "../../src/api/auth.js";

test("signInWithOAuthProvider sends current origin callback to backend", async () => {
  const assigned = [];
  const restoreWindow = stubWindow("http://192.168.0.2:5173", assigned);
  try {
    const result = await signInWithOAuthProvider("google");
    const url = new URL(assigned[0], "http://192.168.0.2:5173");
    assert.deepEqual(result, { error: null });
    assert.equal(url.pathname, "/api/auth/google/start");
    assert.equal(url.searchParams.get("redirect_uri"), "http://192.168.0.2:5173/api/auth/google/callback");
    assert.equal(url.searchParams.get("return_url"), "http://192.168.0.2:5173");
  } finally {
    restoreWindow();
  }
});

function stubWindow(origin, assigned) {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      origin,
      assign(value) {
        assigned.push(value);
      },
    },
  };
  return () => {
    globalThis.window = originalWindow;
  };
}
