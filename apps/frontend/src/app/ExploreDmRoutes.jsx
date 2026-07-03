import React from "react";

export function ExploreDmRoutes({ ctx }) {
  const {
    accounts,
    activeId,
    activePersona,
    activeSharedId,
    affinity,
    affinityOpen,
    affOf,
    attachStage,
    autoChatting,
    canUseApp,
    char,
    chatMode,
    currentWorldPref,
    deleteDmThread,
    deleteMemory,
    deleteRoomMemory,
    DISCOVER_POOL,
    discoverQuery,
    DiscoverScreen,
    displayDmTitle,
    dm,
    dmAffOf,
    dmEndRef,
    dmImageDraft,
    dmInput,
    dmKey,
    DmListScreen,
    dmSending,
    dmThreadTitles,
    editingMemoryId,
    editMemory,
    findPeerChar,
    following,
    handleDmImage,
    hasSupabaseConfig,
    initial,
    isFollowing,
    josa,
    judgeSession,
    loadSharedCharacters,
    meName,
    myConversations,
    nameMatch,
    newChatMode,
    newChatSpeaker,
    openDmSettings,
    OWNER,
    ownerLabel,
    ownerPersona,
    peer,
    personas,
    processSession,
    PROPOSAL_THRESHOLD,
    publicFollowerCount,
    relationMatched,
    relationHintFor,
    relationStageLabel,
    requestDmEntry,
    roomAffOf,
    roomMemoryEntries,
    sendDM,
    session,
    setAffinityOpen,
    setChatMode,
    setDiscoverQuery,
    setDmImageDraft,
    setDmInput,
    setEditingMemoryId,
    setFixTarget,
    setFixText,
    setNewChatMode,
    setNewChatSpeaker,
    setOwnerPersona,
    setPersonaDraft,
    setPublicProfile,
    setSharedFocusId,
    setShowPeerMem,
    setSpeakAs,
    setStep,
    setWorldModal,
    sharedCharacters,
    sharedFocusId,
    sharedLoadState,
    showPeerMem,
    speakAs,
    startAutoChat,
    startRenameDm,
    step,
    stopAutoChat,
    symmetricRelationBaseFromLabel,
    toggleFollow,
    updateRoomMemory,
    WorldChip,
  } = ctx;
  return (
    <>
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
    </>
  );
}
