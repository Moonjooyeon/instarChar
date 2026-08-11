import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";

const RETRY_ACTION_CLASS = "al-retry border-accent bg-accent-soft text-accent-ink hover:bg-surface-raised";
const BACK_ACTION_CLASS = "al-reparse border-line bg-surface text-soft hover:border-accent hover:bg-accent-soft hover:text-ink";
const SAVE_ACTION_CLASS = "al-start al-confirm-go bg-accent text-on-accent hover:bg-accent-strong disabled:bg-surface-muted disabled:text-soft";

export function ConfirmScreen({
  activeId,
  char,
  characterSaveError,
  confirmReady,
  handleAvailability,
  handleError,
  onBack,
  parseFailed,
  parseRelations,
  parsing,
  parseDump,
  profileEditBackLabel,
  saveCharacterEdits,
  setStep,
  update,
  wakeCharacter,
  waking,
}) {
  const [isCoreEditing, setIsCoreEditing] = React.useState(Boolean(parseFailed));
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  return <div className="al-phone al-theme-ready"><div className="al-setup al-confirm-setup">
    <div className="al-confirm-progress"><b>마지막 확인</b><span>필수 정보만 확인해요.</span></div>
    <header className="al-confirm-hero">
      <span className="al-confirm-avatar"><CharacterAvatarImage src={char.avatarImg} /></span>
      <div><h1 className="al-flow-title">{parseFailed ? "일단 이대로 시작할까요?" : "이대로 시작할까요?"}</h1><p className="al-flow-copy">{parseFailed ? "입력한 내용을 바탕으로 프로필을 준비했어요." : "틀린 부분만 고치면 돼요."}</p></div>
    </header>
    {parseFailed && <ParseFallback onRetry={parseDump} retrying={parsing} />}
    <CoreProfile char={char} handleAvailability={handleAvailability} handleError={handleError} isEditing={isCoreEditing} onEdit={() => setIsCoreEditing((editing) => !editing)} showEditToggle={!parseFailed} update={update} />
    <button className="al-confirm-details-toggle" type="button" aria-expanded={isDetailsOpen} onClick={() => setIsDetailsOpen((open) => !open)}>
      <span><b>더 다듬기 <em>선택</em></b><small>지금은 건너뛰어도 괜찮아요.</small></span><i><AliveIcon name={isDetailsOpen ? "minus" : "plus"} size={19} /></i>
    </button>
    {isDetailsOpen && <CharacterDetails char={char} parseRelations={parseRelations} update={update} />}
    <ConfirmActions activeId={activeId} backLabel={profileEditBackLabel} char={char} confirmReady={confirmReady} onBack={activeId ? onBack : () => setStep("dump")} onSave={activeId ? saveCharacterEdits : wakeCharacter} waking={waking} />
    {characterSaveError && <div className="al-character-save-error" role="alert">{characterSaveError}</div>}
  </div></div>;
}

function ParseFallback({ onRetry, retrying }) {
  return <aside className="al-parse-fallback" role="status"><div><b>AI 정리는 나중에 다시 해도 돼요.</b><p>지금은 이 캐릭터를 먼저 만나보세요.</p></div><button className={RETRY_ACTION_CLASS} disabled={retrying} type="button" onClick={onRetry}><AliveIcon name="refresh" size={15} /> {retrying ? "정리 중..." : "다시 정리"}</button></aside>;
}

function CoreProfile({ char, handleAvailability, handleError, isEditing, onEdit, showEditToggle, update }) {
  if (!isEditing) return <section className="al-confirm-summary" aria-label="정리된 기본 프로필"><header><div><small>기본 프로필</small><b>{char.name || "이름을 확인해주세요"}</b><span>@{char.handle || "아이디 확인 필요"}</span></div>{showEditToggle && <button aria-label="틀린 부분 수정" type="button" onClick={onEdit}>수정</button>}</header><p>{char.persona || "아직 한 줄 소개가 비어 있어요."}</p>{(handleError || handleAvailability.state === "taken") && <small className="al-confirm-summary-error">{handleError || handleAvailability.message}</small>}</section>;
  return <section className="al-confirm-core" aria-label="필수 프로필 정보">
    <div className="al-confirm-section-head"><b>기본 프로필 수정</b>{showEditToggle && <button type="button" onClick={onEdit}>수정 닫기</button>}</div>
    <label className="al-field"><span>이름 <i className="al-field-required">필수</i></span><input value={char.name} onChange={(event) => update("name", event.target.value)} placeholder="캐릭터 이름" /></label>
    <label className="al-field"><span>아이디 <i className="al-field-required">필수</i></span><input aria-describedby="character-handle-status" aria-invalid={Boolean(handleError || handleAvailability.state === "taken")} value={char.handle} onChange={(event) => update("handle", event.target.value)} placeholder="@id" /><small id="character-handle-status" aria-live="polite" className={`al-handle-status ${handleStatusClass(handleAvailability.state, handleError)}`}>{handleError || handleAvailability.message}</small></label>
    <label className="al-field"><span>이 아이를 가장 잘 설명하는 한 줄 <i className="al-field-required">필수</i></span><textarea value={char.persona} onChange={(event) => update("persona", event.target.value)} placeholder="성격, 정체성, 태도가 드러나는 한 줄" /></label>
  </section>;
}

function CharacterDetails({ char, parseRelations, update }) {
  return <section className="al-confirm-details" aria-label="선택 프로필 정보">
    <div className="al-row"><label className="al-field"><span>나이/설정 <i>선택</i></span><input value={char.age} onChange={(event) => update("age", event.target.value)} placeholder="예: 21 / 마법사" /></label><label className="al-field"><span>말투 특징 <i>선택</i></span><input value={char.speech} onChange={(event) => update("speech", event.target.value)} placeholder="예: 짧은 존댓말" /></label></div>
    <label className="al-field"><span>세계관/배경 <i>선택</i></span><textarea value={char.world} onChange={(event) => update("world", event.target.value)} placeholder="어디서 왔고, 무엇이 당연한 사람인가요?" /></label>
    <RelationsField char={char} parseRelations={parseRelations} update={update} />
    <CharacterAnalysisFields char={char} update={update} />
  </section>;
}

function RelationsField({ char, parseRelations, update }) {
  const relations = parseRelations(char.relations);
  return <div className="al-relbox"><div className="al-relbox-head"><span>관계 <i>선택</i></span><span className="al-relbox-hint">이름 — 관계, 쉼표로 구분</span></div>{relations.length > 0 && <div className="al-relviz">{relations.map(({ who, label }, index) => <div key={index} className="al-relviz-item"><div className="al-relviz-line2"><span className="al-relviz-me">{char.name || "이 캐릭터"}</span><span className="al-relviz-arrow"><AliveIcon name="arrow-right" size={14} /></span><span className="al-relviz-peer">{who}</span></div>{label && <span className="al-relviz-rel">{label}</span>}</div>)}</div>}<input className="al-relinput" value={char.relations} onChange={(event) => update("relations", event.target.value)} placeholder="예: 선우 연 — 애인, 카엘 — 라이벌" /></div>;
}

function ConfirmActions({ activeId, backLabel, char, confirmReady, onBack, onSave, waking }) {
  const label = waking ? "저장 중..." : activeId ? "수정 완료" : confirmReady ? "SNS 시작하기" : "필수 항목을 확인해줘";
  return <div className="al-confirm-actions"><button className={BACK_ACTION_CLASS} onClick={onBack}><AliveIcon name="arrow-left" size={15} /> {activeId ? backLabel : "다시 입력"}</button><button className={SAVE_ACTION_CLASS} disabled={!confirmReady || waking} onClick={onSave}>{label}</button></div>;
}

function handleStatusClass(state, handleError) {
  if (handleError || state === "taken") return "error";
  if (state === "available") return "success";
  return "";
}

function CharacterAnalysisFields({ char, update }) {
  return <div className="al-analysis"><div className="al-analysis-head">더 선명하게 만들기 <small>선택</small></div>{[["surface", "첫인상", "겉으로 보이는 모습"], ["inner", "속마음", "겉과 다른 숨은 면"], ["situational", "상황별", "평소와 위기에서의 반응"], ["triggers", "약한 지점", "발끈하거나 무너지는 포인트"], ["interests", "좋아하는 것", "취미·관심사"]].map(([key, label, placeholder]) => <label className="al-an-row" key={key}><span className="al-an-lbl">{label}</span><input value={char[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} /></label>)}<div className="al-an-row"><span className="al-an-lbl">정드는 속도</span><div className="al-warmth-chips">{[["slow", "느림"], ["normal", "보통"], ["fast", "빠름"]].map(([value, label]) => <button key={value} type="button" className={`al-warmth-chip ${(char.warmth || "normal") === value ? "on" : ""}`} onClick={() => update("warmth", value)}>{label}</button>)}<span className="al-warmth-hint">호감도가 오르는 속도를 정해요.</span></div></div></div>;
}
