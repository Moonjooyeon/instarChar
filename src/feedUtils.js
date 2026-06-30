export function isFailedGeneratedPost(post) {
  const text = String(post?.text || "").trim();
  if (!text) return false;
  const normalized = text.replace(/[()\[\]{}竊덌펹"'`.,!??╉?s]/g, "");
  return (
    (normalized.includes("\uC5F0\uACB0\uC774\uB04A\uACBC") && normalized.includes("\uC7A0\uC2DC\uD6C4\uB2E4\uC2DC")) ||
    normalized.includes("Gemini/API\uC751\uB2F5\uC774\uB04A\uACBC") ||
    normalized.includes("AI\uC751\uB2F5\uC774\uC7A0\uAE50\uBE44\uC5C8") ||
    normalized.includes("\uAC8C\uC2DC\uAE00\uC0DD\uC131\uC2E4\uD328")
  );
}

export function sanitizePosts(items) {
  return Array.isArray(items) ? items.filter((post) => !isFailedGeneratedPost(post)) : [];
}

export function postTimeMs(post) {
  const raw = post?.time || post?.createdAt || post?.created_at || post?.id;
  const ms = raw instanceof Date ? raw.getTime() : (typeof raw === "number" ? raw : Date.parse(raw));
  return Number.isFinite(ms) ? ms : 0;
}

export function followedPostId(sourceId, postId, index) {
  return `followed:${sourceId || "local"}:${postId || index}`;
}

export function postsFromFollowedCharacter(poolChar) {
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
      likes: post.likes || Math.floor(Math.random() * 20) + 1,
      liked: false,
      comments: Array.isArray(post.comments) ? post.comments : [],
    }));
}

export function mergeTimelinePosts(current, incoming) {
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
