import assert from "node:assert/strict";
import test from "node:test";
import {
  CharacterPostsApiError,
  createCharacterPostComment,
  generateCharacterPost,
  getCharacterPosts,
  saveCharacterPosts,
  updateCharacterAutoPost,
} from "../../src/api/characterPosts.js";

const state = {
  posts: [],
  revision: 3,
  auto_post_enabled: true,
  auto_post_interval_seconds: 1800,
  next_auto_post_at: null,
  last_auto_post_at: null,
  last_auto_post_error: "",
  auto_post_failure_count: 0,
};

test("getCharacterPosts reads the authoritative character feed", async () => {
  const restoreFetch = stubFetch(jsonResponse(state));
  try {
    assert.deepEqual(await getCharacterPosts("char 1"), state);
    assert.equal(globalThis.fetch.calls[0].input, "/api/characters/char%201/posts");
  } finally {
    restoreFetch();
  }
});

test("saveCharacterPosts sends posts with their expected revision", async () => {
  const restoreFetch = stubFetch(jsonResponse({ ...state, revision: 4 }));
  try {
    await saveCharacterPosts("char-1", [{ id: "post-1" }], 3);
    const request = globalThis.fetch.calls[0];
    assert.equal(request.init.method, "PUT");
    assert.deepEqual(JSON.parse(request.init.body), { posts: [{ id: "post-1" }], revision: 3 });
  } finally {
    restoreFetch();
  }
});

test("updateCharacterAutoPost persists one of the supported intervals", async () => {
  const restoreFetch = stubFetch(jsonResponse(state));
  try {
    await updateCharacterAutoPost("char-1", true, 21600);
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), { enabled: true, interval_seconds: 21600 });
  } finally {
    restoreFetch();
  }
});

test("generateCharacterPost sends the client action key", async () => {
  const restoreFetch = stubFetch(jsonResponse({ post: { id: "post-1" }, state }));
  try {
    await generateCharacterPost("char-1", "일상", "feed-post:test-key");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), { idempotency_key: "feed-post:test-key", mood: "일상" });
  } finally {
    restoreFetch();
  }
});

test("post API exposes revision conflicts for one retry", async () => {
  const restoreFetch = stubFetch(jsonResponse({ error: "CONFLICT", message: "Post revision is stale" }, 409));
  try {
    await assert.rejects(() => saveCharacterPosts("char-1", [], 2), (error) => {
      assert.equal(error instanceof CharacterPostsApiError, true);
      assert.equal(error.status, 409);
      assert.equal(error.code, "CONFLICT");
      return true;
    });
  } finally {
    restoreFetch();
  }
});

test("createCharacterPostComment sends a current-character identity to the public post", async () => {
  const restoreFetch = stubFetch(jsonResponse({ comments: [{ name: "세인", text: "좋은 밤" }] }));
  try {
    const comments = await createCharacterPostComment("character 1", "post/1", "char-1", { handle: "sein", name: "세인", replyTo: "리안", text: "좋은 밤" });
    assert.deepEqual(comments, [{ name: "세인", text: "좋은 밤" }]);
    assert.equal(globalThis.fetch.calls[0].input, "/api/characters/public/character%201/posts/post%2F1/comments");
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), { commenter_account_id: "char-1", handle: "sein", name: "세인", reply_to: "리안", text: "좋은 밤" });
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
