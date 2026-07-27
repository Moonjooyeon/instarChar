import assert from "node:assert/strict";
import test from "node:test";
import { deleteAuthAccount, signInWithOAuthProvider } from "../../src/api/auth.js";

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

test("deleteAuthAccount requests permanent account deletion", async () => {
  const calls = [];
  const restoreFetch = stubFetch(calls);
  try {
    const result = await deleteAuthAccount();
    assert.deepEqual(result, { error: null });
    assert.equal(calls[0].input, "/api/auth/account");
    assert.equal(calls[0].init.method, "DELETE");
  } finally {
    restoreFetch();
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

function stubFetch(calls) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ input, init });
    return new Response(null, { status: 204 });
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}
