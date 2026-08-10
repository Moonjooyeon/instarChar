import React from "react";
import { DmAffinityPanel } from "@/app/dm/DmAffinityPanel";
import { DmControls } from "@/app/dm/DmControls";
import { DmMemoryPanel } from "@/app/dm/DmMemoryPanel";
import { DmMessages } from "@/app/dm/DmMessages";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";
import { CreditShortcut } from "@/features/credits/CreditShortcut";

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
    openCredits,
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
    <div className="al-phone al-theme-ready al-dm-thread al-dm-thread-theme-ready">
      <div className="al-dmhead">
        <button className="al-back-inline" aria-label="대화 목록으로" onClick={() => {
          const recentLines = dm.slice(-8).map((message) => ({ who: message.from, text: message.text }));
          if (!peer.readOnly && peer.asOwner) judgeSession(OWNER, state.peerName, recentLines);
          else if (!peer.readOnly && meName !== ownerLabel) processSession(meName, state.peerName, recentLines, false, dmKey);
          setStep("dmlist");
        }}><AliveIcon name="chevron-left" size={22} /></button>
        <div className="al-dmhead-av"><CharacterAvatarImage src={state.peerAvatar} /></div>
        <div className="al-dmhead-info">
          <span className="al-dmhead-name">{state.roomTitle}</span>
          <span className="al-dmhead-sub">{state.headSub}</span>
        </div>
        <CreditShortcut onOpen={openCredits} />
        {!peer.asOwner && !peer.readOnly && (
          <div className="al-dm-head-actions">
            <button className="al-dm-settings-btn border-line-strong bg-surface-raised text-accent-ink hover:border-accent hover:bg-accent-soft" onClick={ctx.openDmSettings}>장면 설정</button>
            <button className={`al-dm-settings-btn border-line-strong bg-surface-raised text-accent-ink hover:border-accent hover:bg-accent-soft ${showPeerMem ? "on border-accent bg-accent-soft" : ""}`} onClick={() => setShowPeerMem((value) => !value)}>기억 {state.visibleMems.length}</button>
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
  const peerAvatar = peer.asOwner ? char.avatarImg : peer.avatarImg;
  const speakerName = peer.readOnly && peer.legacySpeakerName ? peer.legacySpeakerName : (activePersona ? activePersona.name : char.name);
  const npcRoom = dmKey?.startsWith("local::");
  const dmKindLabel = peer.dmKind === "npc" ? "나만 보는 대화" : "함께 보는 대화";
  const headSub = peer.readOnly ? `${josa(speakerName, "으로/로")} 나눈 과거 대화 · 읽기 전용` : (peer.asOwner ? "내가 직접 대화 중" : `${josa(speakerName, "으로/로")} 대화 중 · ${dmKindLabel}`);
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
    peerAvatar,
    peerName,
    peerToMine,
    peerToMineStage: relationStageLabel(peerToSpeakerRel, peerToMine),
    roomTitle,
    speakerName,
    visibleMems: [...roomMems, ...globalMems],
  };
}
