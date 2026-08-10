import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorText, cleanApiFailureMessage, createGenerateRequestKey, postGenerate, readApiContent } from "../../src/api/generate.js";

test("postGenerate sends requests to FastAPI AI endpoint", async () => {
  const restoreFetch = stubFetch(jsonResponse({ content: [{ type: "text", text: "ok" }] }));
  try {
    const response = await postGenerate({ flow: "assist_social", idempotency_key: "test-request-key", model: "fast", max_tokens: 10, system: "", messages: [{ role: "user", content: "hi" }] });
    assert.equal(response.ok, true);
    assert.equal(globalThis.fetch.calls[0].input, "/api/ai/generate");
    assert.equal(globalThis.fetch.calls[0].init.credentials, "include");
    assert.equal(globalThis.fetch.calls[0].init.method, "POST");
    assert.equal(JSON.parse(globalThis.fetch.calls[0].init.body).idempotency_key, "test-request-key");
  } finally {
    restoreFetch();
  }
});

test("createGenerateRequestKey scopes a unique client action", () => {
  const key = createGenerateRequestKey("dm");
  assert.match(key, /^dm:[0-9a-f-]{36}$/);
});

test("readApiContent preserves FastAPI generate response shape", async () => {
  const response = jsonResponse({ content: [{ type: "text", text: "hello" }] });
  const text = await readApiContent(response, "테스트 API");
  assert.equal(text, "hello");
});

test("daily limit errors distinguish free fallback from a hard stop", () => {
  assert.match(apiErrorText({ error: "FREE_FLOW_DAILY_LIMIT_EXCEEDED" }), /구매 크레딧/);
  assert.match(apiErrorText({ error: "FLOW_DAILY_LIMIT_EXCEEDED" }), /내일/);
});

test("provider names are not exposed in user-facing failures", () => {
  assert.equal(cleanApiFailureMessage(new Error("MonoGPT Gemini API key missing"), "다시 시도해줘."), "다시 시도해줘.");
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
