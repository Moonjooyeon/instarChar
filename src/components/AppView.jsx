import React from "react";

export function AppView({ ctx }) {
  const { accounts, accountSnapshot, activeId, activePersona, activeSharedId, addCommentFrom, addCorrection, addManualMemory, advanceRelation, affinity, affinityOpen, affinityRemainderRef, affinityStage, affinityWithBase, affOf, ANTI_REPEAT_BASE_RULES, ANTI_REPEAT_RULES, apiContentText, apiErrorText, applyAppState, applyRelationshipAutoFollowsToAccounts, appScreenVisible, attachStage, authBusy, authEmail, AuthEntryScreen, authLoading, AuthLoadingScreen, authMessage, authMode, authPassword, authRedirectUrl, authResolvedRef, auto, AUTO_MOODS, autoChatRef, autoChatting, autoPost, baseFollowerCount, blankAppState, blankChar, BUILD_MARK, bumpAffinity, bumpMutual, bumpRoomAffinity, bumpRoomMutual, canActivateSpecialRelation, canAutoComment, canonicalDmKey, canUseApp, char, chatMode, chatSafetyRules, chooseDmWorldMode, cleanApiFailureMessage, cleanMemItems, clearLocalAuthStorage, closeProfilePanels, commentAs, commentOn, commentText, compactProfileBackup, completeOnboarding, confirmDeleteCharacter, confirmReady, ConfirmScreen, correctionBlock, correctionBlockFor, css, currentWorldPref, defaultCommentAs, defaultDmTitle, deleteComment, deletedDmKeys, deletedDmKeysRef, deleteDmThread, deleteMemory, deletePersona, deletePost, deleteRelationAt, deleteRoomMemory, deleteStructuredCharacterAccount, deleteTarget, dirKey, DISCOVER_POOL, discoverQuery, DiscoverScreen, discoverShowFollowed, displayDmTitle, dm, dmAffOf, dmEndRef, dmImageDraft, dmInput, dmKey, dmKeyFor, dmKeyRef, DmListScreen, dmPrefDraft, dmRequestSeqRef, dmSending, dmSendingRef, dmSettingsOpen, dmThreads, dmThreadTitles, dmWorldDraft, dmWorldPrefs, dump, DumpScreen, editAccount, editingComment, editingDmTitle, editingMemoryId, editingPost, editMemory, enterDm, EXAMPLES, exportAppState, fast, feedInitRef, feedTopRef, feedView, fieldText, findPeerChar, finishDmChatKind, finishDmWorldSetup, finiteNumber, fixTarget, fixText, flashShareStatus, FOLLOWBACK_THRESHOLD, followBackSyncRef, followedTimelinePosts, followerCounts, followerPost, followersReactTo, following, followPanel, followsCharacter, gallery, generatePost, genLine, goHome, handleDmImage, handleProfileImage, handleUpload, hasMainScreen, hasSupabaseConfig, hasUsableSavedState, HomeScreen, initial, intimacyBoundaryRules, isFollowedCharacterName, isFollowing, isLoveRelation, isMyOwnChar, isOwnerName, isPersonaName, josa, judgeAcceptance, judgeSession, loadFollowerCountsFor, loading, loadingRef, loadSharedCharacterById, loadSharedCharacters, loadSharedFollowers, loadStructuredStateFallback, localDmKey, localRoomIdFromDmThreadKey, loreBlockFor, lorePeerOptions, LOVE_RELATIONS, makeLocalDmRoomId, manualPost, memDraftCustomPeer, memDraftPeer, memDraftText, memFilter, memSimilar, memTokens, meName, moodOpen, myConversations, myFollowers, myPosts, nameMatch, navApplyingRef, navInitRef, navKey, navLastKeyRef, navStateForHistory, navUrlForState, newChatMode, newChatSpeaker, newPassword, nextIn, nextRelationLabel, normalizedRelationLabelFor, normalizeHandle, normalizeMemoryEntry, normalizeRelationLabelsForChar, onboardingOpen, OOC_GUARD_RULE, openCommentBox, openDmSettings, OWNER, ownerDmKey, ownerLabel, ownerPersona, ownerSpeaking, parseDump, parseError, parseFailed, parseRelations, parsing, passwordRecoveryOpen, peer, pendingDm, persistLocalSnapshot, personaDraft, personas, posts, processSession, profileLoadedRef, profileLoading, profileLoadRetry, profileName, profileTableBrokenRef, profileUpsertPayload, proposal, PROPOSAL_THRESHOLD, proposalCooldownRef, ProposalModal, proposalRef, proposingRef, publicFollowerCount, publicFollowingCount, publicPostSnapshot, publicProfile, QUICK_FIXES, readableAuthError, readApiContent, readApiJson, readLocalSnapshot, recentLinesBlock, recordFollowChange, recordRelationshipFollowBack, recoverAuthScreen, RecoveryScreen, RELATION_BASE, relationAutoFollowsFor, relationBaseFor, relationMatched, relationBaseFromLabel, relationFor, relationHintFor, relationLabelFromAffinity, relationResult, RelationResultModal, relationStageLabel, relLabelFor, renderLorePeerSelect, repairRoomAffinityBase, requestDmEntry, resetAffinityForDmThread, resetRuntimeState, resolveProposal, roomAffOf, roomInitialAffinity, roomKeyFromDmThreadKey, roomLoreBlockFor, roomMemoryEntries, rpLog, sanitizeSavedState, saveAppStateSnapshot, saveCharacterEdits, saveCommentEdit, saveDmSettings, saveMemories, savePostEdit, saveRenameDm, saveStatus, saveTimerRef, sendDM, sendMagicLoginLink, sendPasswordReset, session, setAccounts, setActiveId, setActiveSharedId, setAffinity, setAffinityManual, setAffinityOpen, setAuthEmail, setAuthLoading, setAuthMessage, setAuthMode, setAuthPassword, setAuto, setAutoChatting, setChar, setChatMode, setCommentAs, setCommentOn, setCommentText, setDeletedDmKeys, setDeleteTarget, setDiscoverQuery, setDiscoverShowFollowed, setDmImageDraft, setDmInput, setDmPrefDraft, setDmSending, setDmSettingsOpen, setDmThread, setDmThreads, setDmThreadTitles, setDmWorldDraft, setDmWorldPrefs, setDump, setEditingComment, setEditingDmTitle, setEditingMemoryId, setEditingPost, setFast, setFeedView, setFixTarget, setFixText, setFollowerCounts, setFollowing, setFollowPanel, setGallery, setLoading, setMemDraftCustomPeer, setMemDraftPeer, setMemDraftText, setMemFilter, setMoodOpen, setNewChatMode, setNewChatSpeaker, setNewPassword, setNextIn, setOnboardingOpen, setOwnerPersona, setParseError, setParseFailed, setParsing, setPasswordRecoveryOpen, setPeer, setPendingDm, setPersonaDraft, setPersonas, setPosts, setProfileLoading, setProfileLoadRetry, setProfileName, setProposal, setPublicProfile, setRelationLabelFor, setRelationResult, setRelationToLove, setRpLog, setSaveStatus, setSession, setSharedCharacters, setSharedFocusId, setSharedFollowers, setSharedLoadState, setShareStatus, setShowMemory, setShowMemoryAdd, setShowPeerMem, setShowRelations, setSpeakAs, setStateReady, setStep, setWaking, setWorldModal, setWriteOpen, setWriteText, shareCurrentCharacter, sharedCharacters, sharedFocusId, sharedFollowers, sharedLoadState, shareStatus, shareStatusTimerRef, showMemory, showMemoryAdd, showPeerMem, showRecoveryScreen, showRelations, shuffled, signInWithProvider, signOut, sortedPosts, speakAs, speakerNameFor, stageLabelFor, startAutoChat, startNewCharacter, startRenameDm, stateReady, step, stopAutoChat, submitAuth, submitUserComment, switchAccount, SYMMETRIC_RELATION_BASE, symmetricRelationBaseFromLabel, syncActive, syncActiveSharedCharacter, syncOwnFollowRows, syncStructuredState, timeAgo, timelinePosts, toggleFollow, toggleFollowPanel, toggleLike, toggleMemoryPanel, toggleRelationsPanel, toneText, triggerProposal, update, updateLorebook, updateMemory, updateRecoveredPassword, updateRoomMemory, verifyMutualLove, visiblePosts, wakeCharacter, waking, wakingRef, warmthRate, withRejectTimeout, withTimeout, worldBridgeBlock, WorldChip, worldModal, writeOpen, writeText } = ctx;
  return (
    <div className="al-root">
      <style>{css}</style>

      {authBusy && (
        <AuthLoadingScreen
          authMessage={authMessage}
          onRetryCharacters={() => {
            setAuthMessage("캐릭터를 다시 불러오고 있어요.");
            setProfileLoading(true);
            setStateReady(false);
            setProfileLoadRetry((v) => v + 1);
          }}
        />
      )}

      {hasSupabaseConfig && !authLoading && !session && (
        <AuthEntryScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          authLoading={authLoading}
          authMessage={authMessage}
          setAuthMessage={setAuthMessage}
          submitAuth={submitAuth}
          sendMagicLoginLink={sendMagicLoginLink}
          sendPasswordReset={sendPasswordReset}
          signInWithProvider={signInWithProvider}
        />
      )}

      {canUseApp && step === "home" && (
        <HomeScreen
          accounts={accounts}
          buildMark={BUILD_MARK}
          deletePersona={deletePersona}
          editAccount={editAccount}
          hasSupabaseConfig={hasSupabaseConfig}
          personas={personas}
          profileName={profileName}
          saveStatus={saveStatus}
          session={session}
          setDeleteTarget={setDeleteTarget}
          setPersonaDraft={setPersonaDraft}
          signOut={signOut}
          startNewCharacter={startNewCharacter}
          switchAccount={switchAccount}
        />
      )}

      {canUseApp && step === "dump" && (
        <DumpScreen
          dump={dump}
          examples={EXAMPLES}
          parsing={parsing}
          parseDump={parseDump}
          rpLog={rpLog}
          setDump={setDump}
          setRpLog={setRpLog}
          setStep={setStep}
        />
      )}

      {}
      {canUseApp && step === "confirm" && (
        <ConfirmScreen
          activeId={activeId}
          char={char}
          confirmReady={confirmReady}
          parseError={parseError}
          parseFailed={parseFailed}
          parseRelations={parseRelations}
          saveCharacterEdits={saveCharacterEdits}
          setStep={setStep}
          update={update}
          wakeCharacter={wakeCharacter}
          waking={waking}
        />
      )}

      {}
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
      {canUseApp && step === "discover" && (
        <DiscoverScreen
          activeId={activeId}
          activeSharedId={activeSharedId}
          char={char}
          discoverPool={DISCOVER_POOL}
          discoverQuery={discoverQuery}
          following={following}
          hasSupabaseConfig={hasSupabaseConfig}
          isFollowing={isFollowing}
          loadSharedCharacters={loadSharedCharacters}
          publicFollowerCount={publicFollowerCount}
          requestDmEntry={requestDmEntry}
          session={session}
          setDiscoverQuery={setDiscoverQuery}
          setPublicProfile={setPublicProfile}
          setSharedFocusId={setSharedFocusId}
          setStep={setStep}
          sharedCharacters={sharedCharacters}
          sharedFocusId={sharedFocusId}
          sharedLoadState={sharedLoadState}
          toggleFollow={toggleFollow}
          WorldChip={(props) => <WorldChip {...props} onOpen={setWorldModal} />}
        />
      )}

      {canUseApp && step === "dmlist" && (
        <DmListScreen
          accounts={accounts}
          activeId={activeId}
          char={char}
          conversations={myConversations()}
          deleteDmThread={deleteDmThread}
          displayDmTitle={displayDmTitle}
          following={following}
          initial={initial}
          nameMatch={nameMatch}
          newChatMode={newChatMode}
          newChatSpeaker={newChatSpeaker}
          personas={personas}
          relationMatched={relationMatched}
          requestDmEntry={requestDmEntry}
          setNewChatMode={setNewChatMode}
          setNewChatSpeaker={setNewChatSpeaker}
          setPersonaDraft={setPersonaDraft}
          setStep={setStep}
          sharedCharacters={sharedCharacters}
          startRenameDm={startRenameDm}
        />
      )}

      {canUseApp && step === "dm" && peer && (() => {
        const peerName = peer.asOwner ? char.name : peer.name;
        const peerInitial = peerName.trim()[0] || "?";
        const showGauge = true;
        // 게이지 주체 = 현재 화자(내 캐릭터 or 유저 페르소나). 오너면 캐릭터로 폴백.
        const speakerName = (activePersona ? activePersona.name : char.name);
        const npcRoom = dmKey?.startsWith("local::");
        const dmKindLabel = peer.dmKind === "npc" ? "NPC 채팅 · 관계 미반영" : "공유 DM";
        const headSub = peer.asOwner
          ? "나(오너)로서 대화 중"
          : `${josa(speakerName, "으로/로")} 대화 중 · ${dmKindLabel}`;
        const roomTitle = dmThreadTitles[dmKey] || (peer.asOwner ? `${peerName} (내 캐릭터)` : peerName);
        const peerCharForAffinity = peer.asOwner ? char : (findPeerChar(peerName) || peer);
        const speakerToPeerRel = relationHintFor(speakerName, peerName, peer.relation || "");
        const peerToSpeakerRel = relationHintFor(peerName, speakerName, "", peerCharForAffinity);
        const mineToPeerRaw = npcRoom ? roomAffOf(dmKey, speakerName, peerName, speakerToPeerRel) : dmAffOf(speakerName, peerName, speakerToPeerRel);   // 화자 → 상대
        const peerToMineRaw = npcRoom ? roomAffOf(dmKey, peerName, speakerName, peerToSpeakerRel) : dmAffOf(peerName, speakerName, peerToSpeakerRel);   // 상대 → 화자
        const romanticPairBase = Math.max(
          symmetricRelationBaseFromLabel(speakerToPeerRel) || 0,
          symmetricRelationBaseFromLabel(peerToSpeakerRel) || 0,
        );
        const mineToPeer = romanticPairBase >= 90 ? Math.max(mineToPeerRaw, romanticPairBase) : mineToPeerRaw;
        const peerToMine = romanticPairBase >= 90 ? Math.max(peerToMineRaw, romanticPairBase) : peerToMineRaw;
        const ownerVal = npcRoom ? roomAffOf(dmKey, peerName, OWNER) : affOf(peerName, OWNER);           // 하루 → 나(오너)
        const mineToPeerStage = relationStageLabel(speakerToPeerRel, mineToPeer);
        const peerToMineStage = relationStageLabel(peerToSpeakerRel, peerToMine);
        const peerCharForMemory = findPeerChar(peerName);
        const roomMems = roomMemoryEntries(currentWorldPref, peerName, speakerName)
          .map((e) => ({ ...e, scope: "room" }));
        const globalMems = npcRoom ? [] : (peerCharForMemory?.lorebook || [])
          .filter((e) => e.peer === speakerName && !e.roomKey)
          .map((e) => ({ ...e, scope: "global" }));
        const visibleMems = [...roomMems, ...globalMems];
        return (
        <div className="al-phone">
          <div className="al-dmhead">
            <button className="al-back-inline" onClick={() => {
              // 방 나가며 세션 분위기 판정 (최근 발화 기준)
              const recentLines = dm.slice(-8).map((m) => ({ who: m.from, text: m.text }));
              if (peer.asOwner) judgeSession(OWNER, peerName, recentLines);
              else if (meName !== ownerLabel) {
                processSession(meName, peerName, recentLines, false, dmKey);
              }
              setStep("dmlist");
            }}>‹</button>
            <div className="al-dmhead-av">{peerInitial}</div>
            <div className="al-dmhead-info">
              <span className="al-dmhead-name">{roomTitle}</span>
              <span className="al-dmhead-sub">{headSub}</span>
            </div>
            {!peer.asOwner && (
              <div className="al-dm-head-actions">
                <button className="al-dm-settings-btn" onClick={openDmSettings}>세계관</button>
                <button className={`al-dm-settings-btn ${showPeerMem ? "on" : ""}`} onClick={() => setShowPeerMem((v) => !v)}>
                  기억 {visibleMems.length}
                </button>
              </div>
            )}
          </div>

          {showGauge && (
            <div className={`al-affinity ${peer.asOwner ? "owner" : ""}`}>
              <button className="al-aff-toggle" onClick={() => setAffinityOpen((v) => !v)}>
                <span>호감도</span>
                <b>{peer.asOwner ? `${attachStage(ownerVal)} · ${ownerVal}` : `${peerToMineStage} · ${peerToMine}`}</b>
                <i>{affinityOpen ? "접기" : "펼치기"}</i>
              </button>
              {affinityOpen && (
                <div className="al-aff-content">
                  {peer.asOwner && (
                    <>
                      <div className="al-aff-top">
                        <span className="al-aff-lbl">🤍 {peerName} → 나</span>
                        <span className="al-aff-stage">{attachStage(ownerVal)} · {ownerVal}</span>
                      </div>
                      <div className="al-aff-bar"><div className={`al-aff-fill ${ownerVal < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(ownerVal)}%` }} /></div>
                    </>
                  )}
                  {!peer.asOwner && activePersona && (
                    <>
                      <div className="al-aff-row">
                        <span className="al-aff-lbl rev">♥ {peerName} → {speakerName} <span className="al-aff-note">(가면이라 {speakerName}는 빠지지 않음)</span></span>
                        <span className="al-aff-stage">{peerToMineStage} · {peerToMine}</span>
                      </div>
                      <div className="al-aff-bar">
                        <div className={`al-aff-fill rev ${peerToMine < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(peerToMine)}%` }} />
                        <div className="al-aff-mark" style={{ left: `${PROPOSAL_THRESHOLD}%` }} />
                      </div>
                    </>
                  )}
                  {!peer.asOwner && !activePersona && (
                    <>
                      <div className="al-aff-row">
                        <span className="al-aff-lbl">♥ {speakerName} → {peerName}</span>
                        <span className="al-aff-stage">{mineToPeerStage} · {mineToPeer}</span>
                      </div>
                      <div className="al-aff-bar">
                        <div className={`al-aff-fill ${mineToPeer < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(mineToPeer)}%` }} />
                        <div className="al-aff-mark" style={{ left: `${PROPOSAL_THRESHOLD}%` }} title="고백 가능선" />
                      </div>
                      <div className="al-aff-row second">
                        <span className="al-aff-lbl rev">♥ {peerName} → {speakerName}</span>
                        <span className="al-aff-stage">{peerToMineStage} · {peerToMine}</span>
                      </div>
                      <div className="al-aff-bar">
                        <div className={`al-aff-fill rev ${peerToMine < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(peerToMine)}%` }} />
                        <div className="al-aff-mark" style={{ left: `${PROPOSAL_THRESHOLD}%` }} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {(() => {
            if (!showPeerMem) return null;
            return (
              <div className="al-peermem">
                <div className="al-peermem-list">
                  {visibleMems.length === 0 ? (
                    <div className="al-peermem-item muted">아직 이 DM방에 남은 장기기억이 없어.</div>
                  ) : visibleMems.slice(-8).reverse().map((e) => {
                    const editing = editingMemoryId === `${e.scope}:${e.id}`;
                    return (
                      <div className="al-peermem-item" key={`${e.scope}-${e.id}`}>
                        <div className="al-peermem-top">
                          <span>{e.scope === "room" ? "이 방" : "전역"}</span>
                          <div>
                            <button onClick={() => setEditingMemoryId(editing ? null : `${e.scope}:${e.id}`)}>{editing ? "닫기" : "수정"}</button>
                            <button className="danger" onClick={() => e.scope === "room" ? deleteRoomMemory(dmKey, peerName, e.id) : deleteMemory(e.id)}>삭제</button>
                          </div>
                        </div>
                        {editing ? (
                          <div className="al-peermem-edit">
                            <textarea value={e.content} onChange={(ev) => e.scope === "room"
                              ? updateRoomMemory(dmKey, peerName, e.id, { content: ev.target.value })
                              : editMemory(e.id, ev.target.value)} />
                          </div>
                        ) : (
                          <p>· {e.content}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="al-dmscroll">
            {dm.length === 0 && (
              <div className="al-dm-empty">
                <p>{peer.asOwner ? `${josa(peerName, "에게/에게")} 나(오너)로서 말을 걸어봐.` : `${josa(peerName, "에게/에게")} ${josa(speakerName, "으로/로")} 말을 걸어봐.`}</p>
              </div>
            )}
            {dm.map((m, i) => {
              const fromPeer = m.from === peerName;   // 상대가 보낸 것만 왼쪽
              const mine = !fromPeer;
              const showLabel = mine && m.from !== (char.name || "나"); // 내 쪽인데 하루가 아니면(=오너) 라벨
              const canFixDmLine = fromPeer && peer.asOwner && m.from === char.name;
              return (
                <div key={i} className={`al-bubble-row ${mine ? "me" : "char"}`}>
                  {fromPeer && <div className="al-bubble-av">{peerInitial}</div>}
                  <div className={`al-bubble ${mine ? "me" : "char"}`}>
                    {showLabel && <span className="al-bubble-spk">{m.from}</span>}
                    {m.img && <img className="al-bubble-img" src={m.img} alt="" />}
                    {m.text && !(m.img && m.text === "(사진)") && <span className="al-bubble-text">{m.text}</span>}
                    {canFixDmLine && (
                      <button className="al-fixbtn-dm" onClick={() => { setFixTarget({ type: "dm", index: i, text: m.text, who: m.from }); setFixText(""); }}>⚠ 캐해 아님</button>
                    )}
                  </div>
                </div>
              );
            })}
            {dmSending && (
              <div className="al-bubble-row char">
                <div className="al-bubble-av">{peerInitial}</div>
                <div className="al-bubble char typing"><span className="al-typing"><i/><i/><i/></span></div>
              </div>
            )}
            <div ref={dmEndRef} />
          </div>

          {/* ── 오너↔내캐릭터 방: 화자는 항상 나(오너). 페르소나만. ── */}
          {peer.asOwner && (
            <div className="al-dmctrl">
              <input className="al-owner-persona" value={ownerPersona} onChange={(e) => setOwnerPersona(e.target.value)}
                placeholder="나(오너) 페르소나 — 한 줄 (선택, 저장됨)" />
            </div>
          )}

          {/* ── 다른 캐릭터와의 방: 기본=하루, 자동대화 + 끼어들기 ── */}
          {!peer.asOwner && (
            <div className="al-autochat">
              <div className="al-chatmode">
                <span className="al-ctrl-lbl">자동 대화 방식:</span>
                <button className={chatMode === "talk" ? "on" : ""} onClick={() => setChatMode("talk")}>대화</button>
                <button className={chatMode === "novel" ? "on" : ""} onClick={() => setChatMode("novel")}>소설(묘사)</button>
              </div>
              {!autoChatting ? (
                <button className="al-autochat-go" onClick={startAutoChat} disabled={dmSending}>
                  ⟳ {speakerName} ↔ {peer.name} 자동 대화 (천천히)
                </button>
              ) : (
                <button className="al-autochat-stop" onClick={stopAutoChat}>
                  ■ 멈추기 <span className="al-autochat-live">● LIVE — 입력하면 {speakerName}로 끼어들기</span>
                </button>
              )}
            </div>
          )}

          {/* ── 화자 선택: 어떤 상대든(오너방 제외) 항상 노출 ── */}
          {!peer.asOwner && (
            <div className="al-speaker-wrap">
              <div className="al-speaker-sel">
                <span className="al-ctrl-lbl">말하는 나:</span>
                <button className={`al-spk-chip ${speakAs === "char" ? "on" : ""}`} onClick={() => setSpeakAs("char")}>{char.name}</button>
                <button className={`al-spk-chip ${speakAs === "owner" ? "on" : ""}`} onClick={() => setSpeakAs("owner")}>🙋 나(오너)</button>
                {personas.map((p) => (
                  <button key={p.id} className={`al-spk-chip persona ${speakAs === `p:${p.id}` ? "on" : ""}`}
                    onClick={() => setSpeakAs(`p:${p.id}`)}>🎭 {p.name}</button>
                ))}
                <button className="al-spk-chip add" onClick={() => { setPersonaDraft({ name: "", age: "", persona: "", speech: "" }); }}>+ 페르소나</button>
              </div>
              {speakAs === "owner" && (
                <input className="al-owner-persona" value={ownerPersona} onChange={(e) => setOwnerPersona(e.target.value)}
                  placeholder="나(오너) 페르소나 — 한 줄 (선택)" />
              )}
              {activePersona && (
                <div className="al-persona-active">🎭 {activePersona.name}(으)로 대화 중 · {activePersona.persona?.slice(0, 30)}</div>
              )}
            </div>
          )}

          {dmImageDraft && (
            <div className="al-dm-preview">
              <img src={dmImageDraft} alt="" />
              <button type="button" onClick={() => setDmImageDraft(null)}>×</button>
            </div>
          )}

          <div className="al-dminput">
            <label className="al-dm-image-btn" title="사진 보내기">
              +
              <input type="file" accept="image/*" onChange={handleDmImage} />
            </label>
            <input value={dmInput} onChange={(e) => setDmInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendDM(); }}
              placeholder={autoChatting ? `끼어들기: ${meName}(으)로 입력…` : `${meName}(으)로 메시지…`} />
            <button onClick={sendDM} disabled={(!dmInput.trim() && !dmImageDraft) || dmSending}>↑</button>
          </div>
        </div>
        );
      })()}

      {canUseApp && editingDmTitle && (
        <div className="al-modal-bg" onClick={() => setEditingDmTitle(null)}>
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">채팅방 이름 수정</h3>
            <p className="al-modal-sub">비워두면 기본 이름으로 돌아가.</p>
            <input className="al-pd-input" value={editingDmTitle.title}
              onChange={(e) => setEditingDmTitle((v) => ({ ...v, title: e.target.value }))}
              placeholder="채팅방 이름" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) saveRenameDm(); }} />
            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setEditingDmTitle(null)}>취소</button>
              <button className="al-modal-save" onClick={saveRenameDm}>저장</button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && onboardingOpen && (
        <div className="al-modal-bg">
          <div className="al-modal al-onboard" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">처음 왔구나</h3>
            <p className="al-modal-sub">저장에 쓸 이름만 정하면 바로 캐릭터를 만들 수 있어.</p>
            <input className="al-pd-input" value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="내 이름 또는 닉네임" autoFocus />
            <div className="al-pd-btns">
              <button className="al-pd-save" onClick={completeOnboarding}>
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && passwordRecoveryOpen && (
        <div className="al-modal-bg">
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">새 비밀번호 설정</h3>
            <p className="al-modal-sub">메일 링크 확인이 끝났어. 앞으로 쓸 비밀번호를 새로 정해줘.</p>
            <input className="al-pd-input" type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 6자 이상"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) updateRecoveredPassword(); }} />
            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setPasswordRecoveryOpen(false)}>나중에</button>
              <button className="al-modal-save" disabled={newPassword.length < 6 || authLoading} onClick={updateRecoveredPassword}>저장</button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && deleteTarget && (
        <div className="al-modal-bg" onClick={() => setDeleteTarget(null)}>
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">캐릭터 삭제</h3>
            <p className="al-modal-sub">
              {deleteTarget.char?.name || "이 캐릭터"}를 삭제할까요? 피드, 그림, 팔로잉까지 이 계정 저장값에서 함께 지워져.
            </p>
            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="al-modal-danger" onClick={confirmDeleteCharacter}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && publicProfile && (
        <div className="al-modal-bg" onClick={() => setPublicProfile(null)}>
          <div className="al-public-profile" onClick={(e) => e.stopPropagation()}>
            <button className="al-public-back" onClick={() => setPublicProfile(null)}>‹</button>
            <div className="al-public-banner">
              {publicProfile.headerImg && <img src={publicProfile.headerImg} alt="" />}
            </div>
            <div className="al-public-avatar">
              {publicProfile.avatarImg ? <img src={publicProfile.avatarImg} alt="" /> : (publicProfile.name?.trim()[0] || "?")}
            </div>
            <div className="al-public-body">
              <div className="al-public-main">
                <div className="al-name-line">
                  <h3>{publicProfile.name}</h3>
                  <WorldChip character={publicProfile} fallback="public-profile" onOpen={setWorldModal} />
                </div>
                <span>@{publicProfile.handle || publicProfile.name?.replace(/\s/g, "").toLowerCase()}</span>
              </div>
              <p className="al-public-age">{publicProfile.age || "설정 비공개"}</p>
              {publicProfile.surface && <span className="al-public-tag">{publicProfile.surface}</span>}
              <div className="al-public-stats">
                <b>{publicFollowingCount(publicProfile)}</b> 팔로잉
                <b>{publicFollowerCount(publicProfile).toLocaleString()}</b> 팔로워
              </div>
              <div className="al-public-actions">
                <button className="al-public-dm" onClick={() => {
                  setPublicProfile(null);
                  requestDmEntry(publicProfile, "char");
                }}>
                  ✉ 바로 DM
                </button>
                <button className={`al-public-follow ${isFollowing(publicProfile.id) ? "on" : ""}`} onClick={() => toggleFollow(publicProfile)}>
                  {isFollowing(publicProfile.id) ? "팔로잉 취소" : "+ 팔로우"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canUseApp && worldModal && (
        <div className="al-modal-bg" onClick={() => setWorldModal(null)}>
          <div className="al-world-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="al-world-view-head">
              <div>
                <h3>{worldModal.name}의 세계관</h3>
                {worldModal.handle && <span>@{worldModal.handle}</span>}
              </div>
              <button onClick={() => setWorldModal(null)}>닫기</button>
            </div>
            <p>{worldModal.world}</p>
          </div>
        </div>
      )}

      {canUseApp && followPanel && !publicProfile && (
        <div className="al-modal-bg" onClick={() => setFollowPanel(null)}>
          <div className="al-follow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="al-follow-modal-head">
              <h3>{followPanel === "following" ? "팔로잉" : "팔로워"}</h3>
              <button onClick={() => setFollowPanel(null)}>닫기</button>
            </div>
            {(() => {
              const list = followPanel === "following" ? following : (activeSharedId ? sharedFollowers.rows : myFollowers());
              if (followPanel === "followers" && activeSharedId && sharedFollowers.loading) {
                return <p className="al-follow-empty">팔로워 불러오는 중...</p>;
              }
              if (followPanel === "followers" && activeSharedId && sharedFollowers.error) {
                return <p className="al-follow-empty">팔로워 로딩 실패: {sharedFollowers.error}</p>;
              }
              return list.length === 0 ? (
                <p className="al-follow-empty">{followPanel === "following" ? "아직 팔로우한 캐릭터가 없어." : "아직 팔로워가 없어."}</p>
              ) : (
                <div className="al-follow-modal-list">
                  {list.map((f) => (
                    <div key={f.id} className="al-follow-modal-row">
                      <div className="al-follow-modal-item">
                        <button className="al-follow-modal-main" onClick={() => setPublicProfile(f)}>
                          <span className="al-follow-modal-av">{f.name.trim()[0] || "?"}</span>
                          <span className="al-follow-modal-info">
                            <b>{f.name}</b>
                            <small>@{f.handle || f.name.replace(/\s/g, "").toLowerCase()} · {f.owner || "공유 캐릭터"}</small>
                          </span>
                        </button>
                        <WorldChip character={f} fallback={`follow-${f.id}`} onOpen={setWorldModal} />
                        <i>{followPanel === "followers" ? "팔로워" : (isFollowing(f.id) ? "팔로잉" : "보기")}</i>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {canUseApp && pendingDm && (
        <div className="al-modal-bg" onClick={() => setPendingDm(null)}>
          <div className="al-world-modal" onClick={(e) => e.stopPropagation()}>
            {(!pendingDm.mode || pendingDm.stage === "world") ? (
              <>
                <h3>어느 세계관으로 들어갈까?</h3>
                <p>{pendingDm.peer.name}와의 DM에서 장면 기준을 정해줘. 캐릭터 정체성은 유지돼.</p>
                <div className="al-world-options">
                  <button onClick={() => chooseDmWorldMode("their")}>
                    <b>상대 세계관</b>
                    <span>{pendingDm.peer.name}의 세계로 들어가기</span>
                  </button>
                  <button onClick={() => chooseDmWorldMode("mine")}>
                    <b>내 세계관</b>
                    <span>{char.name || "내 캐릭터"}의 세계로 데려오기</span>
                  </button>
                  <button onClick={() => chooseDmWorldMode("bridge")}>
                    <b>중간다리</b>
                    <span>ALIVE DM/공유 타임라인에서 만나기</span>
                  </button>
                </div>
              </>
            ) : pendingDm.stage === "chatKind" ? (
              <>
                <h3>어떤 채팅방으로 만들까?</h3>
                <p>이 선택에 따라 저장 위치가 달라져. NPC 채팅은 내 계정 전용, 공유 DM은 상대 오너와 같은 방을 봐.</p>
                <div className="al-world-options">
                  <button onClick={() => finishDmChatKind("npc")}>
                    <b>NPC처럼 대화</b>
                    <span>{pendingDm.peer.name}을 AI 캐릭터로 굴리는 내 전용 방</span>
                  </button>
                  <button onClick={() => finishDmChatKind("shared")}>
                    <b>상대 오너와 DM 공유</b>
                    <span>상대 계정에서도 같은 대화가 보이는 공용 방</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>설정을 조금 다듬을까요?</h3>
                <p>이 DM방에서만 적용돼. 예: 상대 세계관에 들어온 이유, 복장, 능력 제한, 처음 만난 장소.</p>
                <textarea className="al-world-note" value={dmWorldDraft} onChange={(e) => setDmWorldDraft(e.target.value)}
                  placeholder="예: 리안은 해군 기지 근처에 잘못 떨어졌다. 마법은 약하게만 쓸 수 있다." />
                <div className="al-world-actions">
                  <button onClick={() => finishDmWorldSetup(true)}>그대로 시작</button>
                  <button className="primary" onClick={() => finishDmWorldSetup(false)}>다듬고 시작</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {canUseApp && dmSettingsOpen && peer && (
        <div className="al-modal-bg" onClick={() => setDmSettingsOpen(false)}>
          <div className="al-world-modal" onClick={(e) => e.stopPropagation()}>
            <h3>이 DM방 세계관 설정</h3>
            <p>이 설정은 지금 대화방에만 적용돼. 바꾸면 다음 답장부터 반영돼.</p>
            <div className="al-world-options compact">
              <button className={dmPrefDraft.mode === "their" ? "on" : ""} onClick={() => setDmPrefDraft((p) => ({ ...p, mode: "their" }))}>
                <b>상대 세계관</b>
                <span>{peer.name}의 세계로 들어가기</span>
              </button>
              <button className={dmPrefDraft.mode === "mine" ? "on" : ""} onClick={() => setDmPrefDraft((p) => ({ ...p, mode: "mine" }))}>
                <b>내 세계관</b>
                <span>{char.name || "내 캐릭터"}의 세계로 데려오기</span>
              </button>
              <button className={dmPrefDraft.mode === "bridge" ? "on" : ""} onClick={() => setDmPrefDraft((p) => ({ ...p, mode: "bridge" }))}>
                <b>중간다리</b>
                <span>ALIVE DM/공유 타임라인</span>
              </button>
            </div>
            <textarea className="al-world-note" value={dmPrefDraft.note}
              onChange={(e) => setDmPrefDraft((p) => ({ ...p, note: e.target.value }))}
              placeholder="이 방에서만 적용할 보정. 예: 능력 제한, 처음 만난 장소, 들어온 이유." />
            <div className="al-world-actions">
              <button onClick={() => setDmSettingsOpen(false)}>취소</button>
              <button className="primary" onClick={saveDmSettings}>저장</button>
            </div>
          </div>
        </div>
      )}

      {canUseApp && personaDraft && (
        <div className="al-modal-bg" onClick={() => setPersonaDraft(null)}>
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">🎭 {personaDraft.id ? "페르소나 수정" : "새 페르소나"}</h3>
            <p className="al-modal-sub">캐릭터에게 다가갈 또 다른 나. 캐릭터처럼 호감도·관계가 따로 쌓여.</p>
            <input className="al-pd-input" placeholder="이름" value={personaDraft.name}
              onChange={(e) => setPersonaDraft({ ...personaDraft, name: e.target.value })} />
            <input className="al-pd-input" placeholder="나이·한 줄 설정 (예: 24, 떠돌이 사진가)" value={personaDraft.age}
              onChange={(e) => setPersonaDraft({ ...personaDraft, age: e.target.value })} />
            <textarea className="al-pd-input area" placeholder="성격·배경 (어떤 사람인지)" value={personaDraft.persona}
              onChange={(e) => setPersonaDraft({ ...personaDraft, persona: e.target.value })} />
            <input className="al-pd-input" placeholder="말투 (예: 나른한 반말, 존댓말…)" value={personaDraft.speech}
              onChange={(e) => setPersonaDraft({ ...personaDraft, speech: e.target.value })} />
            <div className="al-pd-btns">
              {personaDraft.id && (
                <button className="al-pd-del" onClick={() => {
                  deletePersona(personaDraft.id);
                  setPersonaDraft(null);
                }}>삭제</button>
              )}
              <button className="al-pd-cancel" onClick={() => setPersonaDraft(null)}>취소</button>
              <button className="al-pd-save" disabled={!personaDraft.name.trim()} onClick={() => {
                if (personaDraft.id) {
                  setPersonas((ps) => ps.map((p) => p.id === personaDraft.id ? { ...personaDraft } : p));
                } else {
                  const np = { ...personaDraft, id: Date.now() };
                  setPersonas((ps) => [...ps, np]);
                  if (peer) setSpeakAs(`p:${np.id}`); // DM이면 만들자마자 그 페르소나로
                  if (commentOn) setCommentAs(`p:${np.id}`); // 댓글 작성 중이면 그 화자로
                }
                setPersonaDraft(null);
              }}>저장</button>
            </div>
          </div>
        </div>
      )}

      <ProposalModal proposal={proposal} onResolve={resolveProposal} />

      <RelationResultModal relationResult={relationResult} onClose={() => setRelationResult(null)} />

      {fixTarget && (
        <div className="al-modal-bg" onClick={() => setFixTarget(null)}>
          <div className="al-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="al-modal-title">캐해 바로잡기</h3>
            <p className="al-modal-sub">뭐가 {fixTarget.who || char.name}답지 않았어? 알려주면 다음부턴 안 그래.</p>
            <div className="al-modal-quote">"{fixTarget.text.slice(0, 60)}{fixTarget.text.length > 60 ? "…" : ""}"</div>

            <div className="al-fixchips">
              {QUICK_FIXES.map((q) => (
                <button key={q} className="al-fixchip"
                  onClick={() => setFixText((t) => t ? `${t}, ${q}` : q)}>{q}</button>
              ))}
            </div>
            <textarea className="al-fixinput" value={fixText} onChange={(e) => setFixText(e.target.value)}
              placeholder={`예: 얘는 이럴 때 더 무심하게 말해. 느낌표 안 씀.`} />

            <div className="al-modal-actions">
              <button className="al-modal-cancel" onClick={() => setFixTarget(null)}>취소</button>
              <button className="al-modal-saveonly" disabled={!fixText.trim()}
                onClick={() => { addCorrection(fixText, fixTarget.who); setFixTarget(null); }}>교정만</button>
              <button className="al-modal-save" disabled={!fixText.trim()}
                onClick={() => {
                  addCorrection(fixText, fixTarget.who);
                  if (fixTarget.type === "post") {
                    setPosts((p) => p.filter((x) => x.id !== fixTarget.id));
                  } else {
                    setDmThread((d) => d.filter((_, idx) => idx !== fixTarget.index));
                  }
                  setFixTarget(null);
                }}>교정+지우기</button>
            </div>
            {(char.corrections || []).length > 0 && (
              <p className="al-fixcount">지금까지 교정 {(char.corrections || []).length}개 — 다음 생성부터 반영돼</p>
            )}
          </div>
        </div>
      )}

      {showRecoveryScreen && (
        <RecoveryScreen
          authMessage={authMessage}
          onHome={() => { setPeer(null); setStep("home"); setStateReady(true); }}
          onRecoverAuth={recoverAuthScreen}
        />
      )}

      <p className="al-footer">ALIVE · prototype</p>
    </div>
  );
}
