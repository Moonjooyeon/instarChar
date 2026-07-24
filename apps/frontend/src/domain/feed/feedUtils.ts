export type FeedPost = {
  id?: string | number;
  originalPostId?: string | number;
  text?: string;
  time?: string | number | Date;
  createdAt?: string | number | Date;
  created_at?: string | number | Date;
  likes?: number;
  liked?: boolean;
  comments?: unknown[];
  importedFromFollow?: boolean;
  author?: string;
  authorHandle?: string;
  authorAvatarImg?: string;
  authorSharedId?: string;
  mood?: string;
  [key: string]: unknown;
};

export type FollowedCharacter = {
  id?: string;
  sharedId?: string;
  name?: string;
  handle?: string;
  avatarImg?: string;
  posts?: FeedPost[];
};

export type FollowedPostLike = {
  target_shared_character_id: string;
  post_id: string;
  available: boolean;
  liked: boolean;
  likes: number;
};

export type FollowedLikeState = Record<string, FollowedPostLike>;

export function isFailedGeneratedPost(post: FeedPost | null | undefined): boolean {
  const text = String(post?.text || "").trim();
  if (!text) return false;
  const normalized = text.replace(/[\s()[\]{}"'`.,!?!]/g, "");
  return (
    (normalized.includes("\uC5F0\uACB0\uC774\uB04A\uACBC") && normalized.includes("\uC7A0\uC2DC\uD6C4\uB2E4\uC2DC")) ||
    normalized.includes("Gemini/API\uC751\uB2F5\uC774\uB04A\uACBC") ||
    normalized.includes("AI\uC751\uB2F5\uC774\uC7A0\uAE50\uBE44\uC5C8") ||
    normalized.includes("\uAC8C\uC2DC\uAE00\uC0DD\uC131\uC2E4\uD328")
  );
}

export function sanitizePosts(items: unknown): FeedPost[] {
  return Array.isArray(items) ? items.filter((post) => !isFailedGeneratedPost(post)) : [];
}

export function canManagePost(post: FeedPost): boolean {
  return !post.author && !post.importedFromFollow;
}

export function followedPostTarget(post: FeedPost): { target_shared_character_id: string; post_id: string } | null {
  const sharedId = String(post.authorSharedId || "");
  const postId = String(post.originalPostId ?? "");
  if (!sharedId || !postId) return null;
  return { target_shared_character_id: sharedId, post_id: postId };
}

export function followedLikeKey(target: { target_shared_character_id: string; post_id: string }): string {
  return `${target.target_shared_character_id}:${target.post_id}`;
}

export function followedLikeState(items: FollowedPostLike[]): FollowedLikeState {
  return Object.fromEntries(items.filter((item) => item.available).map((item) => [followedLikeKey(item), item]));
}

export function followedPostTargets(posts: FeedPost[]): { target_shared_character_id: string; post_id: string }[] {
  const targets = posts.map(followedPostTarget).filter((item) => item !== null);
  return [...new Map(targets.map((item) => [followedLikeKey(item), item])).values()];
}

export function applyFollowedLikeState(post: FeedPost, state: FollowedLikeState): FeedPost {
  const target = followedPostTarget(post);
  const item = target ? state[followedLikeKey(target)] : undefined;
  return item ? { ...post, liked: item.liked, likes: item.likes } : post;
}

export function optimisticFollowedLike(post: FeedPost): FollowedPostLike | null {
  const target = followedPostTarget(post);
  if (!target) return null;
  const liked = !post.liked;
  const likes = Math.max(0, Number(post.likes || 0) + (liked ? 1 : -1));
  return { ...target, available: true, liked, likes };
}

export function postTimeMs(post: FeedPost): number {
  const raw = post?.time || post?.createdAt || post?.created_at || post?.id;
  const ms = raw instanceof Date ? raw.getTime() : (typeof raw === "number" ? raw : Date.parse(raw));
  return Number.isFinite(ms) ? ms : 0;
}

export function formatPostTime(time: string | number | Date, now = Date.now()): string {
  const ms = time instanceof Date ? time.getTime() : (typeof time === "number" ? time : Date.parse(time));
  if (!Number.isFinite(ms) || ms > now) return "방금";
  const seconds = Math.floor((now - ms) / 1000);
  if (seconds < 60) return "방금";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}일`;
  return dottedDate(new Date(ms));
}

function dottedDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function followedPostId(sourceId: string | undefined, postId: string | number | undefined, index: number): string {
  return `followed:${sourceId || "local"}:${postId || index}`;
}

export function postsFromFollowedCharacter(poolChar: FollowedCharacter): FeedPost[] {
  const sourceId = poolChar.sharedId || poolChar.id || poolChar.name;
  return sanitizePosts(poolChar.posts)
    .filter((post) => post?.text)
    .map((post, index) => ({
      ...post,
      id: followedPostId(sourceId, post.id, index),
      originalPostId: post.id,
      importedFromFollow: true,
      author: poolChar.name,
      authorHandle: poolChar.handle || poolChar.name,
      authorAvatarImg: poolChar.avatarImg || "",
      authorSharedId: poolChar.sharedId || "",
      mood: post.mood || "팔로잉",
      time: post.time || new Date().toISOString(),
      likes: typeof post.likes === "number" && Number.isFinite(post.likes) ? post.likes : 0,
      liked: false,
      comments: Array.isArray(post.comments) ? post.comments : [],
    }));
}

export function mergeTimelinePosts(current: FeedPost[], incoming: FeedPost[]): FeedPost[] {
  const incomingById = new Map(incoming.map((post) => [String(post.id), post]));
  const refreshedCurrent = current.map((post) => {
    const fresh = incomingById.get(String(post.id));
    return fresh
      ? { ...post, authorAvatarImg: fresh.authorAvatarImg || "", authorHandle: fresh.authorHandle || post.authorHandle, author: fresh.author || post.author }
      : post;
  });
  const seen = new Set(refreshedCurrent.map((post) => String(post.id)));
  return [...refreshedCurrent, ...incoming.filter((post) => {
    const id = String(post.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  })].sort((a, b) => postTimeMs(b) - postTimeMs(a));
}
