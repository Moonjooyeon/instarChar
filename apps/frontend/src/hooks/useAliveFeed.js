import { useState } from "react";
import { mergeTimelinePosts, postTimeMs, postsFromFollowedCharacter, sanitizePosts } from "@/domain/feed/feedUtils";

export function useAliveFeed({ following, personas }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeText, setWriteText] = useState("");
  const [feedView, setFeedView] = useState("timeline");
  const [fixTarget, setFixTarget] = useState(null);
  const [fixText, setFixText] = useState("");
  const [auto, setAuto] = useState(true);
  const [fast, setFast] = useState(false);
  const [nextIn, setNextIn] = useState(0);
  const [commentOn, setCommentOn] = useState(null);
  const [commentAs, setCommentAs] = useState("char");
  const [commentText, setCommentText] = useState("");
  const [editingPost, setEditingPost] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const sortedPosts = sanitizePosts(posts).sort((a, b) => postTimeMs(b) - postTimeMs(a));
  const myPosts = sortedPosts.filter((post) => !post.author);
  const followedTimelinePosts = (following || []).flatMap((item) => postsFromFollowedCharacter(item));
  const timelinePosts = mergeTimelinePosts(sortedPosts, followedTimelinePosts);
  const visiblePosts = feedView === "mine" ? myPosts : timelinePosts;
  function defaultCommentAs() {
    return personas[0] ? `p:${personas[0].id}` : "char";
  }
  function openCommentBox(postId) {
    setCommentOn(postId);
    setCommentText("");
    setCommentAs(defaultCommentAs());
  }
  function savePostEdit() {
    const text = editingPost?.text?.trim();
    if (!editingPost || !text) return;
    setPosts((items) => items.map((item) => item.id === editingPost.id ? { ...item, text, edited: true } : item));
    setEditingPost(null);
  }
  function deletePost(postId) {
    setPosts((items) => items.filter((item) => item.id !== postId));
    if (commentOn === postId) clearCommentDraft();
    if (editingPost?.id === postId) setEditingPost(null);
  }
  function saveCommentEdit() {
    const text = editingComment?.text?.trim();
    if (!editingComment || !text) return;
    setPosts((items) => items.map((item) => updateEditedComment(item, editingComment, text)));
    setEditingComment(null);
  }
  function deleteComment(postId, index) {
    setPosts((items) => items.map((item) => item.id === postId ? { ...item, comments: (item.comments || []).filter((_, itemIndex) => itemIndex !== index) } : item));
    if (editingComment?.postId === postId && editingComment.index === index) setEditingComment(null);
  }
  function manualPost(text) {
    if (!text.trim()) return;
    setPosts((items) => [{ id: Date.now(), text: text.trim(), mood: "내가 작성", time: new Date(), likes: Math.floor(Math.random() * 20) + 1, liked: false, byUser: true }, ...items]);
  }
  function toggleLike(id) {
    setPosts((items) => items.map((item) => item.id === id ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) } : item));
  }
  function timeAgo(time) {
    const ms = time instanceof Date ? time.getTime() : (typeof time === "number" ? time : Date.parse(time));
    if (!Number.isFinite(ms)) return "방금";
    const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (seconds < 60) return "방금";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
    return `${Math.floor(seconds / 3600)}시간`;
  }
  function publicPostSnapshot(sourcePosts = posts) {
    return sanitizePosts(sourcePosts).filter((post) => !post.author && post.text).sort((a, b) => postTimeMs(b) - postTimeMs(a)).slice(0, 30).map(publicPostFromPost);
  }
  function clearCommentDraft() {
    setCommentOn(null);
    setCommentText("");
  }
  return { auto, commentAs, commentOn, commentText, defaultCommentAs, deleteComment, deletePost, editingComment, editingPost, fast, feedView, fixTarget, fixText, followedTimelinePosts, loading, manualPost, moodOpen, myPosts, nextIn, openCommentBox, posts, publicPostSnapshot, saveCommentEdit, savePostEdit, setAuto, setCommentAs, setCommentOn, setCommentText, setEditingComment, setEditingPost, setFast, setFeedView, setFixTarget, setFixText, setLoading, setMoodOpen, setNextIn, setPosts, setWriteOpen, setWriteText, sortedPosts, timeAgo, timelinePosts, toggleLike, visiblePosts, writeOpen, writeText };
}

function updateEditedComment(post, editingComment, text) {
  if (post.id !== editingComment.postId) return post;
  const comments = [...(post.comments || [])];
  if (!comments[editingComment.index]) return post;
  comments[editingComment.index] = { ...comments[editingComment.index], text, edited: true };
  return { ...post, comments };
}

function publicPostFromPost(post) {
  return { id: post.id, text: post.text, mood: post.mood || "게시글", time: post.time || new Date().toISOString(), likes: post.likes || 0, img: post.img || null, photoDesc: post.photoDesc || null, moodDesc: post.moodDesc || null, comments: Array.isArray(post.comments) ? post.comments.slice(0, 20) : [] };
}
