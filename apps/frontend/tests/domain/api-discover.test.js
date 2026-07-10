import assert from "node:assert/strict";
import test from "node:test";
import {
  listFollowerTargetRows,
  sharedCharacterResults,
  upsertFollowRow,
  upsertOwnFollowRows,
  upsertSharedCharacter,
} from "../../src/api/discover.js";

test("sharedCharacterResults adapts FastAPI discover response to legacy row buckets", async () => {
  const restoreFetch = stubFetch(jsonResponse({
    characters: [
      {
        autoSynced: true,
        character: { ownerName: "owner-a", persona: "calm" },
        gallery: [{ url: "a.png" }],
        id: "char_owner_char-a",
        name: "A",
        ownerId: "owner",
        ownerName: "owner-a",
        posts: [{ body: "hello" }],
        sourceAccountId: "char-a",
      },
      {
        character: { posts: [{ body: "shared" }] },
        handle: "bee",
        id: "shared_shared-a",
        name: "B",
        ownerId: "owner-b",
        ownerName: "owner-b",
        shared: true,
        sharedId: "shared-a",
        sourceAccountId: "char-b",
        tags: ["tag"],
      },
    ],
  }));
  try {
    const [characters, shared] = await sharedCharacterResults();
    assert.equal(globalThis.fetch.calls[0].input, "/api/discover/characters");
    assert.deepEqual(characters.value.data[0].source_account_id, "char-a");
    assert.deepEqual(characters.value.data[0].posts, [{ body: "hello" }]);
    assert.deepEqual(shared.value.data[0].id, "shared-a");
    assert.deepEqual(shared.value.data[0].owner_name, "owner-b");
  } finally {
    restoreFetch();
  }
});

test("listFollowerTargetRows adapts follower counts to legacy count rows", async () => {
  const restoreFetch = stubFetch(jsonResponse({ counts: { "shared-a": 2, "shared-b": 0 } }));
  try {
    const result = await listFollowerTargetRows(["shared-a", "shared-b"]);
    assert.equal(globalThis.fetch.calls[0].input, "/api/shared-characters/follower-counts?ids=shared-a&ids=shared-b");
    assert.deepEqual(result.data, [
      { target_shared_character_id: "shared-a" },
      { target_shared_character_id: "shared-a" },
    ]);
  } finally {
    restoreFetch();
  }
});

test("upsertSharedCharacter maps legacy shared payload to by-source endpoint", async () => {
  const restoreFetch = stubFetch(jsonResponse({ id: "shared-a" }));
  try {
    const result = await upsertSharedCharacter({
      character: { name: "A" },
      handle: "alive",
      name: "A",
      owner_name: "tester",
      persona: "bright",
      source_account_id: "char-a",
      tags: ["tag"],
    });
    assert.deepEqual(result.data, { id: "shared-a" });
    assert.equal(globalThis.fetch.calls[0].input, "/api/shared-characters/by-source/char-a");
    assert.equal(globalThis.fetch.calls[0].init.method, "PUT");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), {
      character: { name: "A" },
      handle: "alive",
      name: "A",
      owner_name: "tester",
      persona: "bright",
      tags: ["tag"],
    });
  } finally {
    restoreFetch();
  }
});

test("upsertFollowRow sends follower payload to target shared character", async () => {
  const restoreFetch = stubFetch(jsonResponse({ ok: true }));
  try {
    const result = await upsertFollowRow({
      follower_account_id: "char-a",
      follower_character: { name: "A" },
      follower_name: "tester",
      target_shared_character_id: "shared-b",
    });
    assert.equal(result.error, null);
    assert.equal(globalThis.fetch.calls[0].input, "/api/shared-characters/shared-b/follow");
    assert.equal(globalThis.fetch.calls[0].init.method, "PUT");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), {
      follower_account_id: "char-a",
      follower_character: { name: "A" },
      follower_name: "tester",
    });
  } finally {
    restoreFetch();
  }
});

test("upsertOwnFollowRows wraps owned follow snapshot rows", async () => {
  const restoreFetch = stubFetch(new Response(null, { status: 204 }));
  try {
    const result = await upsertOwnFollowRows([{
      follower_account_id: "char-a",
      follower_character: { name: "A" },
      follower_name: "tester",
      target_shared_character_id: "shared-b",
    }]);
    assert.equal(result.error, null);
    assert.equal(globalThis.fetch.calls[0].input, "/api/follows/sync-owned-snapshot");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), {
      rows: [{
        follower_account_id: "char-a",
        follower_character: { name: "A" },
        follower_name: "tester",
        target_shared_character_id: "shared-b",
      }],
    });
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
