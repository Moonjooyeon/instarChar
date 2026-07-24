import React from "react";
import { USER_PERSONA_FEATURE_ENABLED } from "@/domain/app/featureFlags";

export function DmControls({ ctx }) {
  const {
    activePersona,
    autoChatting,
    char,
    chatMode,
    dmImageDraft,
    dmInput,
    dmSending,
    handleDmImage,
    josa,
    meName,
    ownerPersona,
    peer,
    personas,
    sendDM,
    setChatMode,
    setDmImageDraft,
    setDmInput,
    setOwnerPersona,
    setPersonaDraft,
    setSpeakAs,
    speakAs,
    speakerName,
    startAutoChat,
    stopAutoChat,
  } = ctx;
  if (peer.readOnly) {
    return <div className="al-dmctrl">과거 페르소나 대화는 읽기 전용으로 보관됩니다.</div>;
  }
  return (
    <>
      {peer.asOwner && (
        <div className="al-dmctrl">
          <input className="al-owner-persona" value={ownerPersona} onChange={(event) => setOwnerPersona(event.target.value)} placeholder="나(오너) 페르소나 — 한 줄 (선택, 저장됨)" />
        </div>
      )}
      {!peer.asOwner && (
        <div className="al-autochat">
          <div className="al-chatmode">
            <span className="al-ctrl-lbl">자동 대화 방식:</span>
            <button className={chatMode === "talk" ? "on" : ""} onClick={() => setChatMode("talk")}>대화</button>
            <button className={chatMode === "novel" ? "on" : ""} onClick={() => setChatMode("novel")}>소설(묘사)</button>
          </div>
          {!autoChatting ? (
            <button className="al-autochat-go" onClick={startAutoChat} disabled={dmSending}>⟳ {speakerName} ↔ {peer.name} 자동 대화 (천천히)</button>
          ) : (
            <button className="al-autochat-stop" onClick={stopAutoChat}>■ 멈추기 <span className="al-autochat-live">● LIVE — 입력하면 {speakerName}로 끼어들기</span></button>
          )}
        </div>
      )}
      {!peer.asOwner && (
        <div className="al-speaker-wrap">
          <div className="al-speaker-sel">
            <span className="al-ctrl-lbl">말하는 나:</span>
            <button className={`al-spk-chip ${speakAs === "char" ? "on" : ""}`} onClick={() => setSpeakAs("char")}>{char.name}</button>
            <button className={`al-spk-chip ${speakAs === "owner" ? "on" : ""}`} onClick={() => setSpeakAs("owner")}>🙋 나(오너)</button>
            {USER_PERSONA_FEATURE_ENABLED && personas.map((persona) => (
              <button key={persona.id} className={`al-spk-chip persona ${speakAs === `p:${persona.id}` ? "on" : ""}`} onClick={() => setSpeakAs(`p:${persona.id}`)}>🎭 {persona.name}</button>
            ))}
            {USER_PERSONA_FEATURE_ENABLED && <button className="al-spk-chip add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}>+ 페르소나</button>}
          </div>
          {speakAs === "owner" && <input className="al-owner-persona" value={ownerPersona} onChange={(event) => setOwnerPersona(event.target.value)} placeholder="나(오너) 페르소나 — 한 줄 (선택)" />}
          {USER_PERSONA_FEATURE_ENABLED && activePersona && <div className="al-persona-active">🎭 {activePersona.name}(으)로 대화 중 · {activePersona.persona?.slice(0, 30)}</div>}
        </div>
      )}
      {dmImageDraft && <div className="al-dm-preview"><img src={dmImageDraft} alt="" /><button type="button" onClick={() => setDmImageDraft(null)}>×</button></div>}
      <div className="al-dminput">
        <label className="al-dm-image-btn" title="사진 보내기">+<input type="file" accept="image/*" onChange={handleDmImage} /></label>
        <input value={dmInput} onChange={(event) => setDmInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) sendDM(); }} placeholder={autoChatting ? `끼어들기: ${meName}(으)로 입력…` : `${meName}(으)로 메시지…`} />
        <button onClick={sendDM} disabled={(!dmInput.trim() && !dmImageDraft) || dmSending}>↑</button>
      </div>
    </>
  );
}
