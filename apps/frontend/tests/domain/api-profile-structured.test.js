import assert from "node:assert/strict";
import test from "node:test";
import { loadProfileRow, upsertProfile } from "../../src/api/profiles.js";
import {
  deleteStructuredCharacterData,
  loadStructuredRows,
  syncStructuredRows,
} from "../../src/api/structured.js";

test("upsertProfile stores profile state through FastAPI", async () => {
  const restoreFetch = stubFetch(new Response(null, { status: 204 }));
  try {
    const result = await upsertProfile({ display_name: "alive", onboarded: true, app_state: { accounts: [] } });
    assert.equal(result.error, null);
    assert.equal(globalThis.fetch.calls[0].input, "/api/profile/state");
    assert.equal(globalThis.fetch.calls[0].init.method, "PUT");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), {
      display_name: "alive",
      onboarded: true,
      app_state: { accounts: [] },
    });
  } finally {
    restoreFetch();
  }
});

test("upsertProfile sends onboarding updates without replacing app_state", async () => {
  const restoreFetch = stubFetch(new Response(null, { status: 204 }));
  try {
    const result = await upsertProfile({ display_name: "alive", onboarded: true });
    assert.equal(result.error, null);
    assert.equal(globalThis.fetch.calls[0].input, "/api/profile/onboarding");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), { display_name: "alive" });
  } finally {
    restoreFetch();
  }
});

test("loadProfileRow reads profile state through FastAPI", async () => {
  const restoreFetch = stubFetch(jsonResponse({ display_name: "alive", onboarded: true, app_state: { accounts: [] } }));
  try {
    const result = await loadProfileRow("ignored-user-id");
    assert.deepEqual(result.data, { display_name: "alive", onboarded: true, app_state: { accounts: [] } });
    assert.equal(globalThis.fetch.calls[0].input, "/api/profile/state");
  } finally {
    restoreFetch();
  }
});

test("syncStructuredRows maps legacy row buckets to FastAPI payload", async () => {
  const restoreFetch = stubFetch(new Response(null, { status: 204 }));
  try {
    const result = await syncStructuredRows({
      characterRows: [{ source_account_id: "char-1", name: "A" }],
      ownerDmRows: [{ thread_key: "owner::char-1::A" }],
      personaRows: [{ persona_id: "p1", name: "P" }],
      sharedDmRows: [{ thread_key: "dm::A|B" }],
    });
    assert.equal(result[0].status, "fulfilled");
    assert.equal(globalThis.fetch.calls[0].input, "/api/profile/structured-state");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), {
      characters: [{ source_account_id: "char-1", name: "A" }],
      personas: [{ persona_id: "p1", name: "P" }],
      dm_threads: [{ thread_key: "owner::char-1::A" }],
      shared_dm_threads: [{ thread_key: "dm::A|B" }],
    });
  } finally {
    restoreFetch();
  }
});

test("loadStructuredRows adapts FastAPI profile state to legacy settled results", async () => {
  const restoreFetch = stubFetch(jsonResponse({
    characters: [{ source_account_id: "char-1", name: "A" }],
    personas: [{ persona_id: "p1", name: "P" }],
    dm_threads: [{ thread_key: "owner::char-1::A" }],
    shared_dm_threads: [{ thread_key: "dm::A|B" }],
  }));
  try {
    const [chars, details, personas, ownerDm, sharedDm] = await loadStructuredRows("ignored-user-id");
    assert.deepEqual(chars.value.data, [{ source_account_id: "char-1", name: "A" }]);
    assert.deepEqual(details.value.data, [{ source_account_id: "char-1", name: "A" }]);
    assert.deepEqual(personas.value.data, [{ persona_id: "p1", name: "P" }]);
    assert.deepEqual(ownerDm.value.data, [{ thread_key: "owner::char-1::A" }]);
    assert.deepEqual(sharedDm.value.data, [{ thread_key: "dm::A|B" }]);
  } finally {
    restoreFetch();
  }
});

test("loadStructuredRows reuses the profile bootstrap response without another request", async () => {
  const restoreFetch = stubFetch(jsonResponse({}));
  try {
    const [chars, details, personas, ownerDm, sharedDm] = await loadStructuredRows("ignored-user-id", {
      characters: [{ source_account_id: "char-1", name: "A" }],
      personas: [{ persona_id: "p1", name: "P" }],
      dm_threads: [{ thread_key: "owner::char-1::A" }],
      shared_dm_threads: [{ thread_key: "dm::A|B" }],
    });
    assert.deepEqual(chars.value.data, [{ source_account_id: "char-1", name: "A" }]);
    assert.deepEqual(details.value.data, [{ source_account_id: "char-1", name: "A" }]);
    assert.deepEqual(personas.value.data, [{ persona_id: "p1", name: "P" }]);
    assert.deepEqual(ownerDm.value.data, [{ thread_key: "owner::char-1::A" }]);
    assert.deepEqual(sharedDm.value.data, [{ thread_key: "dm::A|B" }]);
    assert.equal(globalThis.fetch.calls.length, 0);
  } finally {
    restoreFetch();
  }
});

test("deleteStructuredCharacterData calls character cleanup endpoint", async () => {
  const restoreFetch = stubFetch(new Response(null, { status: 204 }));
  try {
    const result = await deleteStructuredCharacterData("ignored-user-id", "char 1");
    assert.equal(result[0].status, "fulfilled");
    assert.equal(globalThis.fetch.calls[0].input, "/api/characters/char%201");
    assert.equal(globalThis.fetch.calls[0].init.method, "DELETE");
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
