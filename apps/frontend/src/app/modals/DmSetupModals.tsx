import React from "react";

const WORLD_OPTION_CLASS = "border-line bg-surface-sunken text-ink hover:border-accent hover:bg-accent-soft";
const WORLD_NOTE_CLASS = "al-world-note border-line bg-surface-raised text-ink placeholder:text-faint focus:border-accent";
const SECONDARY_ACTION_CLASS = "border-line-strong bg-surface-raised text-soft hover:bg-surface-muted hover:text-ink";
const PRIMARY_ACTION_CLASS = "primary border-accent bg-accent text-on-accent hover:bg-accent-strong";

function worldOptionClass(active: boolean): string {
  return active ? `${WORLD_OPTION_CLASS} on border-accent bg-accent-soft` : WORLD_OPTION_CLASS;
}

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
        <div className="al-modal-bg al-theme-ready al-dm-setup-modal-theme-ready" onClick={() => setPendingDm(null)}>
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
        <div className="al-modal-bg al-theme-ready al-dm-setup-modal-theme-ready" onClick={() => setDmSettingsOpen(false)}>
          <div className="al-world-modal" onClick={(event) => event.stopPropagation()}>
            <h3>이 대화의 장면 설정</h3>
            <p>두 캐릭터가 어디에서 만나는지 정해요. 다음 답장부터 반영됩니다.</p>
            <div className="al-world-options compact">
              <button className={worldOptionClass(dmPrefDraft.mode === "their")} onClick={() => setDmPrefDraft((value) => ({ ...value, mode: "their" }))}><b>{peer.name}의 이야기 속</b><span>상대 캐릭터가 살던 장소에서 만나요.</span></button>
              <button className={worldOptionClass(dmPrefDraft.mode === "mine")} onClick={() => setDmPrefDraft((value) => ({ ...value, mode: "mine" }))}><b>{char.name || "내 캐릭터"}의 이야기 속</b><span>내 캐릭터가 살던 장소에서 만나요.</span></button>
              <button className={worldOptionClass(dmPrefDraft.mode === "bridge")} onClick={() => setDmPrefDraft((value) => ({ ...value, mode: "bridge" }))}><b>둘만의 중립 공간</b><span>서로의 설정을 바꾸지 않고 만나요.</span></button>
            </div>
            <textarea className={WORLD_NOTE_CLASS} value={dmPrefDraft.note} onChange={(event) => setDmPrefDraft((value) => ({ ...value, note: event.target.value }))} placeholder="이 방에서만 적용할 보정. 예: 능력 제한, 처음 만난 장소, 들어온 이유." />
            <div className="al-world-actions">
              <button className={SECONDARY_ACTION_CLASS} onClick={() => setDmSettingsOpen(false)}>취소</button>
              <button className={PRIMARY_ACTION_CLASS} onClick={saveDmSettings}>저장</button>
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
      <h3>어디에서 만나게 할까요?</h3>
      <p>장소만 고르면 두 캐릭터의 성격과 기억은 그대로 유지돼요.</p>
      <div className="al-world-options">
        <button className={WORLD_OPTION_CLASS} onClick={() => chooseDmWorldMode("their")}><b>{pendingDm.peer.name}의 이야기 속</b><span>상대 캐릭터가 살던 장소에서 만나요.</span></button>
        <button className={WORLD_OPTION_CLASS} onClick={() => chooseDmWorldMode("mine")}><b>{char.name || "내 캐릭터"}의 이야기 속</b><span>내 캐릭터가 살던 장소에서 만나요.</span></button>
        <button className={WORLD_OPTION_CLASS} onClick={() => chooseDmWorldMode("bridge")}><b>둘만의 중립 공간</b><span>서로의 설정을 바꾸지 않고 만나요.</span></button>
      </div>
    </>
  );
}

function ChatKindStep({ finishDmChatKind, pendingDm }) {
  return (
    <>
      <h3>이 대화를 누구와 공유할까요?</h3>
      <p>대화 내용이 나에게만 보일지, 상대 사용자에게도 보일지 선택하세요.</p>
      <div className="al-world-options">
        <button className={WORLD_OPTION_CLASS} onClick={() => finishDmChatKind("npc")}><b>나만 보는 대화</b><span>상대 사용자에게 보이지 않는 개인 대화예요.</span></button>
        <button className={WORLD_OPTION_CLASS} onClick={() => finishDmChatKind("shared")}><b>상대와 함께 보는 대화</b><span>상대 사용자도 같은 대화를 볼 수 있어요.</span></button>
      </div>
    </>
  );
}

function WorldNoteStep({ dmWorldDraft, finishDmWorldSetup, setDmWorldDraft }) {
  return (
    <>
      <h3>첫 장면을 더할까요?</h3>
      <p>선택 사항이에요. 처음 만난 장소나 이유가 떠오르면 한 줄만 적어주세요.</p>
      <textarea className={WORLD_NOTE_CLASS} value={dmWorldDraft} onChange={(event) => setDmWorldDraft(event.target.value)} placeholder="예: 리안은 해군 기지 근처에 잘못 떨어졌다. 마법은 약하게만 쓸 수 있다." />
      <div className="al-world-actions">
        <button className={SECONDARY_ACTION_CLASS} onClick={() => finishDmWorldSetup(true)}>그대로 시작</button>
        <button className={PRIMARY_ACTION_CLASS} onClick={() => finishDmWorldSetup(false)}>다듬고 시작</button>
      </div>
    </>
  );
}
