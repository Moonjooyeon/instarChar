import React from "react";

export function DmListScreen({
  accounts,
  activeId,
  char,
  conversations,
  deleteDmThread,
  displayDmTitle,
  following,
  initial,
  nameMatch,
  newChatMode,
  newChatSpeaker,
  personas,
  relationMatched,
  requestDmEntry,
  setNewChatMode,
  setNewChatSpeaker,
  setPersonaDraft,
  setStep,
  sharedCharacters,
  startRenameDm,
}) {
  const speakerName = newChatSpeaker === "char"
    ? char.name
    : (personas.find((p) => `p:${p.id}` === newChatSpeaker)?.name || char.name);

  return (
    <div className="al-phone">
      <div className="al-dmhead">
        <button className="al-back-inline" onClick={() => setStep("feed")}>‹</button>
        <div className="al-dmhead-av">{initial}</div>
        <div className="al-dmhead-info">
          <span className="al-dmhead-name">{char.name}의 DM</span>
          <span className="al-dmhead-sub">대화 목록</span>
        </div>
      </div>

      <div className="al-convlist">
        {conversations.length === 0 && !newChatMode && (
          <div className="al-conv-empty">
            <p>아직 대화가 없어.</p>
            <span>아래에서 다른 캐릭터에게 말을 걸어봐.</span>
          </div>
        )}
        {conversations.map((c) => (
          <div key={c.key} className="al-convitem">
            <button
              className="al-convmain"
              onClick={() => {
                if (c.asOwner) {
                  requestDmEntry({ name: char.name, persona: char.persona, relation: "", asOwner: true }, "owner");
                } else {
                  const acc = accounts.find((a) => nameMatch(a.char.name, c.peerName));
                  const fol = following.find((f) => nameMatch(f.name, c.peerName));
                  const shared = sharedCharacters.find((s) => nameMatch(s.name, c.peerName));
                  const basePeer = acc?.char || fol || shared || {};
                  const nextPeer = {
                    ...basePeer,
                    name: c.peerName,
                    persona: basePeer.persona || "",
                    relation: relationMatched(char, basePeer.name ? basePeer : { name: c.peerName }),
                    dmKind: c.dmKind,
                    dmKey: c.dmKey,
                    localRoomId: c.localRoomId,
                  };
                  let restoredSpeakAs = "char";
                  if (c.asPersona) {
                    const p = personas.find((pp) => pp.name === c.asPersona);
                    restoredSpeakAs = p ? `p:${p.id}` : "char";
                  }
                  requestDmEntry(nextPeer, restoredSpeakAs);
                }
              }}
            >
              <div className="al-convitem-av">{c.asOwner ? "🙋" : c.asPersona ? "🎭" : (c.peerName.trim()[0] || "?")}</div>
              <div className="al-convitem-info">
                <span className="al-convitem-name">{displayDmTitle(c)}</span>
                <span className="al-convitem-last">{c.dmKind === "npc" ? "NPC 채팅 · " : c.asOwner ? "" : "공유 DM · "}{c.last.slice(0, 28) || "대화 시작"}</span>
              </div>
              <span className="al-convitem-count">{c.count}</span>
            </button>
            <div className="al-conv-actions">
              <button type="button" onClick={(e) => startRenameDm(c, e)}>수정</button>
              <button type="button" className="danger" onClick={(e) => deleteDmThread(c.key, e)}>삭제</button>
            </div>
          </div>
        ))}
      </div>

      <div className="al-newchat">
        {!newChatMode ? (
          <>
            <button
              className="al-owner-entry"
              onClick={() => {
                requestDmEntry({ name: char.name, persona: char.persona, relation: "", asOwner: true }, "owner");
              }}
            >
              🙋 나(오너)로서 <b>{char.name}</b>에게 직접 말 걸기
            </button>
            <button className="al-newchat-btn" onClick={() => { setNewChatSpeaker("char"); setNewChatMode("char"); }}>
              💬 <b>{char.name}</b>(으)로 다른 캐릭터에게 말 걸기
            </button>
            <button
              className="al-persona-entry"
              onClick={() => {
                if (personas.length === 0) { setPersonaDraft({ name: "", age: "", persona: "", speech: "" }); return; }
                setNewChatSpeaker(`p:${personas[0].id}`);
                setNewChatMode("persona");
              }}
            >
              🎭 내 페르소나로 캐릭터에게 말 걸기 {personas.length === 0 && <span className="al-pe-hint">(먼저 만들기)</span>}
            </button>
          </>
        ) : (
          <div className="al-newchat-panel">
            {newChatMode === "persona" && (
              <>
                <p className="al-newchat-lbl">어떤 페르소나로?</p>
                <div className="al-nc-speakers">
                  {personas.map((p) => (
                    <button
                      key={p.id}
                      className={`al-spk-chip persona ${newChatSpeaker === `p:${p.id}` ? "on" : ""}`}
                      onClick={() => setNewChatSpeaker(`p:${p.id}`)}
                    >
                      🎭 {p.name}
                    </button>
                  ))}
                  <button className="al-spk-chip add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}>+ 페르소나</button>
                </div>
              </>
            )}
            <p className="al-newchat-lbl">누구에게 — {speakerName}(으)로</p>
            <div className="al-newchat-targets">
              {newChatMode === "persona" && (
                <button
                  className="al-newchat-target mine"
                  onClick={() => {
                    requestDmEntry({ name: char.name, persona: char.persona, relation: "" }, newChatSpeaker);
                  }}
                >
                  <span className="al-nt-av">{char.name.trim()[0]}</span>
                  <span className="al-nt-name">{char.name}</span>
                  <span className="al-nt-mine-tag">내 캐릭터</span>
                </button>
              )}
              {accounts.filter((a) => a.id !== activeId).map((a) => {
                const rel = relationMatched(char, { name: a.char.name });
                return (
                  <button
                    key={a.id}
                    className="al-newchat-target"
                    onClick={() => {
                      requestDmEntry({ name: a.char.name, persona: a.char.persona, relation: "" }, newChatSpeaker);
                    }}
                  >
                    <span className="al-nt-av">{a.char.name.trim()[0]}</span>
                    <span className="al-nt-name">{a.char.name}</span>
                    {rel && <span className="al-nt-rel">♥ {rel.split(/[—\-–:]/).slice(1).join("").trim() || "관계"}</span>}
                  </button>
                );
              })}
              {following.map((f) => (
                <button
                  key={f.id}
                  className="al-newchat-target ext"
                  onClick={() => {
                    requestDmEntry({ ...f, name: f.name, persona: f.persona, relation: relationMatched(char, f) }, newChatSpeaker);
                  }}
                >
                  <span className="al-nt-av">{f.name.trim()[0]}</span>
                  <span className="al-nt-name">{f.name}</span>
                  <span className="al-nt-ext">팔로잉 · {f.owner}</span>
                </button>
              ))}
              {newChatMode === "char" && accounts.filter((a) => a.id !== activeId).length === 0 && following.length === 0 && (
                <p className="al-nt-none">다른 캐릭터를 만들거나, 🔍 탐색에서 캐릭터를 팔로우해봐.</p>
              )}
            </div>
            <button className="al-newchat-cancel" onClick={() => setNewChatMode(null)}>닫기</button>
          </div>
        )}
      </div>
    </div>
  );
}
