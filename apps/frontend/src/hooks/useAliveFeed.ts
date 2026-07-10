import { useState, type Dispatch, type SetStateAction } from "react";
import { mergeTimelinePosts, postTimeMs, postsFromFollowedCharacter, sanitizePosts, type FeedPost, type FollowedCharacter } from "@/domain/feed/feedUtils";

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

type FeedOptions = {
  following: FollowedCharacter[];
  personas: PersonaOption[];
};

type AliveFeedReturn = {
  auto: boolean;
  commentAs: string;
  commentOn: FeedPost["id"] | null;
  commentText: string;
  defaultCommentAs: () => string;
  deleteComment: (postId: FeedPost["id"], index: number) => void;
  deletePost: (postId: FeedPost["id"]) => void;
  editingComment: EditingComment | null;
  editingPost: FeedPost | null;
  fast: boolean;
  feedView: string;
  fixTarget: unknown;
  fixText: string;
  followedTimelinePosts: FeedPost[];
  loading: boolean;
  manualPost: (text: string) => void;
  moodOpen: boolean;
  myPosts: FeedPost[];
  nextIn: number;
  openCommentBox: (postId: FeedPost["id"]) => void;
  posts: FeedPost[];
  publicPostSnapshot: (sourcePosts?: FeedPost[]) => FeedPost[];
  saveCommentEdit: () => void;
  savePostEdit: () => void;
  setAuto: Dispatch<SetStateAction<boolean>>;
  setCommentAs: Dispatch<SetStateAction<string>>;
  setCommentOn: Dispatch<SetStateAction<FeedPost["id"] | null>>;
  setCommentText: Dispatch<SetStateAction<string>>;
  setEditingComment: Dispatch<SetStateAction<EditingComment | null>>;
  setEditingPost: Dispatch<SetStateAction<FeedPost | null>>;
  setFast: Dispatch<SetStateAction<boolean>>;
  setFeedView: Dispatch<SetStateAction<string>>;
  setFixTarget: Dispatch<SetStateAction<unknown>>;
  setFixText: Dispatch<SetStateAction<string>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setMoodOpen: Dispatch<SetStateAction<boolean>>;
  setNextIn: Dispatch<SetStateAction<number>>;
  setPosts: Dispatch<SetStateAction<FeedPost[]>>;
  setWriteOpen: Dispatch<SetStateAction<boolean>>;
  setWriteText: Dispatch<SetStateAction<string>>;
  sortedPosts: FeedPost[];
  timeAgo: (time: string | number | Date) => string;
  timelinePosts: FeedPost[];
  toggleLike: (id: FeedPost["id"]) => void;
  visiblePosts: FeedPost[];
  writeOpen: boolean;
  writeText: string;
};

export function useAliveFeed({ following, personas }: FeedOptions): AliveFeedReturn {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeText, setWriteText] = useState("");
  const [feedView, setFeedView] = useState("timeline");
  const [fixTarget, setFixTarget] = useState<unknown>(null);
  const [fixText, setFixText] = useState("");
  const [auto, setAuto] = useState(true);
  const [fast, setFast] = useState(false);
  const [nextIn, setNextIn] = useState(0);
  const [commentOn, setCommentOn] = useState<FeedPost["id"] | null>(null);
  const [commentAs, setCommentAs] = useState("char");
  const [commentText, setCommentText] = useState("");
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editingComment, setEditingComment] = useState<EditingComment | null>(null);
  const sortedPosts = sanitizePosts(posts).sort((a, b) => postTimeMs(b) - postTimeMs(a));
  const myPosts = sortedPosts.filter((post) => !post.author);
  const followedTimelinePosts = (following || []).flatMap((item) => postsFromFollowedCharacter(item));
  const timelinePosts = mergeTimelinePosts(sortedPosts, followedTimelinePosts);
  const visiblePosts = feedView === "mine" ? myPosts : timelinePosts;
  function defaultCommentAs(): string {
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
    setPosts((items) => items.map((item) => item.id === editingPost.id ? { ...item, text, edited: true } : item));
    setEditingPost(null);
  }
  function deletePost(postId: FeedPost["id"]): void {
    setPosts((items) => items.filter((item) => item.id !== postId));
    if (commentOn === postId) clearCommentDraft();
    if (editingPost?.id === postId) setEditingPost(null);
  }
  function saveCommentEdit(): void {
    const text = editingComment?.text?.trim();
    if (!editingComment || !text) return;
    setPosts((items) => items.map((item) => updateEditedComment(item, editingComment, text)));
    setEditingComment(null);
  }
  function deleteComment(postId: FeedPost["id"], index: number): void {
    setPosts((items) => items.map((item) => item.id === postId ? { ...item, comments: (item.comments || []).filter((_, itemIndex) => itemIndex !== index) } : item));
    if (editingComment?.postId === postId && editingComment.index === index) setEditingComment(null);
  }
  function manualPost(text: string): void {
    if (!text.trim()) return;
    setPosts((items) => [{ id: Date.now(), text: text.trim(), mood: "내가 작성", time: new Date(), likes: Math.floor(Math.random() * 20) + 1, liked: false, byUser: true }, ...items]);
  }
  function toggleLike(id: FeedPost["id"]): void {
    setPosts((items) => items.map((item) => item.id === id ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) } : item));
  }
  function timeAgo(time: string | number | Date): string {
    const ms = time instanceof Date ? time.getTime() : (typeof time === "number" ? time : Date.parse(time));
    if (!Number.isFinite(ms)) return "방금";
    const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (seconds < 60) return "방금";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
    return `${Math.floor(seconds / 3600)}시간`;
  }
  function publicPostSnapshot(sourcePosts: FeedPost[] = posts): FeedPost[] {
    return sanitizePosts(sourcePosts).filter((post) => !post.author && post.text).sort((a, b) => postTimeMs(b) - postTimeMs(a)).slice(0, 30).map(publicPostFromPost);
  }
  function clearCommentDraft(): void {
    setCommentOn(null);
    setCommentText("");
  }
  return { auto, commentAs, commentOn, commentText, defaultCommentAs, deleteComment, deletePost, editingComment, editingPost, fast, feedView, fixTarget, fixText, followedTimelinePosts, loading, manualPost, moodOpen, myPosts, nextIn, openCommentBox, posts, publicPostSnapshot, saveCommentEdit, savePostEdit, setAuto, setCommentAs, setCommentOn, setCommentText, setEditingComment, setEditingPost, setFast, setFeedView, setFixTarget, setFixText, setLoading, setMoodOpen, setNextIn, setPosts, setWriteOpen, setWriteText, sortedPosts, timeAgo, timelinePosts, toggleLike, visiblePosts, writeOpen, writeText };
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

function publicPostFromPost(post: FeedPost): FeedPost {
  return { id: post.id, text: post.text, mood: post.mood || "게시글", time: post.time || new Date().toISOString(), likes: post.likes || 0, img: post.img || null, photoDesc: post.photoDesc || null, moodDesc: post.moodDesc || null, comments: Array.isArray(post.comments) ? post.comments.slice(0, 20) : [] };
}
