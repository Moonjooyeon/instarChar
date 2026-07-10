import assert from "node:assert/strict";
import test from "node:test";
import { deleteDmThreadRow } from "../../src/api/dm.js";

test("deleteDmThreadRow deletes owner DM thread through FastAPI", async () => {
  const restoreFetch = stubFetch(new Response(null, { status: 204 }));
  try {
    const result = await deleteDmThreadRow("owner::char-a::peer", "ignored-owner");
    assert.equal(result.error, null);
    assert.equal(globalThis.fetch.calls[0].input, "/api/dm-threads?thread_key=owner%3A%3Achar-a%3A%3Apeer");
    assert.equal(globalThis.fetch.calls[0].init.method, "DELETE");
  } finally {
    restoreFetch();
  }
});

test("deleteDmThreadRow deletes shared DM thread through FastAPI", async () => {
  const restoreFetch = stubFetch(new Response(null, { status: 204 }));
  try {
    const result = await deleteDmThreadRow("dm::a|b", "ignored-owner");
    assert.equal(result.error, null);
    assert.equal(globalThis.fetch.calls[0].input, "/api/shared-dm-threads?thread_key=dm%3A%3Aa%7Cb");
    assert.equal(globalThis.fetch.calls[0].init.method, "DELETE");
  } finally {
    restoreFetch();
  }
});

test("deleteDmThreadRow returns FastAPI error detail", async () => {
  const restoreFetch = stubFetch(jsonResponse({ detail: "Shared DM participant required" }, 403));
  try {
    const result = await deleteDmThreadRow("dm::a|b", "ignored-owner");
    assert.deepEqual(result.error, { message: "Shared DM participant required" });
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
