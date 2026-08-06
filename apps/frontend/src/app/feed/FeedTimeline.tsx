import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";
import { USER_PERSONA_FEATURE_ENABLED } from "@/domain/app/featureFlags";
import { canManagePost } from "@/domain/feed/feedUtils";

interface GenerationFailureProps {
  message: string;
  onRetry: () => void;
}

interface FirstPostScene {
  description: string;
  label: string;
  mood: string;
}

interface EmptyFeedProps {
  char: { name: string };
  feedView: string;
  onGenerate: (mood: string) => void;
  onStart: () => void;
}

const FIRST_POST_SCENES: FirstPostScene[] = [
  { label: "방금 있었던 일", description: "오늘의 한 장면부터", mood: "일상 / 방금 있었던 일" },
  { label: "혼자 든 생각", description: "속마음부터 조용히", mood: "혼잣말 / 생각" },
  { label: "캐릭터에게 맡기기", description: "캐릭터가 직접 선택", mood: "랜덤 / 알아서" },
];

export function FeedTimeline({ ctx }) {
  const {
    activeId,
    canLikePost,
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
    generatePost,
    isLikePending,
    loading,
    moodOpen,
    myPosts,
    openCommentBox,
    personas,
    saveStatus,
    saveCommentEdit,
    savePostEdit,
    recommendationPosts,
    recommendationUsesInterests,
    setCommentAs,
    setCommentOn,
    setCommentText,
    setEditingComment,
    setEditingPost,
    setFeedView,
    setFixTarget,
    setFixText,
    setMoodOpen,
    setPersonaDraft,
    setReportTarget,
    setSaveStatus,
    setStep,
    submitUserComment,
    timeAgo,
    timelinePosts,
    toggleFollow,
    toggleLike,
    visiblePosts,
  } = ctx;
  const isFirstPost = myPosts.length === 0;
  const generationError = typeof saveStatus === "string" && saveStatus.startsWith("글 생성 실패:") ? saveStatus : "";
  return (
    <>
      <div className="al-feed-tabs" role="tablist" aria-label="게시글 공간">
        <button aria-selected={feedView === "mine"} className={feedTabClass(feedView === "mine")} role="tab" onClick={() => setFeedView("mine")}>
          내 글 <b>{myPosts.length}</b>
        </button>
        <button aria-selected={feedView === "timeline"} className={feedTabClass(feedView === "timeline")} role="tab" onClick={() => setFeedView("timeline")}>
          팔로잉 <b>{timelinePosts.length}</b>
        </button>
        <button aria-selected={feedView === "recommendations"} className={feedTabClass(feedView === "recommendations")} role="tab" onClick={() => setFeedView("recommendations")}>
          추천 <b>{recommendationPosts.length}</b>
        </button>
      </div>
      <div className="al-feed" ref={feedTopRef}>
        {loading && <GeneratingPost char={char} />}
        {!loading && generationError && <GenerationFailure message={generationError} onRetry={() => { setSaveStatus("저장됨"); setFeedView("mine"); setMoodOpen(true); }} />}
        {feedView === "recommendations" && !loading && recommendationPosts.length > 0 && <RecommendationIntro usesInterests={recommendationUsesInterests} />}
        {isFirstPost && feedView === "mine" && !loading && !moodOpen && !generationError && <EmptyFeed char={char} feedView="mine" onExplore={() => setStep("discover")} onGenerate={(mood) => { setFeedView("mine"); generatePost(mood); }} onStart={() => { setFeedView("mine"); setMoodOpen(true); }} />}
        {!(isFirstPost && feedView === "mine") && visiblePosts.length === 0 && !loading && (
          <EmptyFeed char={char} feedView={feedView} onExplore={() => setStep("discover")} onGenerate={generatePost} onStart={() => { setFeedView("mine"); setMoodOpen(true); }} />
        )}
        {visiblePosts.map((post) => (
          <React.Fragment key={post.id}>
            <FeedPostCard post={post} ctx={{ activeId, canLikePost, char, commentAs, commentOn, commentText, deleteComment, deletePost, editingComment, editingPost, isLikePending, openCommentBox, personas, saveCommentEdit, savePostEdit, setCommentAs, setCommentOn, setCommentText, setEditingComment, setEditingPost, setFixTarget, setFixText, setPersonaDraft, setReportTarget, submitUserComment, timeAgo, toggleFollow, toggleLike }} />
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

function EmptyFeed({ char, feedView, onExplore, onGenerate, onStart }: EmptyFeedProps & { onExplore: () => void }): React.ReactElement {
  if (feedView === "timeline") return <div className="al-empty"><span>아직 추가한 캐릭터의 글이 없어요.</span><p>캐릭터를 추가하면 새 글이 이곳에 시간순으로 도착해요.</p><button type="button" onClick={onExplore}>새 캐릭터 둘러보기 <AliveIcon name="arrow-right" size={14} /></button></div>;
  if (feedView === "recommendations") return <div className="al-empty"><span>새로 발견할 글을 준비하고 있어요.</span><p>공개된 게시글이 생기면 관심사와 세계관을 바탕으로 먼저 보여드릴게요.</p><button type="button" onClick={onExplore}>캐릭터 둘러보기 <AliveIcon name="arrow-right" size={14} /></button></div>;
  return <section className="al-first-feed al-first-stage" aria-labelledby="first-stage-title"><header><span>01</span><div><small>이제 캐릭터가 직접 씁니다</small><h3 id="first-stage-title">{char.name}의 오늘을<br />어디서 시작할까요?</h3></div></header><div className="al-first-scenes">{FIRST_POST_SCENES.map((scene, index) => <button key={scene.mood} type="button" onClick={() => onGenerate(scene.mood)}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{index === 2 ? `${char.name}에게 맡기기` : scene.label}</b><small>{scene.description}</small></span><AliveIcon name="arrow-right" size={15} /></button>)}</div><footer><span>다른 분위기로 시작하고 싶다면</span><button aria-label="첫 글의 장면 고르기" type="button" onClick={onStart}>장면 더 보기 <AliveIcon name="arrow-right" size={13} /></button></footer></section>;
}

function RecommendationIntro({ usesInterests }: { usesInterests: boolean }): React.ReactElement {
  const text = usesInterests ? "관심사와 세계관이 닿는 캐릭터의 글이에요." : "새롭게 공개된 캐릭터의 글을 모았어요.";
  return <div className="al-recommendation-intro"><span><AliveIcon name="sparkle" size={15} /></span><p><b>{usesInterests ? "취향을 따라 발견한 이야기" : "새롭게 도착한 이야기"}</b>{text}</p></div>;
}

function GeneratingPost({ char }) {
  return <div className="al-generating-post" role="status" aria-live="polite"><span className="al-generating-avatar"><CharacterAvatarImage src={char.avatarImg} /><i /></span><div><small>새 글을 쓰는 중</small><b>{char.name}가 장면을 떠올리고 있어요</b><p>말투와 설정을 살펴보고 있어요.</p><span className="al-generating-line"><i /><i /><i /></span></div></div>;
}

function GenerationFailure({ message, onRetry }: GenerationFailureProps): React.ReactElement {
  return <div className="al-generation-failure" role="alert"><div><b>글을 완성하지 못했어요.</b><p>{message.replace(/^글 생성 실패:\s*/, "")}</p></div><button className="border-danger bg-danger-soft text-danger hover:bg-danger hover:text-white" type="button" onClick={onRetry}>다시 장면 고르기</button></div>;
}

function FeedPostCard({ post, ctx }) {
  const {
    activeId,
    canLikePost,
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
    toggleFollow,
    toggleLike,
  } = ctx;
  const isExt = Boolean(post.author);
  const pName = isExt ? displayName(post.author) : displayName(char.name);
  const pHandle = isExt ? displayName(post.authorHandle || post.author) : (char.handle || pName.replace(/\s/g, "").toLowerCase());
  const pAvatar = isExt ? post.authorAvatarImg : char.avatarImg;
  const canManage = canManagePost(post);
  return (
    <div className="al-post">
      <div className={`al-post-av ${isExt ? "ext" : ""}`}><CharacterAvatarImage src={pAvatar} /></div>
      <div className="al-post-body">
        <div className="al-post-head">
          <span className="al-post-name">{pName}</span>
          <span className="al-post-handle">@{pHandle}</span>
          {isExt && <span className="al-post-extbadge">{post.importedFromRecommendation ? (post.recommendationReason === "interest" ? "취향 추천" : "새 이야기") : "추가한 캐릭터"}</span>}
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
          <button className={`al-like ${post.liked ? "on text-like" : "text-soft hover:text-like"}`} disabled={isLikePending(post.id) || !canLikePost(post)} title={!canLikePost(post) ? "타임라인에 추가한 뒤 공감할 수 있어요." : undefined} onClick={() => toggleLike(post.id)}><AliveIcon name={post.liked ? "heart-filled" : "heart"} size={15} /> {post.likes}</button>
          {post.importedFromRecommendation && post.recommendedCharacter && <button className="al-follow-recommendation" type="button" onClick={() => toggleFollow(post.recommendedCharacter)}>타임라인에 추가 <AliveIcon name="plus" size={13} /></button>}
          {canManage && !post.byUser && <button className="al-fixbtn" onClick={() => { setFixTarget({ type: "post", id: post.id, text: post.text }); setFixText(""); }}>캐릭터답지 않아요</button>}
          {(canManage || !post.byUser) && <details className="al-post-more"><summary aria-label={canManage ? "게시물 관리" : "게시물 더보기"}><span>{canManage ? "관리" : "더보기"}</span><i><AliveIcon name="more" size={14} /></i></summary><div>{canManage && <button onClick={() => setEditingPost({ id: post.id, text: post.text })}>수정</button>}{canManage && <button className="danger" onClick={() => deletePost(post.id)}>삭제</button>}{!post.byUser && <button className="safety" onClick={() => setReportTarget(postReportTarget(post, activeId))}>신고</button>}</div></details>}
        </div>
        <FeedComments post={post} ctx={{ char, commentAs, commentOn, commentText, deleteComment, editingComment, personas, saveCommentEdit, setCommentAs, setCommentOn, setCommentText, setEditingComment, setPersonaDraft, setReportTarget, submitUserComment, isExt }} />
        {commentOn !== post.id && <button className="al-cmt-open border-line bg-surface text-soft hover:border-accent hover:bg-accent-soft hover:text-accent-ink" onClick={() => openCommentBox(post.id)}><AliveIcon name="message" size={15} /> 댓글 달기</button>}
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
            <span className="al-quoted-av"><CharacterAvatarImage src={quoted.avatarImg} /></span>
            <span className="al-quoted-name">{displayName(quoted.name)}</span>
            <span className="al-quoted-handle">@{displayName(quoted.handle, "")}</span>
          </div>
          <p className="al-quoted-text">{displayName(quoted.text, "")}</p>
        </div>
      )}
      {post.img && <div className="al-post-img"><img src={post.img} alt="" /></div>}
      {post.photoDesc && !post.img && <div className="al-post-photo"><span className="al-photo-frame"><AliveIcon name="image" size={16} /></span><span className="al-photo-desc">{post.photoDesc}</span></div>}
      {post.moodDesc && <div className="al-post-moodcard"><AliveIcon name="music" size={16} /> {post.moodDesc}</div>}
    </>
  );
}

function FeedComments({ post, ctx }) {
  const { char, commentAs, commentOn, commentText, deleteComment, editingComment, personas, saveCommentEdit, setCommentAs, setCommentOn, setCommentText, setEditingComment, setPersonaDraft, setReportTarget, submitUserComment, isExt } = ctx;
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const selectedPersona = personas.find((persona) => `p:${persona.id}` === commentAs);
  const commentSpeakerName = commentAs === "char" ? char.name : (selectedPersona?.name || char.name);
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
                <div className={`al-comment-av ${commentRecord.byUser ? "mine" : ""}`}><CharacterAvatarImage src={commentRecord.byUser ? char.avatarImg : commentRecord.avatarImg} /></div>
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
        <div className="al-cmtbox" aria-label="댓글 작성">
          <div className="al-cmtbox-head">
            <span className="al-cmtbox-avatar">{commentAs === "char" ? <CharacterAvatarImage src={char.avatarImg} /> : <AliveIcon name="masks" size={15} />}</span>
            <span className="al-cmtbox-context"><b>{commentSpeakerName}</b> 계정으로 댓글</span>
            <button className="al-cmtbox-cancel" type="button" aria-label="댓글 작성 닫기" onClick={() => { setCommentOn(null); setCommentText(""); }}><AliveIcon name="close" size={16} /></button>
          </div>
          {USER_PERSONA_FEATURE_ENABLED && <div className="al-cmtbox-who"><button className={`al-spk-chip ${commentAs === "char" ? "on" : ""}`} onClick={() => setCommentAs("char")}>{char.name}</button>{personas.map((persona) => <button key={persona.id} className={`al-spk-chip persona ${commentAs === `p:${persona.id}` ? "on" : ""}`} onClick={() => setCommentAs(`p:${persona.id}`)}><AliveIcon name="masks" size={14} /> {persona.name}</button>)}<button className="al-spk-chip add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}><AliveIcon name="plus" size={14} /> 페르소나</button></div>}
          <div className="al-cmtbox-row">
            <input className="al-cmtbox-input" value={commentText} autoFocus enterKeyHint="send" aria-label={`${commentSpeakerName} 계정으로 댓글 입력`} onChange={(event) => setCommentText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) void submitUserComment(post); }} placeholder="댓글을 입력하세요" />
            <button className="al-cmtbox-send bg-accent text-white hover:bg-accent-strong disabled:bg-surface-muted disabled:text-faint" type="button" disabled={!commentText.trim()} aria-label="댓글 보내기" onClick={() => void submitUserComment(post)}><AliveIcon name="send" size={18} /></button>
          </div>
        </div>
      )}
    </>
  );
}

function displayName(value: unknown, fallback = "?"): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function feedTabClass(active: boolean): string {
  return active ? "on border-accent bg-accent-soft text-ink" : "border-transparent bg-transparent text-soft hover:bg-surface hover:text-ink";
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
