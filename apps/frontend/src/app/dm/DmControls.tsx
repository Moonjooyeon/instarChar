import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { mediaUrl } from "@/api/media";
import { USER_PERSONA_FEATURE_ENABLED } from "@/domain/app/featureFlags";
import { DM_RESPONSE_MODES, dmResponseMode } from "@/domain/dm/dmResponseMode";
import { DmCreditStatus } from "@/features/credits/DmCreditStatus";
import { CreditUsageHint } from "@/features/credits/CreditUsageHint";

export function DmControls({ ctx }) {
  const {
    activePersona,
    autoChatting,
    char,
    chatMode,
    dm,
    dmImageDraft,
    dmInput,
    dmResponseFlow,
    dmSending,
    handleDmImage,
    josa,
    meName,
    openCredits,
    ownerPersona,
    peer,
    personas,
    sendDM,
    setChatMode,
    setDmImageDraft,
    setDmInput,
    setDmResponseFlow,
    setOwnerPersona,
    setPersonaDraft,
    setSpeakAs,
    speakAs,
    speakerName,
    startAutoChat,
    stopAutoChat,
  } = ctx;
  const pendingImage = dmSending && Boolean(dm[dm.length - 1]?.img);
  const usesImage = Boolean(dmImageDraft) || pendingImage;
  const responseMode = dmResponseMode(dmResponseFlow);
  if (peer.readOnly) {
    return <div className="al-dm-composer al-dmctrl">과거 페르소나 대화는 읽기 전용으로 보관됩니다.</div>;
  }
  return (
    <div className="al-dm-composer">
      <details className="al-dm-options">
        <summary><span><AliveIcon name="settings" size={15} /> 대화 설정</span><small>{autoChatting ? "자동 대화 진행 중" : (peer.asOwner ? "호칭 설정" : `${speakerName}(으)로 대화 중`)}</small><AliveIcon name="chevron-down" size={16} /></summary>
        <div className="al-dm-options-content">
          {peer.asOwner && (
            <div className="al-dmctrl">
              <input className="al-owner-persona" value={ownerPersona} onChange={(event) => setOwnerPersona(event.target.value)} placeholder="캐릭터가 나를 어떻게 알면 좋을까요? (선택)" />
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
                <button className="al-autochat-go border-line-strong bg-surface-raised text-accent-ink hover:border-accent hover:bg-accent-soft" onClick={startAutoChat} disabled={dmSending}><AliveIcon name="refresh" size={15} /> {speakerName} <AliveIcon name="swap" size={14} /> {peer.name} 자동 대화</button>
              ) : (
                <button className="al-autochat-stop border-danger bg-danger-soft text-danger hover:bg-danger hover:text-white" onClick={stopAutoChat}><AliveIcon name="stop" size={13} /> 멈추기 <span className="al-autochat-live"><i /> LIVE — 입력하면 {speakerName}로 끼어들기</span></button>
              )}
              <CreditUsageHint busy={autoChatting} className="auto" flowCode="direct_dm_basic" label="자동 대화 예상 사용량" maxUses={6} />
            </div>
          )}
          {!peer.asOwner && (
            <div className="al-speaker-wrap">
              <div className="al-speaker-sel">
                <span className="al-ctrl-lbl">누가 말할까요?</span>
                <button className={`al-spk-chip ${speakAs === "char" ? "on" : ""}`} onClick={() => setSpeakAs("char")}>{char.name}</button>
                <button className={`al-spk-chip ${speakAs === "owner" ? "on" : ""}`} onClick={() => setSpeakAs("owner")}><AliveIcon name="user" size={14} /> 나</button>
                {USER_PERSONA_FEATURE_ENABLED && personas.map((persona) => (
                  <button key={persona.id} className={`al-spk-chip persona ${speakAs === `p:${persona.id}` ? "on" : ""}`} onClick={() => setSpeakAs(`p:${persona.id}`)}><AliveIcon name="masks" size={14} /> {persona.name}</button>
                ))}
                {USER_PERSONA_FEATURE_ENABLED && <button className="al-spk-chip add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}><AliveIcon name="plus" size={14} /> 페르소나</button>}
              </div>
              {speakAs === "owner" && <input className="al-owner-persona" value={ownerPersona} onChange={(event) => setOwnerPersona(event.target.value)} placeholder="상대가 나를 어떻게 알면 좋을까요? (선택)" />}
              {USER_PERSONA_FEATURE_ENABLED && activePersona && <div className="al-persona-active"><AliveIcon name="masks" size={14} /> {activePersona.name}(으)로 대화 중 · {activePersona.persona?.slice(0, 30)}</div>}
            </div>
          )}
        </div>
      </details>
      {dmImageDraft && <div className="al-dm-preview"><img src={mediaUrl(dmImageDraft)} alt="" /><button type="button" onClick={() => setDmImageDraft(null)} aria-label="첨부 이미지 제거"><AliveIcon name="close" size={16} /></button></div>}
      <details className="al-dm-response-mode">
        <summary><span>응답 모드</span><b>{usesImage ? "사진 답장" : responseMode.name}</b><small>{usesImage ? "5C" : `${responseMode.credits}C`}</small><AliveIcon name="chevron-down" size={16} /></summary>
        <div className="al-dm-response-list" role="radiogroup" aria-label="DM 응답 모드">
          {usesImage && <p className="al-dm-image-mode-note" role="status">사진을 보내면 선택한 응답 모드 대신 사진 답장 5C로 처리돼요.</p>}
          {DM_RESPONSE_MODES.map((mode) => <button key={mode.code} type="button" role="radio" aria-checked={dmResponseFlow === mode.code} className={dmResponseFlow === mode.code ? "on" : ""} onClick={() => setDmResponseFlow(mode.code)}>
            <span><b>{mode.name}</b><small>{mode.description}</small></span><strong>{mode.credits}C</strong>
          </button>)}
        </div>
      </details>
      <DmCreditStatus busy={dmSending && !autoChatting} flowCode={usesImage ? "image_understanding" : dmResponseFlow} onOpenCredits={openCredits} />
      <div className="al-dminput">
        <label className="al-dm-image-btn border-line-strong bg-surface-raised text-accent-ink hover:border-accent hover:bg-accent-soft" title="사진 보내기"><AliveIcon name="image" size={20} /><input type="file" accept="image/*" onChange={handleDmImage} /></label>
        <input value={dmInput} onChange={(event) => setDmInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) sendDM(); }} placeholder={autoChatting ? `끼어들기: ${meName}(으)로 입력…` : `${meName}(으)로 메시지…`} />
        <button className="bg-accent text-white hover:bg-accent-strong disabled:bg-surface-muted disabled:text-faint" aria-label="메시지 보내기" onClick={sendDM} disabled={(!dmInput.trim() && !dmImageDraft) || dmSending}><AliveIcon name="send" size={19} /></button>
      </div>
    </div>
  );
}
