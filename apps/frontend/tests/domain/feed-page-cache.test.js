import assert from "node:assert/strict";
import test from "node:test";
import { FEED_FIRST_PAGE_TTL_MS, feedFirstPageLoadPlan, feedScopeKey, shouldPrefetchFeed, shouldResetFeedCache } from "../../src/domain/feed/feedPageCache.js";

test("feedFirstPageLoadPlan foreground-loads an unfetched page", () => {
  assert.equal(feedFirstPageLoadPlan({ fetchedAt: null, hasLoadedMore: false, hasInFlightRequest: false, now: 100_000 }), "foreground");
});

test("feedFirstPageLoadPlan reuses a first page throughout the short TTL", () => {
  const fetchedAt = 100_000;
  assert.equal(feedFirstPageLoadPlan({ fetchedAt, hasLoadedMore: false, hasInFlightRequest: false, now: fetchedAt + FEED_FIRST_PAGE_TTL_MS }), "reuse");
});

test("feedFirstPageLoadPlan background-refreshes an expired first page", () => {
  const fetchedAt = 100_000;
  assert.equal(feedFirstPageLoadPlan({ fetchedAt, hasLoadedMore: false, hasInFlightRequest: false, now: fetchedAt + FEED_FIRST_PAGE_TTL_MS + 1 }), "background");
});

test("feedFirstPageLoadPlan preserves expired multi-page results during one feed visit", () => {
  const fetchedAt = 100_000;
  assert.equal(feedFirstPageLoadPlan({ fetchedAt, hasLoadedMore: true, hasInFlightRequest: false, now: fetchedAt + FEED_FIRST_PAGE_TTL_MS + 1 }), "reuse");
});

test("feedFirstPageLoadPlan joins an in-flight first-page request", () => {
  assert.equal(feedFirstPageLoadPlan({ fetchedAt: null, hasLoadedMore: false, hasInFlightRequest: true, now: 100_000 }), "join");
});

test("feedScopeKey invalidates cache ownership for account and revision changes", () => {
  const original = feedScopeKey("character-1", "revision-1");
  assert.notEqual(feedScopeKey("character-2", "revision-1"), original);
  assert.notEqual(feedScopeKey("character-1", "revision-2"), original);
});

test("shouldResetFeedCache invalidates a visit only when the feed becomes hidden", () => {
  assert.equal(shouldResetFeedCache(true, false), true);
  assert.equal(shouldResetFeedCache(true, true), false);
  assert.equal(shouldResetFeedCache(false, true), false);
});

test("shouldPrefetchFeed permits recommendation prefetch only on a visible signed-in feed", () => {
  assert.equal(shouldPrefetchFeed("character-1", true), true);
  assert.equal(shouldPrefetchFeed("character-1", false), false);
  assert.equal(shouldPrefetchFeed(null, true), false);
});
