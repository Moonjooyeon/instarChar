import React from "react";
import { USER_PERSONA_FEATURE_ENABLED } from "@/domain/app/featureFlags";
import { canManagePost } from "@/domain/feed/feedUtils";

export function FeedTimeline({ ctx }) {
  const {
    activeId,
    char,
    commentAs,
    commentOn,
    commentText,
    deleteComment,
    deletePost,
    editingComment,
    editingPost,
    feedTopRef,
    feedView,
    isLikePending,
    loading,
    myPosts,
    openCommentBox,
    personas,
    saveCommentEdit,
    savePostEdit,
    setCommentAs,
    setCommentOn,
    setCommentText,
    setEditingComment,
    setEditingPost,
    setFeedView,
    setFixTarget,
    setFixText,
    setPersonaDraft,
    setReportTarget,
    submitUserComment,
    timeAgo,
    timelinePosts,
    toggleLike,
    visiblePosts,
  } = ctx;
  return (
    <>
      <div className="al-feed-tabs">
        <button className={feedView === "mine" ? "on" : ""} onClick={() => setFeedView("mine")}>
          내 글 <b>{myPosts.length}</b>
        </button>
        <button className={feedView === "timeline" ? "on" : ""} onClick={() => setFeedView("timeline")}>
          타임라인 <b>{timelinePosts.length}</b>
        </button>
      </div>
      <div className="al-feed" ref={feedTopRef}>
        {visiblePosts.length === 0 && !loading && (
          <div className="al-empty">
            <span>{feedView === "mine" ? `${char.name}의 글이 아직 없어.` : "타임라인에 아직 글이 없어."}</span>
            <p>{feedView === "mine" ? "위에서 직접 시키거나 내가 쓰기로 첫 글을 올려봐." : "내 글과 팔로우한 캐릭터의 글이 여기에 같이 올라와."}</p>
          </div>
        )}
        {visiblePosts.map((post) => (
          <React.Fragment key={post.id}>
            <FeedPostCard post={post} ctx={{ activeId, char, commentAs, commentOn, commentText, deleteComment, deletePost, editingComment, editingPost, isLikePending, openCommentBox, personas, saveCommentEdit, savePostEdit, setCommentAs, setCommentOn, setCommentText, setEditingComment, setEditingPost, setFixTarget, setFixText, setPersonaDraft, setReportTarget, submitUserComment, timeAgo, toggleLike }} />
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

function FeedPostCard({ post, ctx }) {
  const {
    activeId,
    char,
    commentAs,
    commentOn,
    commentText,
    deleteComment,
    deletePost,
    editingComment,
    editingPost,
    isLikePending,
    openCommentBox,
    personas,
    saveCommentEdit,
    savePostEdit,
    setCommentAs,
    setCommentOn,
    setCommentText,
    setEditingComment,
    setEditingPost,
    setFixTarget,
    setFixText,
    setPersonaDraft,
    setReportTarget,
    submitUserComment,
    timeAgo,
    toggleLike,
  } = ctx;
  const isExt = Boolean(post.author);
  const pName = isExt ? displayName(post.author) : displayName(char.name);
  const pHandle = isExt ? displayName(post.authorHandle || post.author) : (char.handle || pName.replace(/\s/g, "").toLowerCase());
  const pInitial = initialForName(pName);
  const pAvatar = isExt ? post.authorAvatarImg : char.avatarImg;
  const canManage = canManagePost(post);
  return (
    <div className="al-post">
      <div className={`al-post-av ${isExt ? "ext" : ""}`}>{pAvatar ? <img src={pAvatar} alt="" /> : pInitial}</div>
      <div className="al-post-body">
        <div className="al-post-head">
          <span className="al-post-name">{pName}</span>
          <span className="al-post-handle">@{pHandle}</span>
          {isExt && <span className="al-post-extbadge">팔로잉</span>}
          <span className="al-post-time">· {timeAgo(post.time)}</span>
        </div>
        {editingPost?.id === post.id ? (
          <div className="al-editbox">
            <textarea value={editingPost.text} autoFocus onChange={(event) => setEditingPost((value) => ({ ...value, text: event.target.value }))} />
            <div className="al-edit-actions">
              <button onClick={() => setEditingPost(null)}>취소</button>
              <button className="primary" disabled={!editingPost.text.trim()} onClick={savePostEdit}>저장</button>
            </div>
          </div>
        ) : (
          <p className="al-post-text">{post.text}{post.edited && <i className="al-edited">수정됨</i>}</p>
        )}
        <FeedPostMedia post={post} />
        <div className="al-post-actions">
          <button className={`al-like ${post.liked ? "on" : ""}`} disabled={isLikePending(post.id)} onClick={() => toggleLike(post.id)}>{post.liked ? "♥" : "♡"} {post.likes}</button>
          {canManage && !post.byUser && <button className="al-fixbtn" onClick={() => { setFixTarget({ type: "post", id: post.id, text: post.text }); setFixText(""); }}>⚠ 캐해 아님</button>}
          {canManage && <button className="al-mini-action" onClick={() => setEditingPost({ id: post.id, text: post.text })}>수정</button>}
          {canManage && <button className="al-mini-action danger" onClick={() => deletePost(post.id)}>삭제</button>}
          {!post.byUser && <button className="al-mini-action safety" onClick={() => setReportTarget(postReportTarget(post, activeId))}>신고</button>}
        </div>
        <FeedComments post={post} ctx={{ char, commentAs, commentOn, commentText, deleteComment, editingComment, personas, saveCommentEdit, setCommentAs, setCommentOn, setCommentText, setEditingComment, setPersonaDraft, setReportTarget, submitUserComment, isExt }} />
        {commentOn !== post.id && <button className="al-cmt-open" onClick={() => openCommentBox(post.id)}>💬 댓글 달기</button>}
      </div>
    </div>
  );
}

function FeedPostMedia({ post }) {
  const quoted = recordValue(post.quoted);
  return (
    <>
      {quoted && (
        <div className="al-quoted">
          <div className="al-quoted-head">
            <span className="al-quoted-av">{initialForName(quoted.name)}</span>
            <span className="al-quoted-name">{displayName(quoted.name)}</span>
            <span className="al-quoted-handle">@{displayName(quoted.handle, "")}</span>
          </div>
          <p className="al-quoted-text">{displayName(quoted.text, "")}</p>
        </div>
      )}
      {post.img && <div className="al-post-img"><img src={post.img} alt="" /></div>}
      {post.photoDesc && !post.img && <div className="al-post-photo"><span className="al-photo-frame">◹</span><span className="al-photo-desc">{post.photoDesc}</span></div>}
      {post.moodDesc && <div className="al-post-moodcard">♫ {post.moodDesc}</div>}
    </>
  );
}

function FeedComments({ post, ctx }) {
  const { char, commentAs, commentOn, commentText, deleteComment, editingComment, personas, saveCommentEdit, setCommentAs, setCommentOn, setCommentText, setEditingComment, setPersonaDraft, setReportTarget, submitUserComment, isExt } = ctx;
  const comments = Array.isArray(post.comments) ? post.comments : [];
  return (
    <>
      {comments.length > 0 && (
        <div className="al-comments">
          {comments.map((comment, index) => {
            const commentRecord = recordValue(comment) || {};
            const commentName = displayName(commentRecord.name);
            const replyToName = displayName(commentRecord.replyTo, "");
            return (
              <div className="al-comment" key={index}>
                <div className={`al-comment-av ${commentRecord.byUser ? "mine" : ""}`}>{initialForName(commentName)}</div>
                <div className="al-comment-body">
                  <span className="al-comment-name">{commentName}{commentRecord.byUser && <i className="al-cmt-mine">나</i>}</span>
                  {replyToName && replyToName !== commentName && <span className="al-replyto"> @{replyToName}에게 답글</span>}
                  {editingComment?.postId === post.id && editingComment.index === index ? (
                    <div className="al-comment-editbox">
                      <input value={editingComment.text} autoFocus onChange={(event) => setEditingComment((value) => ({ ...value, text: event.target.value }))} />
                      <button onClick={() => setEditingComment(null)}>취소</button>
                      <button disabled={!editingComment.text.trim()} onClick={saveCommentEdit}>저장</button>
                    </div>
                  ) : (
                    <>
                      <span className="al-comment-text">{displayName(commentRecord.text, "")}{commentRecord.edited && <i className="al-edited">수정됨</i>}</span>
                      <span className="al-comment-tools">
                        {!isExt && <button onClick={() => setEditingComment({ postId: post.id, index, text: displayName(commentRecord.text, "") })}>수정</button>}
                        {!isExt && <button onClick={() => deleteComment(post.id, index)}>삭제</button>}
                        {isExt && <button onClick={() => setReportTarget(commentReportTarget(post, commentRecord, index))}>신고</button>}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {commentOn === post.id && (
        <div className="al-cmtbox">
          <div className="al-cmtbox-who">
            <button className={`al-spk-chip ${commentAs === "char" ? "on" : ""}`} onClick={() => setCommentAs("char")}>{char.name}</button>
            {USER_PERSONA_FEATURE_ENABLED && personas.map((persona) => (
              <button key={persona.id} className={`al-spk-chip persona ${commentAs === `p:${persona.id}` ? "on" : ""}`} onClick={() => setCommentAs(`p:${persona.id}`)}>🎭 {persona.name}</button>
            ))}
            {USER_PERSONA_FEATURE_ENABLED && <button className="al-spk-chip add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}>+ 페르소나</button>}
          </div>
          <div className="al-cmtbox-row">
            <input className="al-cmtbox-input" value={commentText} autoFocus onChange={(event) => setCommentText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) submitUserComment(post.id, isExt ? post.author : null); }} placeholder={`${commentAs === "char" ? char.name : (personas.find((persona) => `p:${persona.id}` === commentAs)?.name || "")}(으)로 댓글…`} />
            <button className="al-cmtbox-send" onClick={() => submitUserComment(post.id, isExt ? post.author : null)}>↑</button>
          </div>
          <button className="al-cmtbox-cancel" onClick={() => { setCommentOn(null); setCommentText(""); }}>닫기</button>
        </div>
      )}
    </>
  );
}

function displayName(value: unknown, fallback = "?"): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function initialForName(value: unknown): string {
  return displayName(value).trim()[0] || "?";
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function postReportTarget(post, activeId) {
  const external = Boolean(post.authorOwnerId);
  return {
    targetType: external ? "post" : "ai_content",
    targetOwnerId: post.authorOwnerId || undefined,
    targetReference: external ? `${post.authorCharacterId}:${post.originalPostId}` : `${activeId || "local"}:${post.id}`,
    snapshot: { author: post.author || "", text: post.text || "", image: Boolean(post.img) },
    label: external ? `${post.author || "외부 캐릭터"}의 게시물` : "AI 생성 게시물",
  };
}

function commentReportTarget(post, comment, index) {
  return {
    targetType: "comment",
    targetOwnerId: post.authorOwnerId || undefined,
    targetReference: `${post.authorCharacterId}:${post.originalPostId}:${index}`,
    snapshot: { name: comment.name || "", text: comment.text || "" },
    label: `${displayName(comment.name, "외부 캐릭터")}의 댓글`,
  };
}
