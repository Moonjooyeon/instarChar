import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  CharacterPostsApiError,
  createCharacterPostComment,
  generateCharacterPost,
  getCharacterPosts,
  saveCharacterPosts,
  updateCharacterAutoPost,
  type CharacterPostsState,
} from "@/api/characterPosts";
import { createGenerateRequestKey } from "@/api/generate";
import { queryPostLikes, updatePostLike, type PostLikeItem, type PostLikeTarget } from "@/api/postLikes";
import { USER_PERSONA_FEATURE_ENABLED } from "@/domain/app/featureFlags";
import { applyFollowedLikeState, followedLikeKey, followedLikeState, followedPostTarget, followedPostTargets, formatPostTime, optimisticFollowedLike, postTimeMs, postsFromFollowedCharacter, postsFromRecommendedCharacter, recommendedCharacters, sanitizePosts, type FeedPost, type FollowedCharacter, type FollowedLikeState, type RecommendationProfile } from "@/domain/feed/feedUtils";

type PersonaOption = {
  id?: string | number;
};

type EditingComment = {
  index: number;
  postId: FeedPost["id"];
  text?: string;
};

type FeedComment = Record<string, unknown> & {
  edited?: boolean;
  text?: string;
};

type ExternalComment = {
  handle: string;
  name: string;
  replyTo: string;
  text: string;
};

type FeedOptions = {
  activeId: string | null;
  activeSharedId: string;
  following: FollowedCharacter[];
  personas: PersonaOption[];
  recommendationCandidates: FollowedCharacter[];
  recommendationProfile: RecommendationProfile;
  setSaveStatus: Dispatch<SetStateAction<string>>;
  step: string;
};

type PostMutation = (posts: FeedPost[]) => FeedPost[];

type AliveFeedReturn = {
  auto: boolean;
  commentAs: string;
  commentOn: FeedPost["id"] | null;
  commentText: string;
  canLikePost: (post: FeedPost) => boolean;
  defaultCommentAs: () => string;
  deleteComment: (postId: FeedPost["id"], index: number) => void;
  deletePost: (postId: FeedPost["id"]) => void;
  editingComment: EditingComment | null;
  editingPost: FeedPost | null;
  feedView: string;
  fixTarget: unknown;
  fixText: string;
  followedTimelinePosts: FeedPost[];
  loading: boolean;
  manualPost: (text: string) => void;
  mutatePosts: (mutation: PostMutation) => void;
  moodOpen: boolean;
  myPosts: FeedPost[];
  nextIn: number;
  openCommentBox: (postId: FeedPost["id"]) => void;
  posts: FeedPost[];
  recommendationPosts: FeedPost[];
  recommendationUsesInterests: boolean;
  publicPostSnapshot: (sourcePosts?: FeedPost[]) => FeedPost[];
  saveCommentEdit: () => void;
  savePostEdit: () => void;
  setAuto: (enabled: boolean) => void;
  setAutoInterval: (intervalSeconds: number) => void;
  setCommentAs: Dispatch<SetStateAction<string>>;
  setCommentOn: Dispatch<SetStateAction<FeedPost["id"] | null>>;
  setCommentText: Dispatch<SetStateAction<string>>;
  setEditingComment: Dispatch<SetStateAction<EditingComment | null>>;
  setEditingPost: Dispatch<SetStateAction<FeedPost | null>>;
  setFeedView: Dispatch<SetStateAction<string>>;
  setFixTarget: Dispatch<SetStateAction<unknown>>;
  setFixText: Dispatch<SetStateAction<string>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setMoodOpen: Dispatch<SetStateAction<boolean>>;
  setPosts: Dispatch<SetStateAction<FeedPost[]>>;
  setWriteOpen: Dispatch<SetStateAction<boolean>>;
  setWriteText: Dispatch<SetStateAction<string>>;
  sortedPosts: FeedPost[];
  submitExternalComment: (post: FeedPost, comment: ExternalComment) => Promise<void>;
  timeAgo: (time: string | number | Date) => string;
  timelinePosts: FeedPost[];
  toggleLike: (id: FeedPost["id"]) => void;
  isLikePending: (id: FeedPost["id"]) => boolean;
  autoIntervalSeconds: number;
  generateServerPost: (mood: string) => Promise<FeedPost | null>;
  visiblePosts: FeedPost[];
  writeOpen: boolean;
  writeText: string;
};

export function useAliveFeed({ activeId, activeSharedId, following, personas, recommendationCandidates, recommendationProfile, setSaveStatus, step }: FeedOptions): AliveFeedReturn {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeText, setWriteText] = useState("");
  const [feedView, setFeedView] = useState("mine");
  const [fixTarget, setFixTarget] = useState<unknown>(null);
  const [fixText, setFixText] = useState("");
  const [auto, setAutoState] = useState(false);
  const [autoIntervalSeconds, setAutoIntervalSeconds] = useState(3600);
  const [nextIn, setNextIn] = useState(0);
  const revisionRef = useRef(0);
  const postsRef = useRef<FeedPost[]>([]);
  const mutationQueueRef = useRef(Promise.resolve());
  const [commentOn, setCommentOn] = useState<FeedPost["id"] | null>(null);
  const [commentAs, setCommentAs] = useState("char");
  const [commentText, setCommentText] = useState("");
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editingComment, setEditingComment] = useState<EditingComment | null>(null);
  const [externalComments, setExternalComments] = useState<Record<string, unknown[]>>({});
  const sortedPosts = useMemo(() => sanitizePosts(posts).sort((a, b) => postTimeMs(b) - postTimeMs(a)), [posts]);
  const myPosts = useMemo(() => sortedPosts.filter((post) => !post.author), [sortedPosts]);
  const rawFollowedPosts = useMemo(() => (following || []).flatMap((item) => postsFromFollowedCharacter(item)), [following]);
  const followedLikes = useFollowedLikes({ activeId, posts: rawFollowedPosts, setSaveStatus, step });
  const followedTimelinePosts = useMemo(() => rawFollowedPosts.map((post) => applyExternalComments(applyFollowedLikeState(post, followedLikes.state), externalComments)), [externalComments, followedLikes.state, rawFollowedPosts]);
  const timelinePosts = useMemo(() => [...followedTimelinePosts].sort((a, b) => postTimeMs(b) - postTimeMs(a)), [followedTimelinePosts]);
  const rankedRecommendations = useMemo(() => recommendedCharacters(recommendationCandidates, following, recommendationProfile, activeId, activeSharedId), [activeId, activeSharedId, following, recommendationCandidates, recommendationProfile]);
  const recommendationPosts = useMemo(() => rankedRecommendations.flatMap(postsFromRecommendedCharacter).map((post) => applyExternalComments(post, externalComments)).sort((a, b) => postTimeMs(b) - postTimeMs(a)), [externalComments, rankedRecommendations]);
  const recommendationUsesInterests = useMemo(() => recommendationPosts.some((post) => post.recommendationReason === "interest"), [recommendationPosts]);
  const visiblePosts = feedView === "mine" ? myPosts : feedView === "recommendations" ? recommendationPosts : timelinePosts;
  useEffect(() => { postsRef.current = posts; }, [posts]);
  useEffect(() => { setExternalComments({}); }, [activeId]);
  const applyServerState = useCallback((state: CharacterPostsState): void => {
    const nextPosts = sanitizePosts(state.posts);
    revisionRef.current = state.revision;
    postsRef.current = nextPosts;
    setPosts(nextPosts);
    setAutoState(state.auto_post_enabled);
    setAutoIntervalSeconds(state.auto_post_interval_seconds);
    setNextIn(secondsUntil(state.next_auto_post_at));
  }, []);
  const refreshPosts = useCallback(async (): Promise<void> => {
    if (!activeId) return;
    try {
      applyServerState(await getCharacterPosts(activeId));
    } catch (error) {
      setSaveStatus(postsErrorMessage(error));
    }
  }, [activeId, applyServerState, setSaveStatus]);
  useFeedRefresh({ activeId, refreshPosts, step });
  useCountdown({ activeId, setNextIn, step });
  function mutatePosts(mutation: PostMutation): void {
    const next = mutationQueueRef.current.catch(() => undefined).then(() => persistMutation(mutation));
    mutationQueueRef.current = next.catch((error) => setSaveStatus(postsErrorMessage(error)));
  }
  async function persistMutation(mutation: PostMutation): Promise<void> {
    if (!activeId) return;
    const nextPosts = mutation(postsRef.current);
    applyLocalPosts(nextPosts);
    try {
      applyServerState(await saveCharacterPosts(activeId, nextPosts, revisionRef.current));
    } catch (error) {
      await retryMutation(error, mutation);
    }
  }
  async function retryMutation(error: unknown, mutation: PostMutation): Promise<void> {
    if (!activeId || !isRevisionConflict(error)) {
      setSaveStatus(postsErrorMessage(error));
      await refreshPosts();
      return;
    }
    const latest = await getCharacterPosts(activeId);
    applyServerState(await saveCharacterPosts(activeId, mutation(sanitizePosts(latest.posts)), latest.revision));
  }
  function applyLocalPosts(nextPosts: FeedPost[]): void {
    postsRef.current = nextPosts;
    setPosts(nextPosts);
  }
  function setAuto(enabled: boolean): void {
    if (!activeId) return;
    void updateCharacterAutoPost(activeId, enabled, autoIntervalSeconds).then(applyServerState).catch((error) => setSaveStatus(postsErrorMessage(error)));
  }
  function setAutoInterval(intervalSeconds: number): void {
    if (!activeId) return;
    void updateCharacterAutoPost(activeId, auto, intervalSeconds).then(applyServerState).catch((error) => setSaveStatus(postsErrorMessage(error)));
  }
  async function generateServerPost(mood: string): Promise<FeedPost | null> {
    if (!activeId) return null;
    const idempotencyKey = createGenerateRequestKey("feed-post");
    const result = await generateCharacterPost(activeId, mood, idempotencyKey);
    applyServerState(result.state);
    return result.post as FeedPost;
  }
  function defaultCommentAs(): string {
    if (!USER_PERSONA_FEATURE_ENABLED) return "char";
    return personas[0] ? `p:${personas[0].id}` : "char";
  }
  function openCommentBox(postId: FeedPost["id"]): void {
    setCommentOn(postId);
    setCommentText("");
    setCommentAs(defaultCommentAs());
  }
  function savePostEdit(): void {
    const text = editingPost?.text?.trim();
    if (!editingPost || !text) return;
    mutatePosts((items) => items.map((item) => item.id === editingPost.id ? { ...item, text, edited: true } : item));
    setEditingPost(null);
  }
  function deletePost(postId: FeedPost["id"]): void {
    mutatePosts((items) => items.filter((item) => item.id !== postId));
    if (commentOn === postId) clearCommentDraft();
    if (editingPost?.id === postId) setEditingPost(null);
  }
  function saveCommentEdit(): void {
    const text = editingComment?.text?.trim();
    if (!editingComment || !text) return;
    mutatePosts((items) => items.map((item) => updateEditedComment(item, editingComment, text)));
    setEditingComment(null);
  }
  function deleteComment(postId: FeedPost["id"], index: number): void {
    mutatePosts((items) => items.map((item) => item.id === postId ? { ...item, comments: (item.comments || []).filter((_, itemIndex) => itemIndex !== index) } : item));
    if (editingComment?.postId === postId && editingComment.index === index) setEditingComment(null);
  }
  function manualPost(text: string): void {
    if (!text.trim()) return;
    mutatePosts((items) => [{ id: Date.now(), text: text.trim(), mood: "내가 작성", time: new Date(), likes: 0, liked: false, byUser: true }, ...items]);
  }
  function toggleLike(id: FeedPost["id"]): void {
    const followedPost = followedTimelinePosts.find((post) => post.id === id);
    if (followedPost) {
      followedLikes.toggle(followedPost);
      return;
    }
    if (recommendationPosts.some((post) => post.id === id)) return;
    mutatePosts((items) => items.map((item) => item.id === id ? { ...item, liked: !item.liked, likes: Number(item.likes || 0) + (item.liked ? -1 : 1) } : item));
  }
  function isLikePending(id: FeedPost["id"]): boolean {
    const post = followedTimelinePosts.find((item) => item.id === id);
    return post ? followedLikes.isPending(post) : false;
  }
  function canLikePost(post: FeedPost): boolean {
    if (!post.importedFromRecommendation) return true;
    return followedTimelinePosts.some((item) => item.authorSharedId === post.authorSharedId);
  }
  async function submitExternalComment(post: FeedPost, comment: ExternalComment): Promise<void> {
    const target = followedPostTarget(post);
    if (!activeId || !target) throw new Error("댓글을 저장할 게시글을 찾지 못했습니다.");
    const comments = await createCharacterPostComment(target.target_character_id, target.post_id, activeId, comment);
    setExternalComments((current) => ({ ...current, [followedLikeKey(target)]: comments }));
  }
  function publicPostSnapshot(sourcePosts: FeedPost[] = posts): FeedPost[] {
    return sanitizePosts(sourcePosts).filter((post) => !post.author && post.text).sort((a, b) => postTimeMs(b) - postTimeMs(a)).slice(0, 30).map(publicPostFromPost);
  }
  function clearCommentDraft(): void {
    setCommentOn(null);
    setCommentText("");
  }
  return { auto, autoIntervalSeconds, canLikePost, commentAs, commentOn, commentText, defaultCommentAs, deleteComment, deletePost, editingComment, editingPost, feedView, fixTarget, fixText, followedTimelinePosts, generateServerPost, isLikePending, loading, manualPost, moodOpen, mutatePosts, myPosts, nextIn, openCommentBox, posts, publicPostSnapshot, recommendationPosts, recommendationUsesInterests, saveCommentEdit, savePostEdit, setAuto, setAutoInterval, setCommentAs, setCommentOn, setCommentText, setEditingComment, setEditingPost, setFeedView, setFixTarget, setFixText, setLoading, setMoodOpen, setPosts, setWriteOpen, setWriteText, sortedPosts, submitExternalComment, timeAgo: formatPostTime, timelinePosts, toggleLike, visiblePosts, writeOpen, writeText };
}

type FollowedLikesOptions = {
  activeId: string | null;
  posts: FeedPost[];
  setSaveStatus: Dispatch<SetStateAction<string>>;
  step: string;
};

type FollowedLikesReturn = {
  state: FollowedLikeState;
  isPending: (post: FeedPost) => boolean;
  toggle: (post: FeedPost) => void;
};

function useFollowedLikes({ activeId, posts, setSaveStatus, step }: FollowedLikesOptions): FollowedLikesReturn {
  const [state, setState] = useState<FollowedLikeState>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const pendingRef = useRef(new Set<string>());
  const activeRef = useRef(activeId);
  const targets = followedPostTargets(posts);
  const signature = JSON.stringify(targets);
  useEffect(() => { activeRef.current = activeId; pendingRef.current.clear(); setPending({}); }, [activeId]);
  useFollowedLikeRefresh({ activeId, pendingRef, setSaveStatus, setState, signature, step, targets });
  const isPending = (post: FeedPost): boolean => followedLikePending(post, pending);
  const toggle = (post: FeedPost): void => toggleFollowedLike({ activeId, activeRef, pendingRef, setPending, setSaveStatus, setState, state }, post);
  return { state, isPending, toggle };
}

type FollowedLikeActionOptions = Pick<FollowedLikesOptions, "activeId" | "setSaveStatus"> & {
  activeRef: MutableRefObject<string | null>;
  pendingRef: MutableRefObject<Set<string>>;
  setPending: Dispatch<SetStateAction<Record<string, boolean>>>;
  setState: Dispatch<SetStateAction<FollowedLikeState>>;
  state: FollowedLikeState;
};

function toggleFollowedLike(options: FollowedLikeActionOptions, post: FeedPost): void {
  const { activeId, activeRef, pendingRef, setPending, setSaveStatus, setState, state } = options;
  const target = followedPostTarget(post);
  const next = optimisticFollowedLike(post);
  if (!activeId || !target || !next) return;
  const key = followedLikeKey(target);
  if (pendingRef.current.has(key)) return;
  const previous = state[key];
  markLikePending(key, true, pendingRef, setPending);
  setState((current) => ({ ...current, [key]: next }));
  void persistFollowedLike({ activeId, activeRef, key, next, previous, setSaveStatus, setState, target }).finally(() => {
    if (activeRef.current === activeId) markLikePending(key, false, pendingRef, setPending);
  });
}

function followedLikePending(post: FeedPost, pending: Record<string, boolean>): boolean {
  const target = followedPostTarget(post);
  return target ? Boolean(pending[followedLikeKey(target)]) : false;
}

type FollowedLikeRefreshOptions = Omit<FollowedLikesOptions, "posts"> & {
  pendingRef: MutableRefObject<Set<string>>;
  setState: Dispatch<SetStateAction<FollowedLikeState>>;
  signature: string;
  targets: PostLikeTarget[];
};

function useFollowedLikeRefresh(options: FollowedLikeRefreshOptions): void {
  const { activeId, pendingRef, setSaveStatus, setState, signature, step, targets } = options;
  useEffect(() => {
    let cancelled = false;
    if (!activeId || step !== "feed") return setState({});
    void queryPostLikes(activeId, targets).then((items) => {
      if (!cancelled) setState((current) => mergedRefreshedLikes(current, items, pendingRef.current));
    }).catch((error) => { if (!cancelled) setSaveStatus(postsErrorMessage(error)); });
    return () => { cancelled = true; };
  }, [activeId, setSaveStatus, setState, signature, step]);
}

type PersistLikeOptions = {
  activeId: string;
  activeRef: MutableRefObject<string | null>;
  key: string;
  next: PostLikeItem;
  previous?: PostLikeItem;
  setSaveStatus: Dispatch<SetStateAction<string>>;
  setState: Dispatch<SetStateAction<FollowedLikeState>>;
  target: PostLikeTarget;
};

async function persistFollowedLike(options: PersistLikeOptions): Promise<void> {
  const { activeId, activeRef, key, next, previous, setSaveStatus, setState, target } = options;
  try {
    const item = await updatePostLike(activeId, target, next.liked);
    if (activeRef.current === activeId) setState((current) => ({ ...current, [key]: item }));
  } catch (error) {
    if (activeRef.current !== activeId) return;
    setState((current) => restoredLikeState(current, key, previous));
    setSaveStatus(postsErrorMessage(error));
  }
}

function restoredLikeState(state: FollowedLikeState, key: string, previous?: PostLikeItem): FollowedLikeState {
  if (previous) return { ...state, [key]: previous };
  const next = { ...state };
  delete next[key];
  return next;
}

function mergedRefreshedLikes(current: FollowedLikeState, items: PostLikeItem[], pending: Set<string>): FollowedLikeState {
  const next = followedLikeState(items);
  pending.forEach((key) => {
    if (current[key]) next[key] = current[key];
  });
  return next;
}

function markLikePending(key: string, value: boolean, ref: MutableRefObject<Set<string>>, setPending: Dispatch<SetStateAction<Record<string, boolean>>>): void {
  if (value) ref.current.add(key);
  else ref.current.delete(key);
  setPending((current) => ({ ...current, [key]: value }));
}

function useFeedRefresh({ activeId, refreshPosts, step }: { activeId: string | null; refreshPosts: () => Promise<void>; step: string }): void {
  useEffect(() => {
    if (!activeId || step !== "feed") return;
    void refreshPosts();
    const timer = window.setInterval(() => void refreshPosts(), 30000);
    const foreground = (): void => { if (document.visibilityState === "visible") void refreshPosts(); };
    document.addEventListener("visibilitychange", foreground);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", foreground); };
  }, [activeId, refreshPosts, step]);
}

function useCountdown({ activeId, setNextIn, step }: { activeId: string | null; setNextIn: Dispatch<SetStateAction<number>>; step: string }): void {
  useEffect(() => {
    if (!activeId || step !== "feed") return;
    const timer = window.setInterval(() => setNextIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [activeId, setNextIn, step]);
}

function secondsUntil(value: string | null): number {
  if (!value) return 0;
  return Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 1000));
}

function isRevisionConflict(error: unknown): boolean {
  return error instanceof CharacterPostsApiError && error.status === 409;
}

function postsErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "게시글 동기화 실패";
}

function updateEditedComment(post: FeedPost, editingComment: EditingComment, text: string): FeedPost {
  if (post.id !== editingComment.postId) return post;
  const comments = [...(post.comments || [])];
  if (!comments[editingComment.index]) return post;
  comments[editingComment.index] = { ...asFeedComment(comments[editingComment.index]), text, edited: true };
  return { ...post, comments };
}

function asFeedComment(value: unknown): FeedComment {
  return value && typeof value === "object" ? value as FeedComment : {};
}

function applyExternalComments(post: FeedPost, state: Record<string, unknown[]>): FeedPost {
  const target = followedPostTarget(post);
  if (!target) return post;
  const comments = state[followedLikeKey(target)];
  return comments ? { ...post, comments } : post;
}

function publicPostFromPost(post: FeedPost): FeedPost {
  return { id: post.id, text: post.text, mood: post.mood || "게시글", time: post.time || new Date().toISOString(), likes: post.likes || 0, img: post.img || null, photoDesc: post.photoDesc || null, moodDesc: post.moodDesc || null, comments: Array.isArray(post.comments) ? post.comments.slice(0, 20) : [] };
}
