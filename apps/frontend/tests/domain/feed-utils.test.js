import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPostTime,
  followedPostId,
  mergeTimelinePosts,
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
    sharedId: "shared1",
    posts: [{ id: "p1", text: "바람이 좋다", time: "2026-01-01T00:00:00.000Z", likes: 3 }],
  });
  assert.equal(imported.length, 1);
  assert.equal(imported[0].id, followedPostId("shared1", "p1", 0));
  assert.equal(imported[0].importedFromFollow, true);
  assert.equal(imported[0].author, "세인");
  assert.equal(imported[0].likes, 3);
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
