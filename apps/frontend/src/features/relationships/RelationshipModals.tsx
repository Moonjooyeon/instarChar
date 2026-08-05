import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";

const PRIMARY_ACTION_CLASS = "al-prop-yes border-accent bg-accent text-white hover:bg-accent-strong";
const SECONDARY_ACTION_CLASS = "al-prop-no border-line-strong bg-surface-raised text-soft hover:bg-surface-muted hover:text-ink";

export function ProposalModal({ proposal, onResolve }) {
  if (!proposal) return null;

  return (
    <div className="al-modal-bg al-theme-ready al-relationship-modal-theme-ready">
      <div className="al-modal al-proposal" onClick={(e) => e.stopPropagation()}>
        <div className="al-prop-heart"><AliveIcon name="heart-filled" size={34} /></div>
        <div className="al-prop-who">{proposal.asker}</div>
        <p className="al-prop-line">"{proposal.line}"</p>
        <p className="al-prop-sub">{proposal.asker}의 마음이 {proposal.other}에게 기울었어. 어떻게 할까?</p>
        <div className="al-prop-btns">
          <button className={PRIMARY_ACTION_CLASS} onClick={() => onResolve(true)}><AliveIcon name="heart-filled" size={16} /> 응, 가봐!</button>
          <button className={SECONDARY_ACTION_CLASS} onClick={() => onResolve(false)}>아직은 아냐</button>
        </div>
      </div>
    </div>
  );
}

export function RelationResultModal({ relationResult, onClose }) {
  if (!relationResult) return null;

  return (
    <div className="al-modal-bg al-theme-ready al-relationship-modal-theme-ready" onClick={onClose}>
      <div className="al-modal al-proposal" onClick={(e) => e.stopPropagation()}>
        <div className={`al-prop-heart ${relationResult.friendship ? "friendship" : relationResult.accepted ? "accepted" : "broken"}`}><AliveIcon name={relationResult.friendship ? "users" : relationResult.accepted ? "heart-filled" : "heart-broken"} size={34} /></div>
        {relationResult.friendship ? (
          <>
            <div className="al-prop-who">{relationResult.asker}와 {relationResult.other}, 더 가까워졌어!</div>
            <p className="al-prop-sub">둘의 사이가 한 단계 깊어졌어. 우정은 서로 마음만 맞으면 자연스럽게 이어지지.</p>
          </>
        ) : relationResult.accepted ? (
          <>
            <div className="al-prop-who">{relationResult.other}도 마음을 받아줬어!</div>
            <p className="al-prop-sub">{relationResult.asker}와 {relationResult.other}, 서로의 관계가 한 단계 깊어졌어. 양쪽 다 이어졌어.</p>
          </>
        ) : (
          <>
            <div className="al-prop-who">{relationResult.other}는 받아주지 않았어…</div>
            <p className="al-prop-sub">{relationResult.asker}의 마음만 남았어. 지금은 <b>짝사랑</b>이야. 마음이 조금 아프지만, 언젠가 닿을지도.</p>
          </>
        )}
        <div className="al-prop-btns">
          <button className={PRIMARY_ACTION_CLASS} onClick={onClose}>확인</button>
        </div>
      </div>
    </div>
  );
}
