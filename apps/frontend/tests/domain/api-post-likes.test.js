import assert from "node:assert/strict";
import test from "node:test";
import { queryPostLikes, updatePostLike } from "../../src/api/postLikes.js";


test("queryPostLikes sends current character and authoritative post ids", async () => {
  const item = likeItem("shared-1", "post-1", true, 4);
  const restoreFetch = stubFetch([jsonResponse({ items: [item] })]);
  try {
    assert.deepEqual(await queryPostLikes("char-1", [target("shared-1", "post-1")]), [item]);
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), { liker_account_id: "char-1", targets: [target("shared-1", "post-1")] });
  } finally {
    restoreFetch();
  }
});

test("queryPostLikes splits more than one hundred targets", async () => {
  const targets = Array.from({ length: 101 }, (_, index) => target("shared-1", `post-${index}`));
  const restoreFetch = stubFetch([jsonResponse({ items: [] }), jsonResponse({ items: [] })]);
  try {
    await queryPostLikes("char-1", targets);
    assert.equal(globalThis.fetch.calls.length, 2);
    assert.equal(JSON.parse(globalThis.fetch.calls[0].init.body).targets.length, 100);
    assert.equal(JSON.parse(globalThis.fetch.calls[1].init.body).targets.length, 1);
  } finally {
    restoreFetch();
  }
});

test("updatePostLike sends the desired final state", async () => {
  const item = likeItem("shared-1", "post-1", false, 3);
  const restoreFetch = stubFetch([jsonResponse(item)]);
  try {
    assert.deepEqual(await updatePostLike("char-1", target("shared-1", "post-1"), false), item);
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), { liker_account_id: "char-1", target_shared_character_id: "shared-1", post_id: "post-1", liked: false });
  } finally {
    restoreFetch();
  }
});

function target(sharedId, postId) {
  return { target_shared_character_id: sharedId, post_id: postId };
}

function likeItem(sharedId, postId, liked, likes) {
  return { ...target(sharedId, postId), available: true, liked, likes };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetch(responses) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ input, init });
    return responses[calls.length - 1].clone();
  };
  globalThis.fetch.calls = calls;
  return () => {
    globalThis.fetch = originalFetch;
  };
}
