import React from "react";

export function DmAffinityPanel({ ctx }) {
  const { activePersona, affinityOpen, attachStage, mineToPeer, mineToPeerStage, ownerVal, peer, peerName, peerToMine, peerToMineStage, PROPOSAL_THRESHOLD, setAffinityOpen, speakerName } = ctx;
  return (
    <div className={`al-affinity ${peer.asOwner ? "owner" : ""}`}>
      <button className="al-aff-toggle" onClick={() => setAffinityOpen((value) => !value)}>
        <span>호감도</span>
        <b>{peer.asOwner ? `${attachStage(ownerVal)} · ${ownerVal}` : `${peerToMineStage} · ${peerToMine}`}</b>
        <i>{affinityOpen ? "접기" : "펼치기"}</i>
      </button>
      {affinityOpen && (
        <div className="al-aff-content">
          {peer.asOwner && <OwnerAffinity ownerVal={ownerVal} peerName={peerName} attachStage={attachStage} />}
          {!peer.asOwner && activePersona && <PersonaAffinity peerName={peerName} peerToMine={peerToMine} peerToMineStage={peerToMineStage} speakerName={speakerName} PROPOSAL_THRESHOLD={PROPOSAL_THRESHOLD} />}
          {!peer.asOwner && !activePersona && <CharacterAffinity mineToPeer={mineToPeer} mineToPeerStage={mineToPeerStage} peerName={peerName} peerToMine={peerToMine} peerToMineStage={peerToMineStage} speakerName={speakerName} PROPOSAL_THRESHOLD={PROPOSAL_THRESHOLD} />}
        </div>
      )}
    </div>
  );
}

function OwnerAffinity({ attachStage, ownerVal, peerName }) {
  return (
    <>
      <div className="al-aff-top"><span className="al-aff-lbl">🤍 {peerName} → 나</span><span className="al-aff-stage">{attachStage(ownerVal)} · {ownerVal}</span></div>
      <div className="al-aff-bar"><div className={`al-aff-fill ${ownerVal < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(ownerVal)}%` }} /></div>
    </>
  );
}

function PersonaAffinity({ peerName, peerToMine, peerToMineStage, PROPOSAL_THRESHOLD, speakerName }) {
  return (
    <>
      <div className="al-aff-row"><span className="al-aff-lbl rev">♥ {peerName} → {speakerName} <span className="al-aff-note">(가면이라 {speakerName}는 빠지지 않음)</span></span><span className="al-aff-stage">{peerToMineStage} · {peerToMine}</span></div>
      <div className="al-aff-bar"><div className={`al-aff-fill rev ${peerToMine < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(peerToMine)}%` }} /><div className="al-aff-mark" style={{ left: `${PROPOSAL_THRESHOLD}%` }} /></div>
    </>
  );
}

function CharacterAffinity({ mineToPeer, mineToPeerStage, peerName, peerToMine, peerToMineStage, PROPOSAL_THRESHOLD, speakerName }) {
  return (
    <>
      <div className="al-aff-row"><span className="al-aff-lbl">♥ {speakerName} → {peerName}</span><span className="al-aff-stage">{mineToPeerStage} · {mineToPeer}</span></div>
      <div className="al-aff-bar"><div className={`al-aff-fill ${mineToPeer < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(mineToPeer)}%` }} /><div className="al-aff-mark" style={{ left: `${PROPOSAL_THRESHOLD}%` }} title="고백 가능선" /></div>
      <div className="al-aff-row second"><span className="al-aff-lbl rev">♥ {peerName} → {speakerName}</span><span className="al-aff-stage">{peerToMineStage} · {peerToMine}</span></div>
      <div className="al-aff-bar"><div className={`al-aff-fill rev ${peerToMine < 0 ? "neg" : ""}`} style={{ width: `${Math.abs(peerToMine)}%` }} /><div className="al-aff-mark" style={{ left: `${PROPOSAL_THRESHOLD}%` }} /></div>
    </>
  );
}
