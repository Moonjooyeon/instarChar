import assert from "node:assert/strict";
import test from "node:test";
import { apiFetch, apiNoContent, apiResult, normalizeApiBaseUrl } from "../../src/api/client.js";

test("apiFetch sends same-origin api requests with credentials", async () => {
  const restoreFetch = stubFetch(new Response(null, { status: 204 }));
  try {
    await apiFetch("/profile/state", { method: "GET", query: { ids: ["a", "b"], empty: null } });
    assert.equal(globalThis.fetch.calls[0].input, "/api/profile/state?ids=a&ids=b");
    assert.equal(globalThis.fetch.calls[0].init.credentials, "include");
  } finally {
    restoreFetch();
  }
});

test("normalizeApiBaseUrl adds the backend api prefix to origin-only urls", () => {
  assert.equal(normalizeApiBaseUrl("http://localhost:8000"), "http://localhost:8000/api");
  assert.equal(normalizeApiBaseUrl("http://localhost:8000/"), "http://localhost:8000/api");
  assert.equal(normalizeApiBaseUrl("http://localhost:8000/api"), "http://localhost:8000/api");
  assert.equal(normalizeApiBaseUrl("/api"), "/api");
});

test("apiResult reads JSON responses", async () => {
  const restoreFetch = stubFetch(jsonResponse({ ok: true }));
  try {
    const result = await apiResult("/auth/me");
    assert.deepEqual(result, { data: { ok: true }, error: null });
  } finally {
    restoreFetch();
  }
});

test("apiNoContent accepts empty 204 responses", async () => {
  const restoreFetch = stubFetch(new Response(null, { status: 204 }));
  try {
    const result = await apiNoContent("/auth/logout", { method: "POST" });
    assert.deepEqual(result, { error: null });
  } finally {
    restoreFetch();
  }
});

test("apiResult converts FastAPI detail errors", async () => {
  const restoreFetch = stubFetch(jsonResponse({ detail: "로그인이 필요합니다." }, 401));
  try {
    const result = await apiResult("/profile/state");
    assert.deepEqual(result, { data: null, error: { message: "로그인이 필요합니다." } });
  } finally {
    restoreFetch();
  }
});

test("apiResult converts FastAPI validation detail errors", async () => {
  const restoreFetch = stubFetch(jsonResponse({ detail: [{ msg: "field required" }] }, 403));
  try {
    const result = await apiResult("/profile/state");
    assert.deepEqual(result, { data: null, error: { message: "field required" } });
  } finally {
    restoreFetch();
  }
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(response) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ input, init });
    return response.clone();
  };
  globalThis.fetch.calls = calls;
  return () => {
    globalThis.fetch = originalFetch;
  };
}
