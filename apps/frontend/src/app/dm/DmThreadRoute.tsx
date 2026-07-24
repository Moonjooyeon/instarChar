import React from "react";
import { DmAffinityPanel } from "@/app/dm/DmAffinityPanel";
import { DmControls } from "@/app/dm/DmControls";
import { DmMemoryPanel } from "@/app/dm/DmMemoryPanel";
import { DmMessages } from "@/app/dm/DmMessages";

export function DmThreadRoute({ ctx }) {
  const {
    activePersona,
    affOf,
    attachStage,
    char,
    currentWorldPref,
    dm,
    dmAffOf,
    dmKey,
    dmThreadTitles,
    findPeerChar,
    judgeSession,
    josa,
    meName,
    OWNER,
    ownerLabel,
    peer,
    processSession,
    PROPOSAL_THRESHOLD,
    relationHintFor,
    relationStageLabel,
    roomAffOf,
    roomMemoryEntries,
    setAffinityOpen,
    setShowPeerMem,
    setStep,
    showPeerMem,
    symmetricRelationBaseFromLabel,
  } = ctx;
  const state = dmThreadState({ activePersona, affOf, attachStage, char, currentWorldPref, dm, dmAffOf, dmKey, dmThreadTitles, findPeerChar, josa, meName, OWNER, ownerLabel, peer, relationHintFor, relationStageLabel, roomAffOf, roomMemoryEntries, symmetricRelationBaseFromLabel });
  return (
    <div className="al-phone">
      <div className="al-dmhead">
        <button className="al-back-inline" onClick={() => {
          const recentLines = dm.slice(-8).map((message) => ({ who: message.from, text: message.text }));
          if (!peer.readOnly && peer.asOwner) judgeSession(OWNER, state.peerName, recentLines);
          else if (!peer.readOnly && meName !== ownerLabel) processSession(meName, state.peerName, recentLines, false, dmKey);
          setStep("dmlist");
        }}>‹</button>
        <div className="al-dmhead-av">{state.peerInitial}</div>
        <div className="al-dmhead-info">
          <span className="al-dmhead-name">{state.roomTitle}</span>
          <span className="al-dmhead-sub">{state.headSub}</span>
        </div>
        {!peer.asOwner && !peer.readOnly && (
          <div className="al-dm-head-actions">
            <button className="al-dm-settings-btn" onClick={ctx.openDmSettings}>세계관</button>
            <button className={`al-dm-settings-btn ${showPeerMem ? "on" : ""}`} onClick={() => setShowPeerMem((value) => !value)}>기억 {state.visibleMems.length}</button>
          </div>
        )}
      </div>
      {!peer.readOnly && <DmAffinityPanel ctx={{ ...ctx, ...state, PROPOSAL_THRESHOLD, setAffinityOpen }} />}
      {!peer.readOnly && <DmMemoryPanel ctx={{ ...ctx, ...state }} />}
      <DmMessages ctx={{ ...ctx, ...state }} />
      <DmControls ctx={{ ...ctx, ...state, josa }} />
    </div>
  );
}

function dmThreadState({ activePersona, affOf, attachStage, char, currentWorldPref, dm, dmAffOf, dmKey, dmThreadTitles, findPeerChar, josa, meName, OWNER, ownerLabel, peer, relationHintFor, relationStageLabel, roomAffOf, roomMemoryEntries, symmetricRelationBaseFromLabel }) {
  const peerName = peer.asOwner ? char.name : peer.name;
  const peerInitial = peerName.trim()[0] || "?";
  const speakerName = peer.readOnly && peer.legacySpeakerName ? peer.legacySpeakerName : (activePersona ? activePersona.name : char.name);
  const npcRoom = dmKey?.startsWith("local::");
  const dmKindLabel = peer.dmKind === "npc" ? "NPC 채팅 · 관계 미반영" : "공유 DM";
  const headSub = peer.readOnly ? `${josa(speakerName, "으로/로")} 나눈 과거 대화 · 읽기 전용` : (peer.asOwner ? "나(오너)로서 대화 중" : `${josa(speakerName, "으로/로")} 대화 중 · ${dmKindLabel}`);
  const roomTitle = dmThreadTitles[dmKey] || (peer.asOwner ? `${peerName} (내 캐릭터)` : peerName);
  const peerCharForAffinity = peer.asOwner ? char : (findPeerChar(peerName) || peer);
  const speakerToPeerRel = relationHintFor(speakerName, peerName, peer.relation || "");
  const peerToSpeakerRel = relationHintFor(peerName, speakerName, "", peerCharForAffinity);
  const mineToPeerRaw = npcRoom ? roomAffOf(dmKey, speakerName, peerName, speakerToPeerRel) : dmAffOf(speakerName, peerName, speakerToPeerRel);
  const peerToMineRaw = npcRoom ? roomAffOf(dmKey, peerName, speakerName, peerToSpeakerRel) : dmAffOf(peerName, speakerName, peerToSpeakerRel);
  const romanticPairBase = Math.max(symmetricRelationBaseFromLabel(speakerToPeerRel) || 0, symmetricRelationBaseFromLabel(peerToSpeakerRel) || 0);
  const mineToPeer = romanticPairBase >= 90 ? Math.max(mineToPeerRaw, romanticPairBase) : mineToPeerRaw;
  const peerToMine = romanticPairBase >= 90 ? Math.max(peerToMineRaw, romanticPairBase) : peerToMineRaw;
  const ownerVal = npcRoom ? roomAffOf(dmKey, peerName, OWNER) : affOf(peerName, OWNER);
  const peerCharForMemory = findPeerChar(peerName);
  const roomMems = roomMemoryEntries(currentWorldPref, peerName, speakerName).map((entry) => ({ ...entry, scope: "room" }));
  const globalMems = npcRoom ? [] : (peerCharForMemory?.lorebook || []).filter((entry) => entry.peer === speakerName && !entry.roomKey).map((entry) => ({ ...entry, scope: "global" }));
  return {
    attachStage,
    headSub,
    mineToPeer,
    mineToPeerStage: relationStageLabel(speakerToPeerRel, mineToPeer),
    npcRoom,
    ownerVal,
    peerInitial,
    peerName,
    peerToMine,
    peerToMineStage: relationStageLabel(peerToSpeakerRel, peerToMine),
    roomTitle,
    speakerName,
    visibleMems: [...roomMems, ...globalMems],
  };
}
