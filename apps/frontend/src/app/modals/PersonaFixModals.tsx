import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { USER_PERSONA_FEATURE_ENABLED } from "@/domain/app/featureFlags";

const PERSONA_INPUT_CLASS = "al-pd-input border-line bg-surface-raised text-ink placeholder:text-faint focus:border-accent";
const MODAL_CANCEL_CLASS = "al-modal-cancel border-line bg-surface-raised text-soft hover:border-line-strong hover:bg-surface-muted hover:text-ink";
const MODAL_SAVE_CLASS = "al-modal-save bg-accent text-on-accent hover:bg-accent-strong disabled:bg-surface-muted disabled:text-soft";
const PERSONA_SAVE_CLASS = "al-pd-save bg-accent text-on-accent hover:bg-accent-strong disabled:bg-surface-muted disabled:text-soft";
const PERSONA_DELETE_CLASS = "al-pd-del bg-danger-soft text-danger hover:bg-danger hover:text-on-danger";

export function PersonaFixModals({ ctx }) {
  const {
    addCorrection,
    canUseApp,
    char,
    commentOn,
    deletePersona,
    fixTarget,
    fixText,
    peer,
    personaDraft,
    ProposalModal,
    proposal,
    QUICK_FIXES,
    relationResult,
    RelationResultModal,
    resolveProposal,
    setCommentAs,
    setDmThread,
    setFixTarget,
    setFixText,
    setPersonaDraft,
    setPersonas,
    setRelationResult,
    setSpeakAs,
    setPosts,
  } = ctx;
  return (
    <>
      {USER_PERSONA_FEATURE_ENABLED && canUseApp && personaDraft && (
        <div className="al-modal-bg al-theme-ready al-common-modal-theme-ready" onClick={() => setPersonaDraft(null)}>
          <div className="al-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="al-modal-title"><AliveIcon name="masks" size={20} /> {personaDraft.id ? "페르소나 수정" : "새 페르소나"}</h3>
            <p className="al-modal-sub">캐릭터에게 다가갈 또 다른 나. 캐릭터처럼 호감도·관계가 따로 쌓여.</p>
            <input className={PERSONA_INPUT_CLASS} placeholder="이름" value={personaDraft.name} onChange={(event) => setPersonaDraft({ ...personaDraft, name: event.target.value })} />
            <input className={PERSONA_INPUT_CLASS} placeholder="나이·한 줄 설정 (예: 24, 떠돌이 사진가)" value={personaDraft.age} onChange={(event) => setPersonaDraft({ ...personaDraft, age: event.target.value })} />
            <textarea className={`${PERSONA_INPUT_CLASS} area`} placeholder="성격·배경 (어떤 사람인지)" value={personaDraft.persona} onChange={(event) => setPersonaDraft({ ...personaDraft, persona: event.target.value })} />
            <input className={PERSONA_INPUT_CLASS} placeholder="말투 (예: 나른한 반말, 존댓말…)" value={personaDraft.speech} onChange={(event) => setPersonaDraft({ ...personaDraft, speech: event.target.value })} />
            <PersonaActions ctx={{ commentOn, deletePersona, peer, personaDraft, setCommentAs, setPersonaDraft, setPersonas, setSpeakAs }} />
          </div>
        </div>
      )}
      <ProposalModal proposal={proposal} onResolve={resolveProposal} />
      <RelationResultModal relationResult={relationResult} onClose={() => setRelationResult(null)} />
      {fixTarget && <FixCharacterizationModal ctx={{ addCorrection, char, fixTarget, fixText, QUICK_FIXES, setDmThread, setFixTarget, setFixText, setPosts }} />}
    </>
  );
}

function PersonaActions({ ctx }) {
  const { commentOn, deletePersona, peer, personaDraft, setCommentAs, setPersonaDraft, setPersonas, setSpeakAs } = ctx;
  return (
    <div className="al-pd-btns">
      {personaDraft.id && (
        <button className={PERSONA_DELETE_CLASS} onClick={() => { deletePersona(personaDraft.id); setPersonaDraft(null); }}>삭제</button>
      )}
      <button className="al-pd-cancel border-line bg-surface-raised text-soft hover:bg-surface-muted hover:text-ink" onClick={() => setPersonaDraft(null)}>취소</button>
      <button className={PERSONA_SAVE_CLASS} disabled={!personaDraft.name.trim()} onClick={() => {
        if (personaDraft.id) {
          setPersonas((items) => items.map((item) => item.id === personaDraft.id ? { ...personaDraft } : item));
        } else {
          const nextPersona = { ...personaDraft, id: Date.now() };
          setPersonas((items) => [...items, nextPersona]);
          if (peer) setSpeakAs(`p:${nextPersona.id}`);
          if (commentOn) setCommentAs(`p:${nextPersona.id}`);
        }
        setPersonaDraft(null);
      }}>저장</button>
    </div>
  );
}

function FixCharacterizationModal({ ctx }) {
  const { addCorrection, char, fixTarget, fixText, QUICK_FIXES, setDmThread, setFixTarget, setFixText, setPosts } = ctx;
  return (
    <div className="al-modal-bg al-theme-ready al-common-modal-theme-ready" onClick={() => setFixTarget(null)}>
      <div className="al-modal" onClick={(event) => event.stopPropagation()}>
        <h3 className="al-modal-title">캐해 바로잡기</h3>
        <p className="al-modal-sub">뭐가 {fixTarget.who || char.name}답지 않았어? 알려주면 다음부턴 안 그래.</p>
        <div className="al-modal-quote">"{fixTarget.text.slice(0, 60)}{fixTarget.text.length > 60 ? "…" : ""}"</div>
        <div className="al-fixchips">
          {QUICK_FIXES.map((quickFix) => <button key={quickFix} className="al-fixchip border-accent bg-accent-soft text-accent-ink hover:bg-surface-muted" onClick={() => setFixText((text) => text ? `${text}, ${quickFix}` : quickFix)}>{quickFix}</button>)}
        </div>
        <textarea className="al-fixinput border-line bg-surface-raised text-ink placeholder:text-faint focus:border-accent" value={fixText} onChange={(event) => setFixText(event.target.value)} placeholder="예: 얘는 이럴 때 더 무심하게 말해. 느낌표 안 씀." />
        <div className="al-modal-actions">
          <button className={MODAL_CANCEL_CLASS} onClick={() => setFixTarget(null)}>취소</button>
          <button className="al-modal-saveonly border-accent bg-accent-soft text-accent-ink disabled:opacity-40" disabled={!fixText.trim()} onClick={() => { addCorrection(fixText, fixTarget.who); setFixTarget(null); }}>교정만</button>
          <button className={MODAL_SAVE_CLASS} disabled={!fixText.trim()} onClick={() => {
            addCorrection(fixText, fixTarget.who);
            if (fixTarget.type === "post") setPosts((posts) => posts.filter((post) => post.id !== fixTarget.id));
            else setDmThread((messages) => messages.filter((_, index) => index !== fixTarget.index));
            setFixTarget(null);
          }}>교정+지우기</button>
        </div>
        {(char.corrections || []).length > 0 && <p className="al-fixcount">지금까지 교정 {(char.corrections || []).length}개 — 다음 생성부터 반영돼</p>}
      </div>
    </div>
  );
}
