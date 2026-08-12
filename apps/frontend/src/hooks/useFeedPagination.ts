import { useCallback, useEffect, useRef, useState } from "react";
import { getFeedPage, type FeedKind } from "@/api/feed";
import { mergeFeedPagePosts, type FeedPost } from "@/domain/feed/feedUtils";

type FeedPageState = {
  error: string;
  hasMore: boolean;
  isLoading: boolean;
  nextCursor: string;
  posts: FeedPost[];
};

type FeedPaginationReturn = {
  error: string;
  isLoading: boolean;
  loadMore: () => void;
  recommendationPosts: FeedPost[];
  retry: () => void;
  timelinePosts: FeedPost[];
  hasMore: boolean;
};

type UseFeedPaginationOptions = {
  activeId: string | null;
  feedView: string;
  revision: string;
};

const INITIAL_PAGE: FeedPageState = { error: "", hasMore: true, isLoading: false, nextCursor: "", posts: [] };

export function useFeedPagination({ activeId, feedView, revision }: UseFeedPaginationOptions): FeedPaginationReturn {
  const [pages, setPages] = useState<Record<FeedKind, FeedPageState>>({ timeline: INITIAL_PAGE, recommendations: INITIAL_PAGE });
  const requestRef = useRef<Record<FeedKind, AbortController | null>>({ timeline: null, recommendations: null });
  const activeKind = feedView === "recommendations" ? "recommendations" : "timeline";
  const resetPages = useCallback((): void => {
    requestRef.current.timeline?.abort();
    requestRef.current.recommendations?.abort();
    setPages({ timeline: INITIAL_PAGE, recommendations: INITIAL_PAGE });
  }, []);
  const load = useCallback(async (kind: FeedKind, isReset = false): Promise<void> => {
    if (!activeId) return;
    const current = pages[kind];
    if (!isReset && (current.isLoading || !current.hasMore)) return;
    requestRef.current[kind]?.abort();
    const controller = new AbortController();
    requestRef.current[kind] = controller;
    setPages((value) => ({ ...value, [kind]: { ...(isReset ? INITIAL_PAGE : value[kind]), error: "", isLoading: true } }));
    try {
      const page = await getFeedPage(activeId, kind, isReset ? "" : current.nextCursor, controller.signal);
      if (requestRef.current[kind] !== controller) return;
      setPages((value) => ({ ...value, [kind]: nextPageState(isReset ? INITIAL_PAGE : value[kind], page.posts, page.nextCursor, page.hasMore) }));
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") setPages((value) => ({ ...value, [kind]: { ...value[kind], error: errorMessage(error), isLoading: false } }));
    }
  }, [activeId, pages]);
  useEffect(() => resetPages(), [activeId, resetPages, revision]);
  useEffect(() => { if (activeId && feedView !== "mine") void load(activeKind, true); }, [activeId, activeKind, feedView, revision]);
  useEffect(() => () => { requestRef.current.timeline?.abort(); requestRef.current.recommendations?.abort(); }, []);
  const active = pages[activeKind];
  return { error: active.error, isLoading: active.isLoading, loadMore: () => { void load(activeKind); }, recommendationPosts: pages.recommendations.posts, retry: () => { void load(activeKind, active.posts.length === 0); }, timelinePosts: pages.timeline.posts, hasMore: active.hasMore };
}

function nextPageState(current: FeedPageState, incoming: FeedPost[], nextCursor: string, hasMore: boolean): FeedPageState {
  const posts = mergeFeedPagePosts(current.posts, incoming);
  return { error: "", hasMore, isLoading: false, nextCursor, posts };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "피드를 불러오지 못했어요.";
}
