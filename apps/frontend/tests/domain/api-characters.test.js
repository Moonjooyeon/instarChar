import assert from "node:assert/strict";
import test from "node:test";
import {
  CharacterApiError,
  getCharacterHandleAvailability,
  saveCharacter,
} from "../../src/api/characters.js";

test("availability normalizes the handle and sends edit exclusion", async () => {
  const restoreFetch = stubFetch(jsonResponse({ handle: "hero", available: true }));
  try {
    const result = await getCharacterHandleAvailability("@Hero", "char 1");
    assert.deepEqual(result, { handle: "hero", available: true });
    assert.equal(globalThis.fetch.calls[0].input, "/api/characters/handle-availability?handle=hero&exclude_source_account_id=char+1");
  } finally {
    restoreFetch();
  }
});

test("saveCharacter encodes the stable source id and sends full state", async () => {
  const payload = { name: "Hero", handle: "@Hero", character: {}, gallery: [], following: [] };
  const restoreFetch = stubFetch(jsonResponse({ ...payload, handle: "hero", source_account_id: "draft 1" }));
  try {
    const result = await saveCharacter("draft 1", payload);
    const request = globalThis.fetch.calls[0];
    assert.equal(request.input, "/api/characters/draft%201");
    assert.equal(request.init.method, "PUT");
    assert.deepEqual(JSON.parse(request.init.body), payload);
    assert.equal(result.handle, "hero");
  } finally {
    restoreFetch();
  }
});

test("saveCharacter preserves stable conflict details", async () => {
  const restoreFetch = stubFetch(jsonResponse({ error: "CHARACTER_HANDLE_TAKEN", message: "이미 사용 중" }, 409));
  try {
    await assert.rejects(() => saveCharacter("draft-1", { name: "Hero", handle: "hero", character: {}, gallery: [], following: [] }), (error) => {
      assert.equal(error instanceof CharacterApiError, true);
      assert.equal(error.status, 409);
      assert.equal(error.code, "CHARACTER_HANDLE_TAKEN");
      return true;
    });
  } finally {
    restoreFetch();
  }
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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
