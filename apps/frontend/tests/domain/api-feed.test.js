import assert from "node:assert/strict";
import test from "node:test";
import { getFeedPage } from "../../src/api/feed.js";

test("getFeedPage maps a cursor page into feed card posts", async () => {
  const restoreFetch = stubFetch(jsonResponse({
    has_more: true,
    next_cursor: "next-page",
    items: [{
      author_character_id: "character-1",
      author_handle: "sein",
      author_name: "세인",
      author_owner_id: "owner-1",
      author_shared_id: "shared-1",
      post_id: "projection-post-1",
      post: { text: "밤공기가 좋아" },
      recommendation_reason: "interest",
    }],
  }));
  try {
    const page = await getFeedPage("char-1", "recommendations", "current-page");
    assert.equal(globalThis.fetch.calls[0].input, "/api/feed?source_account_id=char-1&kind=recommendations&cursor=current-page&limit=20");
    assert.equal(page.hasMore, true);
    assert.equal(page.nextCursor, "next-page");
    assert.deepEqual(page.posts[0], {
      id: "recommendations:shared-1:projection-post-1",
      originalPostId: "projection-post-1",
      importedFromFollow: false,
      importedFromRecommendation: true,
      author: "세인",
      authorHandle: "sein",
      authorAvatarImg: "",
      authorCharacterId: "character-1",
      authorOwnerId: "owner-1",
      authorSharedId: "shared-1",
      recommendationReason: "interest",
      recommendedCharacter: { id: "shared_shared-1", characterId: "character-1", sharedId: "shared-1", ownerId: "owner-1", name: "세인", handle: "sein", recommendationReason: "interest" },
      text: "밤공기가 좋아",
    });
  } finally {
    restoreFetch();
  }
});

test("getFeedPage keeps posts with the same source id from different authors", async () => {
  const item = {
    author_character_id: "character-1",
    author_handle: "sein",
    author_name: "세인",
    author_owner_id: "owner-1",
    author_shared_id: "shared-1",
    post_id: "same-post",
    post: { text: "첫 번째 글" },
  };
  const restoreFetch = stubFetch(jsonResponse({ has_more: false, next_cursor: null, items: [item, {
    ...item,
    author_character_id: "character-2",
    author_owner_id: "owner-2",
    author_shared_id: "shared-2",
    post: { text: "두 번째 글" },
  }] }));
  try {
    const page = await getFeedPage("char-1", "recommendations");
    assert.deepEqual(page.posts.map((post) => post.id), [
      "recommendations:shared-1:same-post",
      "recommendations:shared-2:same-post",
    ]);
  } finally {
    restoreFetch();
  }
});

function jsonResponse(body) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

function stubFetch(response) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ input, init });
    return response.clone();
  };
  globalThis.fetch.calls = calls;
  return () => { globalThis.fetch = originalFetch; };
}
