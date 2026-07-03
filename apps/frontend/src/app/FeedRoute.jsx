import React from "react";

export function FeedRoute({ ctx }) {
  const {
    activeSharedId,
    addManualMemory,
    affinityStage,
    affOf,
    auto,
    canUseApp,
    char,
    commentAs,
    commentOn,
    commentText,
    deleteComment,
    deleteMemory,
    deletePost,
    deleteRelationAt,
    editingComment,
    editingMemoryId,
    editingPost,
    editMemory,
    fast,
    feedTopRef,
    feedView,
    followerCounts,
    following,
    followPanel,
    gallery,
    generatePost,
    goHome,
    handleProfileImage,
    handleUpload,
    initial,
    isFollowedCharacterName,
    josa,
    loading,
    lorePeerOptions,
    manualPost,
    memDraftText,
    memFilter,
    moodOpen,
    myFollowers,
    myPosts,
    nextIn,
    normalizeMemoryEntry,
    openCommentBox,
    parseRelations,
    peer,
    personas,
    relationStageLabel,
    relLabelFor,
    renderLorePeerSelect,
    saveCommentEdit,
    savePostEdit,
    setAffinityManual,
    setAuto,
    setCommentAs,
    setCommentOn,
    setCommentText,
    setDiscoverQuery,
    setEditingComment,
    setEditingMemoryId,
    setEditingPost,
    setFast,
    setFeedView,
    setFixTarget,
    setFixText,
    setGallery,
    setMemDraftPeer,
    setMemDraftText,
    setMemFilter,
    setMoodOpen,
    setPersonaDraft,
    setSharedFocusId,
    setShowMemoryAdd,
    setStep,
    setWorldModal,
    setWriteOpen,
    setWriteText,
    shareCurrentCharacter,
    shareStatus,
    showMemory,
    showMemoryAdd,
    showRelations,
    step,
    submitUserComment,
    timeAgo,
    timelinePosts,
    toggleFollowPanel,
    toggleLike,
    toggleMemoryPanel,
    toggleRelationsPanel,
    update,
    updateMemory,
    visiblePosts,
    WorldChip,
    writeOpen,
    writeText,
  } = ctx;
  return (
    <>
      {canUseApp && step === "feed" && (
        <div className="al-phone">
          {/* 프로필 헤더 */}
          <div className="al-profile">
            <button className="al-back" onClick={goHome}>‹</button>
            <div className="al-banner">
              {char.headerImg && <img src={char.headerImg} alt="" />}
              <div className="al-cover-tools">
                <label title="헤더 등록">
                  헤더 편집
                  <input type="file" accept="image/*" onChange={(e) => handleProfileImage("header", e)} hidden />
                </label>
                {char.headerImg && <button onClick={() => update("headerImg", "")}>삭제</button>}
              </div>
            </div>
            <div className="al-avatar-wrap">
              <div className="al-avatar">
                {char.avatarImg ? <img src={char.avatarImg} alt="" /> : initial}
              </div>
              <div className="al-avatar-tools">
                <label title="인장 등록">
                  편집
                  <input type="file" accept="image/*" onChange={(e) => handleProfileImage("avatar", e)} hidden />
                </label>
                {char.avatarImg && <button onClick={() => update("avatarImg", "")}>삭제</button>}
              </div>
            </div>
            <div className="al-profile-info">
              <div className="al-profile-top">
                <div className="al-profile-top-main">
                  <div className="al-name-line">
                    <h2>{char.name}</h2>
                    <WorldChip character={char} fallback="current-character" onOpen={setWorldModal} />
                  </div>
                  <span className="al-handle">@{char.handle || char.name.replace(/\s/g, "").toLowerCase()}</span>
                </div>
                <div className="al-feed-actions">
                  <button className="al-dmbtn ghost" onClick={() => { setDiscoverQuery(""); setSharedFocusId(""); setStep("discover"); }} title="탐색"><span>🔍</span><b>탐색</b></button>
                  <button className="al-dmbtn ghost" onClick={shareCurrentCharacter} title="공유"><span>🔗</span><b>공유</b></button>
                  <button className="al-dmbtn" onClick={() => setStep("dmlist")} title="DM"><span>✉</span><b>DM</b></button>
                </div>
              </div>
              <p className="al-bio">
                {char.age && <span className="al-bio-tag">{char.age}</span>}
                {char.surface && <span className="al-bio-tag">{char.surface}</span>}
              </p>
              {char.persona && <p className="al-bio-text">{char.persona}</p>}
              {shareStatus && <p className="al-share-status">{shareStatus}</p>}

              <div className="al-follow-stats">
                <button className={`al-fstat ${followPanel === "following" ? "on" : ""}`} onClick={() => toggleFollowPanel("following")}>
                  <b>{following.length}</b> 팔로잉
                </button>
                <button className={`al-fstat ${followPanel === "followers" ? "on" : ""}`} onClick={() => toggleFollowPanel("followers")}>
                  <b>{activeSharedId ? (followerCounts[activeSharedId] || 0) : myFollowers().length}</b> 팔로워
                </button>
                <button className={`al-fstat ${showMemory ? "on" : ""}`} onClick={toggleMemoryPanel}>
                  🧠 <b>{(char.lorebook || []).length}</b> 장기기억 {showMemory ? "▾" : "▸"}
                </button>
                {(() => {
                  const relCount = parseRelations(char.relations).length;
                  return relCount > 0 ? (
                    <button className={`al-fstat ${showRelations ? "on" : ""}`} onClick={toggleRelationsPanel}>
                      💞 <b>{relCount}</b> 관계 {showRelations ? "▾" : "▸"}
                    </button>
                  ) : null;
                })()}
                {myFollowers().length > 0 && <span className="al-fstat-new">친해진 캐가 맞팔했어!</span>}
              </div>

              {showRelations && (() => {
                const rels = parseRelations(char.relations);
                if (!rels.length) return null;
                return (
                  <div className="al-rellist">
                    {rels.map(({ who, label }, i) => {
                      const aff = affOf(char.name, who);
                      const back = affOf(who, char.name); // 상대가 나를 향한 마음
                      const neg = aff < 0;
                      const peerExists = isFollowedCharacterName(who); // 탐색에서 팔로한 캐릭터일 때만 특별관계 활성화
                      // 짝사랑: 상대가 존재하고, 내 마음은 깊은데(50+) 상대는 얕을 때. (라벨이 짝사랑이면 무조건)
                      const oneSided = (peerExists && relLabelFor(char, who) === "짝사랑")
                        || (peerExists && aff >= 50 && back < 30 && !/부부|배우자|연인|애인|약혼|사랑/.test(label));
                      return (
                        <div className="al-rel" key={i}>
                          <div className="al-rel-top">
                            <span className="al-rel-av">{(who.trim()[0]) || "?"}</span>
                            <span className="al-rel-who">{who}</span>
                            {oneSided && <span className="al-rel-onesided">💔 짝사랑</span>}
                            <span className="al-rel-stage">{relationStageLabel(label, aff)} · {aff}</span>
                            <button type="button" className="al-rel-delete" onClick={() => deleteRelationAt(i)}>삭제</button>
                          </div>
                          {label && <p className="al-rel-desc">{label}</p>}
                          <div className="al-rel-bar">
                            <div className={`al-rel-fill ${neg ? "neg" : ""}`} style={{ width: `${Math.abs(aff)}%` }} />
                          </div>
                          <div className="al-rel-edit">
                            <span>내 호감도</span>
                            <input type="range" min="-100" max="100" value={aff}
                              onChange={(e) => setAffinityManual(char.name, who, e.target.value)} />
                            <input type="number" min="-100" max="100" value={aff}
                              onChange={(e) => setAffinityManual(char.name, who, e.target.value)} />
                          </div>
                          {oneSided && <span className="al-rel-onesided-note">{who}의 마음은 아직 {affinityStage(back)}({back}) — 아직 닿지 않았어</span>}
                        </div>
                      );
                    })}
                    <p className="al-mem-note">{char.name}의 관계와 지금 마음. 대화할수록 호감도가 변해.</p>
                  </div>
                );
              })()}

              {showMemory && (
                <div className="al-memlist">
                  {(char.lorebook || []).length === 0 ? (
                    <>
                      <p className="al-mem-note">아직 쌓인 장기기억이 없어. {char.name}가 대화를 나누면 핵심을 자동으로 기억해 — 약속·사건·감정 같은 걸 잊지 않게.</p>
                      <button className="al-mem-add-toggle" onClick={() => setShowMemoryAdd((v) => !v)}>
                        + 새 장기기억 추가
                      </button>
                      {showMemoryAdd && (
                        <div className="al-mem-add slide">
                          {renderLorePeerSelect(lorePeerOptions())}
                          <textarea value={memDraftText} onChange={(e) => setMemDraftText(e.target.value)} placeholder="감정 변화와 원인, 약속, 사건 같은 핵심만 추가" />
                          <button className="al-mem-add-btn" disabled={!memDraftText.trim()} onClick={addManualMemory}>장기기억 추가</button>
                        </div>
                      )}
                    </>
                  ) : (() => {
                    const allMem = (char.lorebook || []).map(normalizeMemoryEntry);
                    const peerOptions = lorePeerOptions();
                    const peerEntries = [...new Set(allMem.map((e) => e.peer || "*"))]
                      .map((peer) => ({ peer, count: allMem.filter((e) => (e.peer || "*") === peer).length }))
                      .sort((a, b) => b.count - a.count);
                    const shown = allMem
                      .filter((e) => (e.peer || "*") === memFilter)
                      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.importance || 2) - (a.importance || 2) || (b.id || 0) - (a.id || 0))
                      .slice(0, 30);
                    return (
                      <>
                        {!memFilter ? (
                          <div className="al-mem-peers">
                            {peerEntries.map(({ peer, count }) => (
                              <button key={peer} className="al-mem-peer-card" onClick={() => { setMemFilter(peer); setMemDraftPeer(peer === "*" ? "" : peer); }}>
                                <span className="al-mem-peer-av">{peer === "*" ? "＊" : (peer.trim()[0] || "?")}</span>
                                <span className="al-mem-peer-info">
                                  <b>{peer === "*" ? "전체 설정" : peer}</b>
                                  <small>{count}개</small>
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div className="al-mem-detail-head">
                              <button onClick={() => setMemFilter(null)}>‹ 사람별 목록</button>
                              <span>{memFilter === "*" ? "전체 설정" : memFilter}</span>
                            </div>
                            {shown.length === 0 && <p className="al-mem-note">이 사람에게 남은 장기기억이 없어.</p>}
                            {shown.map((e) => {
                              const editing = editingMemoryId === e.id;
                              const importanceLabel = (e.importance || 2) >= 5 ? "핵심" : (e.importance || 2) >= 4 ? "사건" : "감정";
                              return (
                                <div className={`al-mem-card ${e.pinned ? "pinned" : ""}`} key={e.id}>
                                  <div className="al-mem-card-top">
                                    <span className="al-mem-kind">{importanceLabel}</span>
                                    <span className="al-mem-source">{e.source === "manual" ? "수동" : "자동"}</span>
                                    {e.pinned && <span className="al-mem-pin">고정</span>}
                                    <div className="al-mem-card-actions">
                                      <button onClick={() => updateMemory(e.id, { pinned: !e.pinned })}>{e.pinned ? "해제" : "고정"}</button>
                                      <button onClick={() => setEditingMemoryId(editing ? null : e.id)}>{editing ? "닫기" : "수정"}</button>
                                      <button className="danger" onClick={() => deleteMemory(e.id)}>삭제</button>
                                    </div>
                                  </div>
                                  {editing ? (
                                    <div className="al-mem-editbox">
                                      <textarea value={e.content} onChange={(ev) => editMemory(e.id, ev.target.value)} />
                                      <select value={e.importance || 3} onChange={(ev) => updateMemory(e.id, { importance: Number(ev.target.value) })}>
                                        <option value={3}>감정 변화</option>
                                        <option value={4}>중요 사건</option>
                                        <option value={5}>핵심 기억</option>
                                      </select>
                                    </div>
                                  ) : (
                                    <p className="al-mem-card-text">{e.content}</p>
                                  )}
                                </div>
                              );
                            })}
                            <button className="al-mem-add-toggle" onClick={() => setShowMemoryAdd((v) => !v)}>
                              + {memFilter === "*" ? "전체 설정" : memFilter} 장기기억 추가
                            </button>
                            {showMemoryAdd && (
                              <div className="al-mem-add slide">
                                {renderLorePeerSelect(peerOptions, memFilter)}
                                <textarea value={memDraftText} onChange={(e) => setMemDraftText(e.target.value)} placeholder="감정 변화와 원인, 약속, 사건 같은 핵심만 추가" />
                                <button className="al-mem-add-btn" disabled={!memDraftText.trim()} onClick={addManualMemory}>장기기억 추가</button>
                              </div>
                            )}
                          </>
                        )}
                        {!memFilter && (
                          <>
                            <button className="al-mem-add-toggle" onClick={() => setShowMemoryAdd((v) => !v)}>
                              + 새 장기기억 추가
                            </button>
                            {showMemoryAdd && (
                              <div className="al-mem-add compact slide">
                                <div className="al-mem-add-title">새 장기기억 추가</div>
                                {renderLorePeerSelect(peerOptions)}
                                <textarea value={memDraftText} onChange={(e) => setMemDraftText(e.target.value)} placeholder="감정 변화와 원인, 약속, 사건 같은 핵심만 추가" />
                                <button className="al-mem-add-btn" disabled={!memDraftText.trim()} onClick={addManualMemory}>장기기억 추가</button>
                              </div>
                            )}
                          </>
                        )}
                        <p className="al-mem-note">{memFilter ? "감정 변화는 원인까지 남겨야 오래 기억해. 필요 없는 항목은 삭제할 수 있어." : "사람을 선택하면 해당 상대와의 장기기억만 열려. 전체 설정은 특정 상대 없이 항상 참고하는 내용이야."}</p>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 캐릭터 그림 갤러리 */}
              <div className="al-gallery">
                <div className="al-gallery-head">
                  <span>{char.name}의 그림 {gallery.length > 0 && `(${gallery.length})`}</span>
                  <label className="al-upload">
                    + 그림 올리기
                    <input type="file" accept="image/*" multiple onChange={handleUpload} hidden />
                  </label>
                </div>
                {gallery.length > 0 ? (
                  <div className="al-gallery-strip">
                    {gallery.map((g, i) => (
                      <div className="al-thumb" key={i}>
                        <img src={g} alt="" />
                        <button className="al-thumb-x" onClick={() => setGallery((arr) => arr.filter((_, idx) => idx !== i))}>×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="al-gallery-empty">캐릭터 그림을 올려두면, {char.name}가 셀카·일상·랜덤 글을 쓸 때 알아서 골라 붙여.</p>
                )}
              </div>
            </div>
          </div>

          {/* 자율 포스팅 컨트롤 */}
          <div className="al-autobar">
            <button className={`al-autotoggle ${auto ? "on" : ""}`} onClick={() => setAuto((a) => !a)}>
              <span className="al-autodot" />
              {auto ? `자율 모드 ON · ${josa(char.name, "이/가")} 알아서 올리는 중` : "자율 모드 OFF"}
            </button>
            {auto && (
              <div className="al-autometa">
                <span className="al-nextin">{fast ? "" : "다음 글 "}~{Math.floor(nextIn / 60)}:{String(nextIn % 60).padStart(2, "0")}</span>
                <button className={`al-fast ${fast ? "on" : ""}`} onClick={() => setFast((f) => !f)}>
                  {fast ? "빠름(30초)" : "15분"}
                </button>
              </div>
            )}
          </div>

          {/* 직접 지시 — 상시 지침 */}
          <div className="al-directive">
            <span className="al-directive-lbl">▸ {josa(char.name, "에게/에게")} 지시</span>
            <input className="al-directive-input" value={char.directions || ""}
              onChange={(e) => update("directions", e.target.value)}
              placeholder="예: 연이랑 데이트하고 기분 좋음 / 시험 끝나서 들뜬 상태" />
            {(char.directions || "").trim() && <span className="al-directive-on">적용 중</span>}
          </div>

          {/* 글 쓰게 하기 */}
          <div className="al-composer">
            {!moodOpen ? (
              <div className="al-compose-row">
                <button className="al-wake" onClick={() => setMoodOpen(true)} disabled={loading}>
                  {loading ? <span className="al-typing"><i/><i/><i/></span> : `✶ ${josa(char.name, "한테/한테")} 시키기`}
                </button>
                <button className="al-writeself" onClick={() => setWriteOpen((w) => !w)}>✎ 내가 쓰기</button>
              </div>
            ) : (
              <div className="al-moods">
                <p className="al-moods-q">어떤 글을 올릴까?</p>
                <div className="al-moods-grid">
                  {POST_MOODS.map((m) => (
                    <button key={m} className="al-mood" onClick={() => generatePost(m)}>{m}</button>
                  ))}
                </div>
                <button className="al-moods-cancel" onClick={() => setMoodOpen(false)}>닫기</button>
              </div>
            )}
            {writeOpen && (
              <div className="al-writebox">
                <p className="al-write-lbl">{josa(char.name, "으로/로")} 직접 작성 — 내가 이 캐릭터가 되어 올림</p>
                <textarea value={writeText} onChange={(e) => setWriteText(e.target.value)}
                  placeholder={`${char.name}의 글을 직접 써봐…`} />
                <div className="al-write-actions">
                  <button className="al-write-cancel" onClick={() => { setWriteOpen(false); setWriteText(""); }}>취소</button>
                  <button className="al-write-post" disabled={!writeText.trim()}
                    onClick={() => { manualPost(writeText); setWriteText(""); setWriteOpen(false); }}>올리기</button>
                </div>
              </div>
            )}
          </div>

          {/* 피드 */}
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
            {visiblePosts.map((post) => {
              const isExt = !!post.author; // author 있으면 외부(팔로우) 캐 글, 없으면 내 캐릭터
              const pName = isExt ? post.author : char.name;
              const pHandle = isExt ? (post.authorHandle || post.author) : (char.handle || char.name.replace(/\s/g, "").toLowerCase());
              const pInitial = pName.trim()[0] || "?";
              const pAvatar = isExt ? post.authorAvatarImg : char.avatarImg;
              return (
              <div className="al-post" key={post.id}>
                <div className={`al-post-av ${isExt ? "ext" : ""}`}>
                  {pAvatar ? <img src={pAvatar} alt="" /> : pInitial}
                </div>
                <div className="al-post-body">
                  <div className="al-post-head">
                    <span className="al-post-name">{pName}</span>
                    <span className="al-post-handle">@{pHandle}</span>
                    {isExt && <span className="al-post-extbadge">팔로잉</span>}
                    <span className="al-post-time">· {timeAgo(post.time)}</span>
                  </div>
                  {editingPost?.id === post.id ? (
                    <div className="al-editbox">
                      <textarea value={editingPost.text} autoFocus
                        onChange={(e) => setEditingPost((p) => ({ ...p, text: e.target.value }))} />
                      <div className="al-edit-actions">
                        <button onClick={() => setEditingPost(null)}>취소</button>
                        <button className="primary" disabled={!editingPost.text.trim()} onClick={savePostEdit}>저장</button>
                      </div>
                    </div>
                  ) : (
                    <p className="al-post-text">{post.text}{post.edited && <i className="al-edited">수정됨</i>}</p>
                  )}

                  {post.quoted && (
                    <div className="al-quoted">
                      <div className="al-quoted-head">
                        <span className="al-quoted-av">{post.quoted.name.trim()[0] || "?"}</span>
                        <span className="al-quoted-name">{post.quoted.name}</span>
                        <span className="al-quoted-handle">@{post.quoted.handle}</span>
                      </div>
                      <p className="al-quoted-text">{post.quoted.text}</p>
                    </div>
                  )}

                  {post.img && (
                    <div className="al-post-img"><img src={post.img} alt="" /></div>
                  )}
                  {post.photoDesc && !post.img && (
                    <div className="al-post-photo">
                      <span className="al-photo-frame">◹</span>
                      <span className="al-photo-desc">{post.photoDesc}</span>
                    </div>
                  )}
                  {post.moodDesc && (
                    <div className="al-post-moodcard">♫ {post.moodDesc}</div>
                  )}

                  <div className="al-post-actions">
                    <button className={`al-like ${post.liked ? "on" : ""}`} onClick={() => toggleLike(post.id)}>
                      {post.liked ? "♥" : "♡"} {post.likes}
                    </button>
                    {!post.byUser && (
                      <button className="al-fixbtn" onClick={() => { setFixTarget({ type: "post", id: post.id, text: post.text }); setFixText(""); }}>
                        ⚠ 캐해 아님
                      </button>
                    )}
                    <span className="al-post-mood">{post.isAuto && <i className="al-auto-badge">자율</i>}{post.byUser && <i className="al-user-badge">내가</i>}{(post.mood || "").split(" / ")[0]}</span>
                    <button className="al-mini-action" onClick={() => setEditingPost({ id: post.id, text: post.text })}>수정</button>
                    <button className="al-mini-action danger" onClick={() => deletePost(post.id)}>삭제</button>
                  </div>

                  {(post.comments || []).length > 0 && (
                    <div className="al-comments">
                      {post.comments.map((c, ci) => (
                        <div className="al-comment" key={ci}>
                          <div className={`al-comment-av ${c.byUser ? "mine" : ""}`}>{c.name.trim()[0] || "?"}</div>
                          <div className="al-comment-body">
                            <span className="al-comment-name">{c.name}{c.byUser && <i className="al-cmt-mine">나</i>}</span>
                            {c.replyTo && c.replyTo !== c.name && <span className="al-replyto"> @{c.replyTo}에게 답글</span>}
                            {editingComment?.postId === post.id && editingComment.index === ci ? (
                              <div className="al-comment-editbox">
                                <input value={editingComment.text} autoFocus
                                  onChange={(e) => setEditingComment((v) => ({ ...v, text: e.target.value }))} />
                                <button onClick={() => setEditingComment(null)}>취소</button>
                                <button disabled={!editingComment.text.trim()} onClick={saveCommentEdit}>저장</button>
                              </div>
                            ) : (
                              <>
                                <span className="al-comment-text">{c.text}{c.edited && <i className="al-edited">수정됨</i>}</span>
                                <span className="al-comment-tools">
                                  <button onClick={() => setEditingComment({ postId: post.id, index: ci, text: c.text })}>수정</button>
                                  <button onClick={() => deleteComment(post.id, ci)}>삭제</button>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {commentOn === post.id ? (
                    <div className="al-cmtbox">
                      <div className="al-cmtbox-who">
                        <button className={`al-spk-chip ${commentAs === "char" ? "on" : ""}`} onClick={() => setCommentAs("char")}>{char.name}</button>
                        {personas.map((p) => (
                          <button key={p.id} className={`al-spk-chip persona ${commentAs === `p:${p.id}` ? "on" : ""}`}
                            onClick={() => setCommentAs(`p:${p.id}`)}>🎭 {p.name}</button>
                        ))}
                        <button className="al-spk-chip add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}>+ 페르소나</button>
                      </div>
                      <div className="al-cmtbox-row">
                        <input className="al-cmtbox-input" value={commentText} autoFocus
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitUserComment(post.id, isExt ? post.author : null); }}
                          placeholder={`${commentAs === "char" ? char.name : (personas.find((p) => `p:${p.id}` === commentAs)?.name || "")}(으)로 댓글…`} />
                        <button className="al-cmtbox-send" onClick={() => submitUserComment(post.id, isExt ? post.author : null)}>↑</button>
                      </div>
                      <button className="al-cmtbox-cancel" onClick={() => { setCommentOn(null); setCommentText(""); }}>닫기</button>
                    </div>
                  ) : (
                    <button className="al-cmt-open" onClick={() => openCommentBox(post.id)}>💬 댓글 달기</button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {}
    </>
  );
}
