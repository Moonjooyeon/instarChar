import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { getFeedPage, type FeedKind, type FeedPage } from "@/api/feed";
import { feedFirstPageLoadPlan, feedScopeKey, shouldPrefetchFeed, shouldResetFeedCache, type FeedFirstPageLoadPlan } from "@/domain/feed/feedPageCache";
import { mergeFeedPagePosts, type FeedPost } from "@/domain/feed/feedUtils";

type FeedPageState = {
  error: string;
  errorCursor: string | null;
  firstPageFetchedAt: number | null;
  hasMore: boolean;
  isLoading: boolean;
  loadedPageCount: number;
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
  isVisible: boolean;
  revision: string;
};

type FeedPages = Record<FeedKind, FeedPageState>;

type FeedRequest = {
  controller: AbortController;
  cursor: string;
  promise: Promise<void>;
  scope: string;
};

type RequestRuntime = {
  controller: AbortController;
  cursor: string;
  kind: FeedKind;
  requests: MutableRefObject<Record<FeedKind, FeedRequest | null>>;
  scope: string;
  scopeRef: MutableRefObject<string>;
  sourceAccountId: string;
  updatePage: (kind: FeedKind, update: (current: FeedPageState) => FeedPageState) => void;
};

const INITIAL_PAGE: FeedPageState = { error: "", errorCursor: null, firstPageFetchedAt: null, hasMore: true, isLoading: false, loadedPageCount: 0, nextCursor: "", posts: [] };
const RECOMMENDATION_PREFETCH_DELAY_MS = 300;

export function useFeedPagination({ activeId, feedView, isVisible, revision }: UseFeedPaginationOptions): FeedPaginationReturn {
  const activeKind: FeedKind = feedView === "recommendations" ? "recommendations" : "timeline";
  const scope: string = feedScopeKey(activeId, revision);
  const [pages, setPages] = useState<FeedPages>(createInitialPages);
  const activeIdRef = useRef<string | null>(activeId);
  const activeKindRef = useRef<FeedKind>(activeKind);
  const pagesRef = useRef<FeedPages>(pages);
  const scopeRef = useRef<string>(scope);
  const initializedScopeRef = useRef<string>("");
  const requestsRef = useRef<Record<FeedKind, FeedRequest | null>>({ timeline: null, recommendations: null });
  const wasVisibleRef = useRef<boolean>(isVisible);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  activeIdRef.current = activeId; activeKindRef.current = activeKind; scopeRef.current = scope; pagesRef.current = pages;
  const updatePage = useCallback(createPageUpdater(pagesRef, setPages), []);
  const fetchPage = useCallback(createPageFetcher(activeIdRef, scopeRef, requestsRef, updatePage), [updatePage]);
  const loadFirst = useCallback(createFirstPageLoader(pagesRef, scopeRef, requestsRef, fetchPage), [fetchPage]);
  const loadMore = useCallback((): void => { void loadNextPage(activeIdRef, activeKindRef, pagesRef, requestsRef, fetchPage, loadFirst); }, [fetchPage, loadFirst]);
  const retry = useCallback((): void => { void retryPage(activeKindRef, pagesRef, fetchPage, loadFirst); }, [fetchPage, loadFirst]);
  useFeedEffects({ activeId, activeKind, feedView, initializedScopeRef, isVisible, loadFirst, pagesRef, requestsRef, revision, scope, setPages, unmountTimerRef, wasVisibleRef });
  const visiblePages: FeedPages = initializedScopeRef.current === scope ? pages : createInitialPages();
  const active: FeedPageState = visiblePages[activeKind];
  return { error: active.error, isLoading: active.isLoading, loadMore, recommendationPosts: visiblePages.recommendations.posts, retry, timelinePosts: visiblePages.timeline.posts, hasMore: active.hasMore };
}

type FeedEffectOptions = UseFeedPaginationOptions & {
  activeKind: FeedKind;
  initializedScopeRef: MutableRefObject<string>;
  loadFirst: (kind: FeedKind, force?: boolean) => Promise<void>;
  pagesRef: MutableRefObject<FeedPages>;
  requestsRef: MutableRefObject<Record<FeedKind, FeedRequest | null>>;
  scope: string;
  setPages: Dispatch<SetStateAction<FeedPages>>;
  unmountTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  wasVisibleRef: MutableRefObject<boolean>;
};

function useFeedEffects(options: FeedEffectOptions): void {
  useEffect((): void => resetFeedScope(options), [options.scope]);
  useEffect((): void => resetHiddenFeedCache(options), [options.isVisible]);
  useEffect((): void => { if (options.activeId && options.isVisible && options.feedView !== "mine") void options.loadFirst(options.activeKind); }, [options.activeId, options.activeKind, options.feedView, options.isVisible, options.loadFirst, options.revision]);
  useEffect(() => schedulePrefetch(options.activeId, options.isVisible, options.loadFirst), [options.activeId, options.isVisible, options.loadFirst, options.revision]);
  useEffect(() => scheduleUnmountAbort(options.requestsRef, options.unmountTimerRef), []);
}

function createPageUpdater(pagesRef: MutableRefObject<FeedPages>, setPages: Dispatch<SetStateAction<FeedPages>>): (kind: FeedKind, update: (current: FeedPageState) => FeedPageState) => void {
  return (kind: FeedKind, update: (current: FeedPageState) => FeedPageState): void => {
    const next: FeedPages = { ...pagesRef.current, [kind]: update(pagesRef.current[kind]) };
    pagesRef.current = next;
    setPages(next);
  };
}

function createPageFetcher(activeIdRef: MutableRefObject<string | null>, scopeRef: MutableRefObject<string>, requestsRef: MutableRefObject<Record<FeedKind, FeedRequest | null>>, updatePage: RequestRuntime["updatePage"]): (kind: FeedKind, cursor: string) => Promise<void> {
  return (kind: FeedKind, cursor: string): Promise<void> => {
    const sourceAccountId: string | null = activeIdRef.current;
    if (!sourceAccountId) return Promise.resolve();
    const current: FeedRequest | null = requestsRef.current[kind];
    if (current?.cursor === cursor && current.scope === scopeRef.current) return current.promise;
    current?.controller.abort();
    const controller = new AbortController();
    const runtime: RequestRuntime = { controller, cursor, kind, requests: requestsRef, scope: scopeRef.current, scopeRef, sourceAccountId, updatePage };
    const promise: Promise<void> = executeRequest(runtime);
    requestsRef.current[kind] = { controller, cursor, promise, scope: runtime.scope };
    updatePage(kind, (page: FeedPageState): FeedPageState => ({ ...page, error: "", errorCursor: null, isLoading: cursor !== "" || page.firstPageFetchedAt === null }));
    return promise;
  };
}

function createFirstPageLoader(pagesRef: MutableRefObject<FeedPages>, scopeRef: MutableRefObject<string>, requestsRef: MutableRefObject<Record<FeedKind, FeedRequest | null>>, fetchPage: (kind: FeedKind, cursor: string) => Promise<void>): (kind: FeedKind, force?: boolean) => Promise<void> {
  return (kind: FeedKind, force = false): Promise<void> => {
    const current: FeedPageState = pagesRef.current[kind];
    const request: FeedRequest | null = requestsRef.current[kind];
    const hasInFlightRequest: boolean = request?.cursor === "" && request.scope === scopeRef.current;
    const plan: FeedFirstPageLoadPlan = feedFirstPageLoadPlan({ fetchedAt: current.firstPageFetchedAt, hasLoadedMore: current.loadedPageCount > 1, hasInFlightRequest, now: Date.now() });
    if (plan === "join" && request) return request.promise;
    if (!force && plan === "reuse") return Promise.resolve();
    return fetchPage(kind, "");
  };
}

async function executeRequest(runtime: RequestRuntime): Promise<void> {
  try {
    const page: FeedPage = await getFeedPage(runtime.sourceAccountId, runtime.kind, runtime.cursor, runtime.controller.signal);
    if (!isCurrentRequest(runtime)) return;
    runtime.updatePage(runtime.kind, (current: FeedPageState): FeedPageState => applyPage(current, page, runtime.cursor === ""));
  } catch (error) {
    if (!isAbortError(error) && isCurrentRequest(runtime)) runtime.updatePage(runtime.kind, (current: FeedPageState): FeedPageState => applyError(current, error, runtime.cursor));
  } finally {
    if (isCurrentRequest(runtime)) runtime.requests.current[runtime.kind] = null;
  }
}

function loadNextPage(activeIdRef: MutableRefObject<string | null>, activeKindRef: MutableRefObject<FeedKind>, pagesRef: MutableRefObject<FeedPages>, requestsRef: MutableRefObject<Record<FeedKind, FeedRequest | null>>, fetchPage: (kind: FeedKind, cursor: string) => Promise<void>, loadFirst: (kind: FeedKind) => Promise<void>): Promise<void> {
  const kind: FeedKind = activeKindRef.current;
  const current: FeedPageState = pagesRef.current[kind];
  if (!activeIdRef.current) return Promise.resolve();
  if (current.firstPageFetchedAt === null) return loadFirst(kind);
  if (current.isLoading || !current.hasMore || requestsRef.current[kind]) return Promise.resolve();
  return fetchPage(kind, current.nextCursor);
}

function retryPage(activeKindRef: MutableRefObject<FeedKind>, pagesRef: MutableRefObject<FeedPages>, fetchPage: (kind: FeedKind, cursor: string) => Promise<void>, loadFirst: (kind: FeedKind, force?: boolean) => Promise<void>): Promise<void> {
  const kind: FeedKind = activeKindRef.current;
  const current: FeedPageState = pagesRef.current[kind];
  return current.errorCursor === "" ? loadFirst(kind, true) : fetchPage(kind, current.nextCursor);
}

function resetFeedScope(options: FeedEffectOptions): void {
  if (options.initializedScopeRef.current === options.scope) return;
  options.initializedScopeRef.current = options.scope;
  resetFeedPages(options);
}

function resetHiddenFeedCache(options: FeedEffectOptions): void {
  const shouldReset: boolean = shouldResetFeedCache(options.wasVisibleRef.current, options.isVisible);
  options.wasVisibleRef.current = options.isVisible;
  if (shouldReset) resetFeedPages(options);
}

function resetFeedPages(options: FeedEffectOptions): void {
  abortRequests(options.requestsRef);
  const pages: FeedPages = createInitialPages();
  options.pagesRef.current = pages;
  options.setPages(pages);
}

function schedulePrefetch(activeId: string | null, isVisible: boolean, loadFirst: (kind: FeedKind) => Promise<void>): (() => void) | undefined {
  if (!shouldPrefetchFeed(activeId, isVisible)) return undefined;
  const timer: ReturnType<typeof setTimeout> = setTimeout((): void => { void loadFirst("recommendations"); }, RECOMMENDATION_PREFETCH_DELAY_MS);
  return (): void => clearTimeout(timer);
}

function scheduleUnmountAbort(requestsRef: MutableRefObject<Record<FeedKind, FeedRequest | null>>, timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>): () => void {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = null;
  return (): void => { timerRef.current = setTimeout((): void => abortRequests(requestsRef), 0); };
}

function abortRequests(requestsRef: MutableRefObject<Record<FeedKind, FeedRequest | null>>): void {
  requestsRef.current.timeline?.controller.abort();
  requestsRef.current.recommendations?.controller.abort();
  requestsRef.current = { timeline: null, recommendations: null };
}

function applyPage(current: FeedPageState, page: FeedPage, isFirstPage: boolean): FeedPageState {
  const base: FeedPageState = isFirstPage ? INITIAL_PAGE : current;
  const posts: FeedPost[] = mergeFeedPagePosts(base.posts, page.posts);
  const loadedPageCount: number = isFirstPage ? 1 : current.loadedPageCount + 1;
  return { error: "", errorCursor: null, firstPageFetchedAt: isFirstPage ? Date.now() : current.firstPageFetchedAt, hasMore: page.hasMore, isLoading: false, loadedPageCount, nextCursor: page.nextCursor, posts };
}

function applyError(current: FeedPageState, error: unknown, cursor: string): FeedPageState {
  if (cursor === "" && current.firstPageFetchedAt !== null) return { ...current, isLoading: false };
  return { ...current, error: errorMessage(error), errorCursor: cursor, isLoading: false };
}

function isCurrentRequest(runtime: RequestRuntime): boolean {
  const request: FeedRequest | null = runtime.requests.current[runtime.kind];
  return request?.controller === runtime.controller && request.scope === runtime.scope && runtime.scopeRef.current === runtime.scope;
}

function createInitialPages(): FeedPages {
  return { timeline: INITIAL_PAGE, recommendations: INITIAL_PAGE };
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "피드를 불러오지 못했어요.";
}
