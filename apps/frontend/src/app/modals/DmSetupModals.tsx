import React from "react";

export function DmSetupModals({ ctx }) {
  const {
    canUseApp,
    char,
    chooseDmWorldMode,
    dmPrefDraft,
    dmSettingsOpen,
    dmWorldDraft,
    finishDmChatKind,
    finishDmWorldSetup,
    peer,
    pendingDm,
    saveDmSettings,
    setDmPrefDraft,
    setDmSettingsOpen,
    setDmWorldDraft,
    setPendingDm,
  } = ctx;
  return (
    <>
      {canUseApp && pendingDm && (
        <div className="al-modal-bg" onClick={() => setPendingDm(null)}>
          <div className="al-world-modal" onClick={(event) => event.stopPropagation()}>
            {(!pendingDm.mode || pendingDm.stage === "world") ? (
              <WorldModeStep char={char} chooseDmWorldMode={chooseDmWorldMode} pendingDm={pendingDm} />
            ) : pendingDm.stage === "chatKind" ? (
              <ChatKindStep finishDmChatKind={finishDmChatKind} pendingDm={pendingDm} />
            ) : (
              <WorldNoteStep dmWorldDraft={dmWorldDraft} finishDmWorldSetup={finishDmWorldSetup} setDmWorldDraft={setDmWorldDraft} />
            )}
          </div>
        </div>
      )}
      {canUseApp && dmSettingsOpen && peer && (
        <div className="al-modal-bg" onClick={() => setDmSettingsOpen(false)}>
          <div className="al-world-modal" onClick={(event) => event.stopPropagation()}>
            <h3>이 DM방 세계관 설정</h3>
            <p>이 설정은 지금 대화방에만 적용돼. 바꾸면 다음 답장부터 반영돼.</p>
            <div className="al-world-options compact">
              <button className={dmPrefDraft.mode === "their" ? "on" : ""} onClick={() => setDmPrefDraft((value) => ({ ...value, mode: "their" }))}><b>상대 세계관</b><span>{peer.name}의 세계로 들어가기</span></button>
              <button className={dmPrefDraft.mode === "mine" ? "on" : ""} onClick={() => setDmPrefDraft((value) => ({ ...value, mode: "mine" }))}><b>내 세계관</b><span>{char.name || "내 캐릭터"}의 세계로 데려오기</span></button>
              <button className={dmPrefDraft.mode === "bridge" ? "on" : ""} onClick={() => setDmPrefDraft((value) => ({ ...value, mode: "bridge" }))}><b>중간다리</b><span>ALIVE DM/공유 타임라인</span></button>
            </div>
            <textarea className="al-world-note" value={dmPrefDraft.note} onChange={(event) => setDmPrefDraft((value) => ({ ...value, note: event.target.value }))} placeholder="이 방에서만 적용할 보정. 예: 능력 제한, 처음 만난 장소, 들어온 이유." />
            <div className="al-world-actions">
              <button onClick={() => setDmSettingsOpen(false)}>취소</button>
              <button className="primary" onClick={saveDmSettings}>저장</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WorldModeStep({ char, chooseDmWorldMode, pendingDm }) {
  return (
    <>
      <h3>어느 세계관으로 들어갈까?</h3>
      <p>{pendingDm.peer.name}와의 DM에서 장면 기준을 정해줘. 캐릭터 정체성은 유지돼.</p>
      <div className="al-world-options">
        <button onClick={() => chooseDmWorldMode("their")}><b>상대 세계관</b><span>{pendingDm.peer.name}의 세계로 들어가기</span></button>
        <button onClick={() => chooseDmWorldMode("mine")}><b>내 세계관</b><span>{char.name || "내 캐릭터"}의 세계로 데려오기</span></button>
        <button onClick={() => chooseDmWorldMode("bridge")}><b>중간다리</b><span>ALIVE DM/공유 타임라인에서 만나기</span></button>
      </div>
    </>
  );
}

function ChatKindStep({ finishDmChatKind, pendingDm }) {
  return (
    <>
      <h3>어떤 채팅방으로 만들까?</h3>
      <p>이 선택에 따라 저장 위치가 달라져. NPC 채팅은 내 계정 전용, 공유 DM은 상대 오너와 같은 방을 봐.</p>
      <div className="al-world-options">
        <button onClick={() => finishDmChatKind("npc")}><b>NPC처럼 대화</b><span>{pendingDm.peer.name}을 AI 캐릭터로 굴리는 내 전용 방</span></button>
        <button onClick={() => finishDmChatKind("shared")}><b>상대 오너와 DM 공유</b><span>상대 계정에서도 같은 대화가 보이는 공용 방</span></button>
      </div>
    </>
  );
}

function WorldNoteStep({ dmWorldDraft, finishDmWorldSetup, setDmWorldDraft }) {
  return (
    <>
      <h3>설정을 조금 다듬을까요?</h3>
      <p>이 DM방에서만 적용돼. 예: 상대 세계관에 들어온 이유, 복장, 능력 제한, 처음 만난 장소.</p>
      <textarea className="al-world-note" value={dmWorldDraft} onChange={(event) => setDmWorldDraft(event.target.value)} placeholder="예: 리안은 해군 기지 근처에 잘못 떨어졌다. 마법은 약하게만 쓸 수 있다." />
      <div className="al-world-actions">
        <button onClick={() => finishDmWorldSetup(true)}>그대로 시작</button>
        <button className="primary" onClick={() => finishDmWorldSetup(false)}>다듬고 시작</button>
      </div>
    </>
  );
}
