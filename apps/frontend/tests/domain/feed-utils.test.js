import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFollowedLikeState,
  canManagePost,
  followedLikeKey,
  followedLikeState,
  formatPostTime,
  followedPostId,
  followedPostTarget,
  followedPostTargets,
  mergeTimelinePosts,
  optimisticFollowedLike,
  postTimeMs,
  postsFromFollowedCharacter,
  sanitizePosts,
} from "../../src/domain/feed/feedUtils.js";

test("sanitizePosts removes generated failure placeholders", () => {
  const posts = [
    { text: "정상 게시글" },
    { text: "게시글 생성 실패" },
    { text: "" },
  ];
  assert.deepEqual(sanitizePosts(posts).map((post) => post.text), ["정상 게시글", ""]);
});

test("postsFromFollowedCharacter creates imported timeline posts", () => {
  const imported = postsFromFollowedCharacter({
    id: "c1",
    name: "세인",
    handle: "sein",
    characterId: "character1",
    sharedId: "shared1",
    posts: [{ id: "p1", text: "바람이 좋다", time: "2026-01-01T00:00:00.000Z", likes: 3 }],
  });
  assert.equal(imported.length, 1);
  assert.equal(imported[0].id, followedPostId("shared1", "p1", 0));
  assert.equal(imported[0].importedFromFollow, true);
  assert.equal(imported[0].author, "세인");
  assert.equal(imported[0].authorCharacterId, "character1");
  assert.equal(imported[0].likes, 3);
});

test("postsFromFollowedCharacter preserves a zero like count", () => {
  const character = { id: "c1", name: "세인", posts: [{ id: "p1", text: "고요한 밤", likes: 0 }] };
  assert.equal(postsFromFollowedCharacter(character)[0].likes, 0);
  assert.equal(postsFromFollowedCharacter(character)[0].likes, 0);
});

test("canManagePost allows only the current character's posts", () => {
  assert.equal(canManagePost({ id: "mine", text: "내 글" }), true);
  assert.equal(canManagePost({ id: "followed", text: "상대 글", author: "세인", importedFromFollow: true }), false);
});

test("followed post likes apply canonical server state", () => {
  const post = { id: "followed:character:p1", originalPostId: "p1", authorCharacterId: "character", likes: 4, liked: false };
  const item = { target_character_id: "character", post_id: "p1", available: true, likes: 8, liked: true };
  assert.deepEqual(applyFollowedLikeState(post, followedLikeState([item])), { ...post, likes: 8, liked: true });
  assert.equal(followedLikeKey(item), "character:p1");
});

test("followed post targets use character ids for unshared characters", () => {
  const post = { id: "followed:character:p1", originalPostId: "p1", authorCharacterId: "character", authorSharedId: "" };
  assert.deepEqual(followedPostTarget(post), { target_character_id: "character", post_id: "p1" });
  assert.deepEqual(followedPostTargets([post, { ...post }]), [{ target_character_id: "character", post_id: "p1" }]);
  assert.equal(followedPostTarget({ id: "local" }), null);
});

test("optimistic followed likes increment and decrement without going negative", () => {
  const post = { originalPostId: "p1", authorCharacterId: "character", likes: 0, liked: false };
  assert.deepEqual(optimisticFollowedLike(post), { target_character_id: "character", post_id: "p1", available: true, likes: 1, liked: true });
  assert.equal(optimisticFollowedLike({ ...post, liked: true })?.likes, 0);
});

test("mergeTimelinePosts deduplicates and sorts newest first", () => {
  const current = [{ id: "a", text: "old", time: "2026-01-01T00:00:00.000Z" }];
  const incoming = [
    { id: "a", text: "fresh", time: "2026-01-01T00:00:00.000Z", authorHandle: "sein" },
    { id: "b", text: "new", time: "2026-01-02T00:00:00.000Z" },
  ];
  const merged = mergeTimelinePosts(current, incoming);
  assert.deepEqual(merged.map((post) => post.id), ["b", "a"]);
  assert.equal(merged[1].text, "old");
  assert.equal(merged[1].authorHandle, "sein");
});

test("postTimeMs accepts dates, timestamps and parseable strings", () => {
  assert.equal(postTimeMs({ time: new Date("2026-01-01T00:00:00.000Z") }), Date.parse("2026-01-01T00:00:00.000Z"));
  assert.equal(postTimeMs({ id: 42 }), 42);
  assert.equal(postTimeMs({ time: "not-a-date" }), 0);
});

test("formatPostTime uses human-friendly relative thresholds", () => {
  const now = new Date(2026, 6, 23, 12, 0, 0).getTime();
  assert.equal(formatPostTime(now - 59_000, now), "방금");
  assert.equal(formatPostTime(now - 60_000, now), "1분");
  assert.equal(formatPostTime(now - 60 * 60_000, now), "1시간");
  assert.equal(formatPostTime(now - 24 * 60 * 60_000, now), "1일");
  assert.equal(formatPostTime(now - 6 * 24 * 60 * 60_000, now), "6일");
  assert.equal(formatPostTime(new Date(2026, 6, 16, 12, 0, 0), now), "2026.07.16");
});

test("formatPostTime treats invalid and future values as just now", () => {
  const now = new Date(2026, 6, 23, 12, 0, 0).getTime();
  assert.equal(formatPostTime("not-a-date", now), "방금");
  assert.equal(formatPostTime(now + 1_000, now), "방금");
});
