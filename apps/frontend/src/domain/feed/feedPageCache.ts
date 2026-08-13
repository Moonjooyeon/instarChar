export const FEED_FIRST_PAGE_TTL_MS = 30_000;

export type FeedFirstPageLoadPlan = "background" | "foreground" | "join" | "reuse";

type FeedFirstPageLoadInput = {
  fetchedAt: number | null;
  hasLoadedMore: boolean;
  hasInFlightRequest: boolean;
  now: number;
  ttlMs?: number;
};

export function feedFirstPageLoadPlan({ fetchedAt, hasLoadedMore, hasInFlightRequest, now, ttlMs = FEED_FIRST_PAGE_TTL_MS }: FeedFirstPageLoadInput): FeedFirstPageLoadPlan {
  if (hasInFlightRequest) return "join";
  if (fetchedAt === null) return "foreground";
  // Replacing page one would discard the loaded cursor tail; route exit resets the full visit cache instead.
  if (hasLoadedMore) return "reuse";
  return now - fetchedAt <= ttlMs ? "reuse" : "background";
}

export function shouldPrefetchFeed(activeId: string | null, isVisible: boolean): boolean {
  return Boolean(activeId) && isVisible;
}

export function shouldResetFeedCache(wasVisible: boolean, isVisible: boolean): boolean {
  return wasVisible && !isVisible;
}

export function feedScopeKey(activeId: string | null, revision: string): string {
  return JSON.stringify([activeId, revision]);
}
