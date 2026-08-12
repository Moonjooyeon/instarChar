import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { USER_PERSONA_FEATURE_ENABLED } from "@/domain/app/featureFlags";
import { DM_RESPONSE_MODES, dmResponseMode } from "@/domain/dm/dmResponseMode";
import { dmSuggestionPrompts } from "@/domain/dm/dmSuggestions";
import { DmCreditStatus } from "@/features/credits/DmCreditStatus";
import { CreditUsageHint } from "@/features/credits/CreditUsageHint";

export function DmControls({ ctx }) {
  const {
    activePersona,
    autoChatting,
    char,
    chatMode,
    dmInput,
    dm,
    dmResponseFlow,
    dmSending,
    josa,
    meName,
    openCredits,
    ownerPersona,
    peer,
    peerName,
    personas,
    sendDM,
    setChatMode,
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
  const responseMode = dmResponseMode(dmResponseFlow);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const lastMessage = dm[dm.length - 1];
  const showPromptRail = !autoChatting && !dmSending && !dmInput.trim() && (!lastMessage || lastMessage.from === peerName);
  const selectPrompt = (prompt: string): void => { setDmInput(prompt); inputRef.current?.focus(); };
  if (peer.readOnly) {
    return <div className="al-dm-composer al-dmctrl">과거 페르소나 대화는 읽기 전용으로 보관됩니다.</div>;
  }
  return (
    <div className="al-dm-composer">
      {showPromptRail && <DmPromptRail lastText={lastMessage?.text} messageCount={dm.length} peer={peer} peerName={peerName} onSelectPrompt={selectPrompt} />}
      <div className="al-dm-compose-meta">
        <details className="al-dm-options">
          <summary><span><AliveIcon name="settings" size={15} /> 대화 설정</span><small>{autoChatting ? "자동 대화 진행 중" : `${responseMode.name} · ${responseMode.credits}C`}</small><AliveIcon name="chevron-down" size={16} /></summary>
          <div className="al-dm-options-content">
            <div className="al-dm-response-list" role="radiogroup" aria-label="DM 응답 모드">
              <span>답장 방식</span>
              {DM_RESPONSE_MODES.map((mode) => <button key={mode.code} type="button" role="radio" aria-checked={dmResponseFlow === mode.code} className={dmResponseFlow === mode.code ? "on" : ""} onClick={() => setDmResponseFlow(mode.code)}>
                <span><b>{mode.name}</b><small>{mode.description}</small></span><strong>{mode.credits}C</strong>
              </button>)}
            </div>
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
                <button className="al-autochat-stop border-danger bg-danger-soft text-danger hover:bg-danger hover:text-on-danger" onClick={stopAutoChat}><AliveIcon name="stop" size={13} /> 멈추기 <span className="al-autochat-live"><i /> LIVE — 입력하면 {speakerName}로 끼어들기</span></button>
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
        <DmCreditStatus busy={dmSending && !autoChatting} flowCode={responseMode.code} onOpenCredits={openCredits} />
      </div>
      <div className="al-dminput">
        <input ref={inputRef} value={dmInput} onChange={(event) => setDmInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) sendDM(); }} aria-label="메시지 입력" autoComplete="off" enterKeyHint="send" placeholder={autoChatting ? `끼어들기: ${meName}(으)로 입력…` : `${meName}(으)로 메시지…`} />
        <button className="bg-accent text-on-accent hover:bg-accent-strong disabled:bg-surface-muted disabled:text-soft" aria-label="메시지 보내기" onClick={sendDM} disabled={!dmInput.trim() || dmSending}><AliveIcon name="send" size={19} /></button>
      </div>
    </div>
  );
}

function DmPromptRail({ lastText = "", messageCount, onSelectPrompt, peer, peerName }) {
  const prompts = dmSuggestionPrompts({ asOwner: Boolean(peer.asOwner), lastText, messageCount, peerName });
  const label = lastText ? "바로 이어가기" : "대화 시작하기";
  return <div className="al-dm-prompt-rail" aria-label={label}><span>{label}</span><div>{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => onSelectPrompt(prompt)}>{prompt}</button>)}</div></div>;
}
