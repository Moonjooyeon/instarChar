import React from "react";

export function AppModals({ ctx }) {
  const {
    activeSharedId,
    addCorrection,
    authLoading,
    authMessage,
    canUseApp,
    char,
    chooseDmWorldMode,
    commentOn,
    completeOnboarding,
    confirmDeleteCharacter,
    deletePersona,
    deleteTarget,
    dm,
    dmPrefDraft,
    dmSettingsOpen,
    dmWorldDraft,
    editingDmTitle,
    finishDmChatKind,
    finishDmWorldSetup,
    fixTarget,
    fixText,
    following,
    followPanel,
    isFollowing,
    loading,
    myFollowers,
    newPassword,
    onboardingOpen,
    passwordRecoveryOpen,
    peer,
    pendingDm,
    personaDraft,
    profileName,
    proposal,
    ProposalModal,
    publicFollowerCount,
    publicFollowingCount,
    publicProfile,
    QUICK_FIXES,
    recoverAuthScreen,
    RecoveryScreen,
    relationResult,
    RelationResultModal,
    requestDmEntry,
    resolveProposal,
    saveDmSettings,
    saveRenameDm,
    setCommentAs,
    setDeleteTarget,
    setDmPrefDraft,
    setDmSettingsOpen,
    setDmThread,
    setDmWorldDraft,
    setEditingDmTitle,
    setFixTarget,
    setFixText,
    setFollowPanel,
    setNewPassword,
    setPasswordRecoveryOpen,
    setPeer,
    setPendingDm,
    setPersonaDraft,
    setPersonas,
    setPosts,
    setProfileName,
    setPublicProfile,
    setRelationResult,
    setSpeakAs,
    setStateReady,
    setStep,
    setWorldModal,
    sharedFollowers,
    showRecoveryScreen,
    toggleFollow,
    updateRecoveredPassword,
    WorldChip,
    worldModal,
  } = ctx;
  return (
    <>
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
    </>
  );
}
