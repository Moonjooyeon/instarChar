import assert from "node:assert/strict";
import test from "node:test";
import { postGenerate, readApiContent } from "../../src/api/generate.js";

test("postGenerate sends requests to FastAPI AI endpoint", async () => {
  const restoreFetch = stubFetch(jsonResponse({ content: [{ type: "text", text: "ok" }] }));
  try {
    const response = await postGenerate({ model: "fast", max_tokens: 10, system: "", messages: [{ role: "user", content: "hi" }] });
    assert.equal(response.ok, true);
    assert.equal(globalThis.fetch.calls[0].input, "/api/ai/generate");
    assert.equal(globalThis.fetch.calls[0].init.credentials, "include");
    assert.equal(globalThis.fetch.calls[0].init.method, "POST");
  } finally {
    restoreFetch();
  }
});

test("readApiContent preserves FastAPI generate response shape", async () => {
  const response = jsonResponse({ content: [{ type: "text", text: "hello" }] });
  const text = await readApiContent(response, "테스트 API");
  assert.equal(text, "hello");
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
