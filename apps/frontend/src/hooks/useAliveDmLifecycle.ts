import { useEffect } from "react";
import {
  canonicalDmKey,
  makeLocalDmRoomId,
  roomKeyFromDmThreadKey,
} from "@/domain/dm/dmKeyUtils";
import { dirKey } from "@/domain/relationships/affinityUtils";
import { supabase } from "@/supabaseClient";

export function useAliveDmLifecycle({
  accounts,
  activePersona,
  affinityRemainderRef,
  char,
  currentWorldPref,
  deletedDmKeys,
  deletedDmKeysRef,
  dmKey,
  dmKeyFor,
  dmKeyRef,
  dmPrefDraft,
  dmRequestSeqRef,
  dmSending,
  dmSendingRef,
  dmThreads,
  dmThreadTitles,
  dmWorldDraft,
  dmWorldPrefs,
  exportAppState,
  findPeerChar,
  following,
  isOwnerName,
  isPersonaName,
  localDmKey,
  ownerLabel,
  peer,
  pendingDm,
  persistLocalSnapshot,
  proposalCooldownRef,
  relationHintFor,
  relationMatched,
  relLabelFor,
  repairRoomAffinityBase,
  roomInitialAffinity,
  saveAppStateSnapshot,
  session,
  setAffinity,
  setDeletedDmKeys,
  setDmPrefDraft,
  setDmSending,
  setDmSettingsOpen,
  setDmThreads,
  setDmThreadTitles,
  setDmWorldDraft,
  setDmWorldPrefs,
  setNewChatMode,
  setPeer,
  setPendingDm,
  setRelationLabelFor,
  setSpeakAs,
  setStep,
  speakAs,
  speakerNameFor,
  syncStructuredState,
  step,
}) {
  useEffect(() => {
    dmKeyRef.current = dmKey;
  }, [dmKey]);
  useEffect(() => {
    migrateLegacyDmThreads({ dmThreads, dmWorldPrefs, ownerLabel, setDmThreads, setDmWorldPrefs });
  }, [dmThreads, dmWorldPrefs]);
  useEffect(() => {
    dmSendingRef.current = dmSending;
  }, [dmSending]);
  useEffect(() => {
    repairLocalRoomAffinity({ activePersona, char, dmKey, findPeerChar, peer, relationHintFor, repairRoomAffinityBase, step });
  }, [step, dmKey, peer?.name, peer?.relation, char.name, char.relations, activePersona?.name, following, accounts]);
  useEffect(() => {
    if (step !== "dm" || !peer) {
      dmRequestSeqRef.current += 1;
      dmSendingRef.current = false;
      setDmSending(false);
    }
  }, [step, peer?.name, dmKey]);
  const setDmThread = (updater) => setDmThreads((prev) => {
    const cur = prev[dmKey] || [];
    const next = typeof updater === "function" ? updater(cur) : updater;
    return { ...prev, [dmKey]: next };
  });
  function enterDm(nextPeer, nextSpeakAs = speakAs) {
    const relationFromActive = nextPeer?.asOwner ? "" : relationMatched(char, { name: nextPeer?.name || "", relation: nextPeer?.relation || "" });
    const peerWithRelation = nextPeer?.asOwner ? nextPeer : { ...nextPeer, relation: nextPeer?.relation || relationFromActive };
    setSpeakAs(nextSpeakAs);
    setPeer(peerWithRelation);
    setPendingDm(null);
    setDmWorldDraft("");
    setNewChatMode(null);
    setStep("dm");
  }
  function requestDmEntry(nextPeer, nextSpeakAs = speakAs) {
    if (nextPeer?.asOwner || nextPeer?.dmKey) {
      enterDm(nextPeer, nextSpeakAs);
      return;
    }
    const key = dmKeyFor(nextPeer, nextSpeakAs);
    if (nextPeer?.dmKind && dmWorldPrefs[key]) {
      enterDm(nextPeer, nextSpeakAs);
      return;
    }
    setPendingDm({ peer: nextPeer, speakAs: nextSpeakAs, stage: "world" });
    setDmWorldDraft("");
  }
  function chooseDmWorldMode(mode) {
    if (!pendingDm) return;
    setPendingDm((p) => ({ ...p, mode, note: "", stage: mode === "bridge" ? "chatKind" : "note" }));
  }
  function finishDmWorldSetup(skipNote = false) {
    if (!pendingDm?.mode) return;
    setPendingDm((p) => ({ ...p, note: skipNote ? "" : dmWorldDraft.trim(), stage: "chatKind" }));
  }
  function finishDmChatKind(dmKind) {
    if (!pendingDm?.mode) return;
    const room = nextRoomState({ deletedDmKeys, dmKind, dmThreads, dmWorldPrefs, localDmKey, pendingDm, relationHintFor, roomInitialAffinity, speakerNameFor });
    deletedDmKeysRef.current = new Set(room.nextDeletedKeys);
    setDmThreads(room.nextThreads);
    setDmWorldPrefs(room.nextPrefs);
    setDeletedDmKeys(room.nextDeletedKeys);
    persistLocalSnapshot({ ...exportAppState(), dmThreads: room.nextThreads, dmWorldPrefs: room.nextPrefs, deletedDmKeys: room.nextDeletedKeys });
    enterDm(room.peerForRoom, pendingDm.speakAs);
  }
  function openDmSettings() {
    const pref = currentWorldPref || { mode: "bridge", note: "" };
    setDmPrefDraft({ mode: pref.mode || "bridge", note: pref.note || "" });
    setDmSettingsOpen(true);
  }
  function saveDmSettings() {
    if (!dmKey) return;
    const nextPrefs = {
      ...dmWorldPrefs,
      [dmKey]: { ...(dmWorldPrefs[dmKey] || {}), mode: dmPrefDraft.mode || "bridge", note: dmPrefDraft.note || "" },
    };
    setDmWorldPrefs((prev) => ({ ...prev, [dmKey]: nextPrefs[dmKey] }));
    persistLocalSnapshot({ ...exportAppState(), dmWorldPrefs: nextPrefs });
    setDmSettingsOpen(false);
  }
  function resetAffinityForDmThread(key) {
    resetDmAffinity({ affinityRemainderRef, char, findPeerChar, isOwnerName, isPersonaName, key, ownerLabel, proposalCooldownRef, relLabelFor, setAffinity, setRelationLabelFor });
  }
  async function deleteDmThread(key, event) {
    event?.stopPropagation();
    const nextState = deleteDmState({ deletedDmKeys, dmKeyRef, dmThreadTitles, dmThreads, dmWorldPrefs, key, resetAffinityForDmThread, setDeletedDmKeys, setDmThreadTitles, setDmThreads, setDmWorldPrefs, setPeer, setStep });
    deletedDmKeysRef.current = new Set(nextState.nextDeletedKeys);
    const nextSnapshot = { ...exportAppState(), ...nextState.snapshotPatch };
    if (supabase && session?.user) await deleteRemoteDmThread(key, session, nextSnapshot, syncStructuredState);
    await saveAppStateSnapshot(nextSnapshot);
  }
  return { chooseDmWorldMode, deleteDmThread, enterDm, finishDmChatKind, finishDmWorldSetup, openDmSettings, requestDmEntry, resetAffinityForDmThread, saveDmSettings, setDmThread };
}

function migrateLegacyDmThreads({ dmThreads, dmWorldPrefs, ownerLabel, setDmThreads, setDmWorldPrefs }) {
  const migratedThreads = { ...dmThreads };
  const migratedPrefs = { ...dmWorldPrefs };
  let changed = false;
  Object.entries(dmThreads).forEach(([key, messages]) => {
    if (key.startsWith("dm::") || key.startsWith("owner::") || key.startsWith("local::") || !key.includes("::")) return;
    const parts = roomKeyFromDmThreadKey(key).split("|");
    if (parts.length !== 2 || parts.includes(ownerLabel)) return;
    const nextKey = canonicalDmKey(parts[0], parts[1]);
    migratedThreads[nextKey] = [...(migratedThreads[nextKey] || []), ...(Array.isArray(messages) ? messages : [])];
    if (dmWorldPrefs[key] && !migratedPrefs[nextKey]) migratedPrefs[nextKey] = dmWorldPrefs[key];
    delete migratedThreads[key];
    delete migratedPrefs[key];
    changed = true;
  });
  if (!changed) return;
  setDmThreads(migratedThreads);
  setDmWorldPrefs(migratedPrefs);
}

function repairLocalRoomAffinity({ activePersona, char, dmKey, findPeerChar, peer, relationHintFor, repairRoomAffinityBase, step }) {
  if (step !== "dm" || !peer || !dmKey?.startsWith("local::")) return;
  const peerName = peer.asOwner ? char.name : peer.name;
  const speakerName = activePersona ? activePersona.name : char.name;
  const peerChar = peer.asOwner ? char : (findPeerChar(peer.name) || peer);
  const speakerToPeerRel = relationHintFor(speakerName, peerName, peer.relation || "");
  const peerToSpeakerRel = relationHintFor(peerName, speakerName, "", peerChar);
  repairRoomAffinityBase(dmKey, [
    { from: speakerName, to: peerName, hint: speakerToPeerRel },
    { from: peerName, to: speakerName, hint: peerToSpeakerRel },
  ]);
}

function nextRoomState({ deletedDmKeys, dmKind, dmThreads, dmWorldPrefs, localDmKey, pendingDm, relationHintFor, roomInitialAffinity, speakerNameFor }) {
  const roomId = dmKind === "npc" ? makeLocalDmRoomId() : "";
  const speakerName = speakerNameFor(pendingDm.speakAs);
  const key = dmKind === "npc" ? localDmKey(speakerName, pendingDm.peer.name, roomId) : canonicalDmKey(speakerName, pendingDm.peer.name);
  const roomAffinitySeed = roomAffinityForKind(dmKind, speakerName, pendingDm.peer, relationHintFor, roomInitialAffinity);
  return {
    nextDeletedKeys: deletedDmKeys.filter((deletedKey) => deletedKey !== key),
    nextPrefs: { ...dmWorldPrefs, [key]: roomPref(pendingDm, dmKind, roomAffinitySeed) },
    nextThreads: { ...dmThreads, [key]: dmThreads[key] || [] },
    peerForRoom: { ...pendingDm.peer, dmKind, ...(dmKind === "npc" ? { localRoomId: roomId, dmKey: key } : {}) },
  };
}

function roomAffinityForKind(dmKind, speakerName, peer, relationHintFor, roomInitialAffinity) {
  if (dmKind !== "npc") return null;
  const speakerToPeerRel = relationHintFor(speakerName, peer.name, peer.relation || "");
  const peerToSpeakerRel = relationHintFor(peer.name, speakerName, "", peer);
  return {
    [dirKey(speakerName, peer.name)]: roomInitialAffinity(speakerName, peer.name, speakerToPeerRel),
    [dirKey(peer.name, speakerName)]: roomInitialAffinity(peer.name, speakerName, peerToSpeakerRel),
  };
}

function roomPref(pendingDm, dmKind, roomAffinitySeed) {
  return {
    mode: pendingDm.mode,
    note: pendingDm.note || "",
    chatKind: dmKind,
    ...(roomAffinitySeed ? { affinityBase: roomAffinitySeed, affinity: roomAffinitySeed } : {}),
  };
}

function resetDmAffinity({ affinityRemainderRef, char, findPeerChar, isOwnerName, isPersonaName, key, ownerLabel, proposalCooldownRef, relLabelFor, setAffinity, setRelationLabelFor }) {
  if (key?.startsWith("local::")) return;
  const parts = roomKeyFromDmThreadKey(key).split("|").filter(Boolean);
  if (parts.length !== 2) return;
  const pairs = ownerPairs(parts, ownerLabel);
  setAffinity((prev) => {
    const next = { ...prev };
    pairs.forEach(([from, to]) => {
      delete next[dirKey(from, to)];
      delete affinityRemainderRef.current[dirKey(from, to)];
    });
    return next;
  });
  pairs.forEach(([from, to]) => resetRelationLabel({ char, findPeerChar, from, isOwnerName, isPersonaName, relLabelFor, setRelationLabelFor, to }));
  proposalCooldownRef.current = Object.fromEntries(Object.entries(proposalCooldownRef.current || {}).filter(([pairKey]) => !pairs.some(([from, to]) => pairKey === dirKey(from, to))));
}

function ownerPairs(parts, ownerLabel) {
  const [a, b] = parts;
  return [
    [a === ownerLabel ? ownerLabel : a, b === ownerLabel ? ownerLabel : b],
    [b === ownerLabel ? ownerLabel : b, a === ownerLabel ? ownerLabel : a],
  ];
}

function resetRelationLabel({ char, findPeerChar, from, isOwnerName, isPersonaName, relLabelFor, setRelationLabelFor, to }) {
  if (isOwnerName(from) || isOwnerName(to) || isPersonaName(from)) return;
  const current = relLabelFor(findPeerChar(from) || (from === char.name ? char : { name: from }), to);
  if (/서운함|미움|혐오|증오|관심|호감|아는 사이/.test(current || "")) setRelationLabelFor(from, to, "아는 사이");
}

function deleteDmState({ deletedDmKeys, dmKeyRef, dmThreadTitles, dmThreads, dmWorldPrefs, key, resetAffinityForDmThread, setDeletedDmKeys, setDmThreadTitles, setDmThreads, setDmWorldPrefs, setPeer, setStep }) {
  const nextDeletedKeys = [...new Set([...deletedDmKeys, key])];
  setDeletedDmKeys(nextDeletedKeys);
  resetAffinityForDmThread(key);
  const nextThreads = { ...dmThreads };
  const nextPrefs = { ...dmWorldPrefs };
  const nextTitles = { ...dmThreadTitles };
  delete nextThreads[key];
  delete nextPrefs[key];
  delete nextTitles[key];
  setDmThreads(nextThreads);
  setDmWorldPrefs(nextPrefs);
  setDmThreadTitles(nextTitles);
  if (dmKeyRef.current === key) {
    setPeer(null);
    setStep("dmlist");
  }
  return { nextDeletedKeys, snapshotPatch: { dmThreads: nextThreads, dmWorldPrefs: nextPrefs, dmThreadTitles: nextTitles, deletedDmKeys: nextDeletedKeys } };
}

async function deleteRemoteDmThread(key, session, nextSnapshot, syncStructuredState) {
  const table = key.startsWith("dm::") ? "alive_shared_dm_threads" : "alive_dm_threads";
  let query = supabase.from(table).delete().eq("thread_key", key);
  if (table === "alive_dm_threads") query = query.eq("owner_id", session.user.id);
  const { error } = await query;
  if (error) console.warn("DM방 삭제 동기화 실패:", error);
  await syncStructuredState(nextSnapshot);
}
