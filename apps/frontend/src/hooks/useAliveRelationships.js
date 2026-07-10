import { useState } from "react";
import {
  RELATION_BASE,
  SYMMETRIC_RELATION_BASE,
  affinityStage,
  affinityWithBase,
  attachStage,
  dirKey,
  finiteNumber,
  relationBaseFromLabel,
  symmetricRelationBaseFromLabel,
} from "@/domain/relationships/affinityUtils";

export function useAliveRelationships({
  accounts,
  char,
  dmWorldPrefs,
  findPeerChar,
  following,
  isPersonaName,
  parseRelations,
  relationMatched,
  relationTargetMatches,
  setDmWorldPrefs,
}) {
  const [affinity, setAffinity] = useState({});
  const [proposal, setProposal] = useState(null);
  const [relationResult, setRelationResult] = useState(null);
  const [affinityOpen, setAffinityOpen] = useState(false);
  const isOwnerName = (name) => name === "나";
  function relationFor(fromChar, toCharOrName, strictSpecial = false) {
    const candidate = fromChar && fromChar.relations ? fromChar : findPeerChar(fromChar?.name || fromChar);
    if (!candidate?.relations) return null;
    const target = typeof toCharOrName === "string" ? { name: toCharOrName } : toCharOrName;
    return parseRelations(candidate.relations).find((relation) => relationTargetMatches(relation, target, strictSpecial)) || null;
  }
  function isFollowedCharacterName(name) {
    return following.some((item) => relationTargetMatches({ who: name, label: "" }, item, true));
  }
  function canActivateSpecialRelation(fromName, toName) {
    if (fromName === char.name) return isFollowedCharacterName(toName);
    if (toName === char.name) return isFollowedCharacterName(fromName);
    return isFollowedCharacterName(fromName) && isFollowedCharacterName(toName);
  }
  function relationBaseFor(fromName, toName) {
    const source = fromName === char.name ? char : (findPeerChar(fromName) || null);
    const target = findPeerChar(toName) || { name: toName };
    const direct = relationBaseFromDirect(source, target, relationFor);
    if (direct != null) return direct;
    return relationBaseFromReverse(target, fromName, char, findPeerChar, relationFor);
  }
  function relLabelFor(fromChar, toName) {
    const target = findPeerChar(toName) || { name: toName };
    const hit = relationFor(fromChar, target, true);
    if (hit?.label) return hit.label;
    const reverseChar = target.name === char.name ? char : (findPeerChar(target.name) || null);
    const fromName = fromChar?.name || fromChar;
    const reverseHit = reverseChar?.relations ? relationFor(reverseChar, { name: fromName }, true) : null;
    if (reverseHit?.label && SYMMETRIC_RELATION_BASE.some(([matcher]) => matcher.test(reverseHit.label))) return reverseHit.label;
    return "";
  }
  function affOf(from, to) {
    const key = dirKey(from, to);
    if (key in affinity) return affinity[key];
    const base = relationBaseFor(from, to);
    return base == null ? 0 : base;
  }
  function relationHintFor(fromName, toName, fallback = "", fromCharOverride = null) {
    const fromChar = fromCharOverride || (fromName === char.name ? char : (findPeerChar(fromName) || null));
    const direct = fromChar ? relationMatched(fromChar, { name: toName, relation: fallback }) : fallback;
    if (direct) return direct;
    const reverseChar = toName === char.name ? char : (findPeerChar(toName) || null);
    const reverseHit = reverseChar?.relations ? relationFor(reverseChar, { name: fromName }, true) : null;
    if (reverseHit?.label && SYMMETRIC_RELATION_BASE.some(([matcher]) => matcher.test(reverseHit.label))) return `${toName} — ${reverseHit.label}`;
    return fallback;
  }
  function dmAffOf(from, to, relationHint = "") {
    const key = dirKey(from, to);
    const directBase = relationBaseFor(from, to);
    const hintBase = relationBaseFromLabel(relationHint);
    const base = directBase ?? hintBase;
    if (key in affinity) return affinityWithBase(affinity[key], base);
    if (directBase != null) return directBase;
    return hintBase == null ? 0 : hintBase;
  }
  function roomInitialAffinity(from, to, relationHint = "") {
    const directBase = relationBaseFor(from, to);
    const hintBase = relationBaseFromLabel(relationHint);
    return directBase ?? hintBase ?? 0;
  }
  function roomAffOf(roomKey, from, to, relationHint = "") {
    if (!roomKey?.startsWith("local::")) return dmAffOf(from, to, relationHint);
    const key = dirKey(from, to);
    const pref = dmWorldPrefs[roomKey] || {};
    const liveBase = roomInitialAffinity(from, to, relationHint);
    const savedBase = finiteNumber(pref.affinityBase?.[key], null);
    const base = Math.max(savedBase == null ? liveBase : savedBase, liveBase);
    if (pref.affinity && key in pref.affinity) {
      const stored = finiteNumber(pref.affinity[key], 0);
      return Math.max(-100, Math.min(100, affinityWithBase(stored, base)));
    }
    return base;
  }
  function bumpRoomAffinity(roomKey, from, to, amount, relationHint = "") {
    if (!roomKey?.startsWith("local::") || !from || !to || from === to) return;
    setDmWorldPrefs((prev) => nextRoomAffinityPrefs(prev, roomKey, from, to, amount, relationHint, roomInitialAffinity));
  }
  function bumpRoomMutual(roomKey, a, b, amount, aToBHint = "", bToAHint = "") {
    const aPersona = isPersonaName(a);
    const bPersona = isPersonaName(b);
    const jitter = () => amount + Math.floor(Math.random() * 2 - 0.5);
    if (aPersona && !bPersona) { bumpRoomAffinity(roomKey, b, a, jitter(), bToAHint); return; }
    if (bPersona && !aPersona) { bumpRoomAffinity(roomKey, a, b, jitter(), aToBHint); return; }
    bumpRoomAffinity(roomKey, a, b, jitter(), aToBHint);
    bumpRoomAffinity(roomKey, b, a, jitter(), bToAHint);
  }
  function repairRoomAffinityBase(roomKey, pairs) {
    if (!roomKey?.startsWith("local::") || !pairs?.length) return;
    setDmWorldPrefs((prev) => repairedRoomAffinityPrefs(prev, roomKey, pairs, roomInitialAffinity));
  }
  function myFollowers() {
    return following.filter((item) => affOf(item.name, char.name) >= 15);
  }
  function followsCharacter(followerName, targetName) {
    if (!followerName || !targetName) return false;
    if (followerName === targetName) return true;
    if (followerName === char.name) return following.some((item) => item.name === targetName);
    if (targetName === char.name) return myFollowers().some((item) => item.name === followerName);
    return false;
  }
  function canAutoComment(commenterName, postAuthorName) {
    return followsCharacter(commenterName, postAuthorName);
  }
  function isMyOwnChar(name) {
    if (isOwnerName(name) || isPersonaName(name)) return false;
    return name === char.name || accounts.some((account) => account.char.name === name);
  }
  function stageLabelFor(from, value) {
    return isOwnerName(from) ? attachStage(value) : affinityStage(value);
  }
  return { affOf, affinity, affinityOpen, canActivateSpecialRelation, canAutoComment, dmAffOf, followsCharacter, isMyOwnChar, isOwnerName, myFollowers, proposal, relationBaseFor, relationFor, relationHintFor, relationResult, relLabelFor, repairRoomAffinityBase, roomAffOf, roomInitialAffinity, bumpRoomAffinity, bumpRoomMutual, setAffinity, setAffinityOpen, setProposal, setRelationResult, stageLabelFor };
}

function relationBaseFromDirect(source, target, relationFor) {
  if (!source?.relations) return null;
  const hit = relationFor(source, target, true);
  if (!hit?.label) return null;
  const rule = RELATION_BASE.find(([matcher]) => matcher.test(hit.label));
  return rule ? rule[1] : null;
}

function relationBaseFromReverse(target, fromName, char, findPeerChar, relationFor) {
  const reverseChar = target.name === char.name ? char : (findPeerChar(target.name) || null);
  if (!reverseChar?.relations) return null;
  const reverseHit = relationFor(reverseChar, { name: fromName }, true);
  if (!reverseHit?.label) return null;
  const rule = SYMMETRIC_RELATION_BASE.find(([matcher]) => matcher.test(reverseHit.label));
  return rule ? rule[1] : null;
}

function nextRoomAffinityPrefs(prev, roomKey, from, to, amount, relationHint, roomInitialAffinity) {
  const key = dirKey(from, to);
  const pref = prev[roomKey] || {};
  const roomAffinity = pref.affinity || {};
  const liveBase = roomInitialAffinity(from, to, relationHint);
  const savedBase = finiteNumber(pref.affinityBase?.[key], null);
  const base = Math.max(savedBase == null ? liveBase : savedBase, liveBase);
  const stored = finiteNumber(roomAffinity[key], null);
  const before = key in roomAffinity ? Math.max(-100, Math.min(100, affinityWithBase(stored, base))) : base;
  const after = Math.max(-100, Math.min(100, before + amount));
  return { ...prev, [roomKey]: { ...pref, affinityBase: { ...(pref.affinityBase || {}), [key]: base }, affinity: { ...roomAffinity, [key]: after } } };
}

function repairedRoomAffinityPrefs(prev, roomKey, pairs, roomInitialAffinity) {
  const pref = prev[roomKey] || {};
  const nextBase = { ...(pref.affinityBase || {}) };
  const nextAffinity = { ...(pref.affinity || {}) };
  const changed = repairPairRomanceBase(nextBase, nextAffinity, pairs) || repairPairLiveBase(nextBase, nextAffinity, pairs, roomInitialAffinity);
  if (!changed) return prev;
  return { ...prev, [roomKey]: { ...pref, affinityBase: nextBase, affinity: nextAffinity } };
}

function repairPairRomanceBase(nextBase, nextAffinity, pairs) {
  let changed = false;
  const pairLive = pairs.map(({ from, to, hint = "" }) => ({ from, to, key: dirKey(from, to), symmetricBase: symmetricRelationBaseFromLabel(hint) })).filter(({ from, to }) => from && to && from !== to);
  const pairRomanticBase = Math.max(0, ...pairLive.map(({ symmetricBase }) => symmetricBase || 0));
  if (pairRomanticBase < 90) return false;
  pairLive.forEach(({ key }) => {
    if (nextBase[key] == null || nextBase[key] < pairRomanticBase) {
      nextBase[key] = pairRomanticBase;
      changed = true;
    }
    const stored = finiteNumber(nextAffinity[key], null);
    if (stored == null || (stored >= 0 && stored < pairRomanticBase)) {
      nextAffinity[key] = pairRomanticBase;
      changed = true;
    }
  });
  return changed;
}

function repairPairLiveBase(nextBase, nextAffinity, pairs, roomInitialAffinity) {
  let changed = false;
  pairs.forEach(({ from, to, hint = "" }) => {
    if (!from || !to || from === to) return;
    const key = dirKey(from, to);
    const liveBase = roomInitialAffinity(from, to, hint);
    if (liveBase >= 90 && (nextBase[key] == null || nextBase[key] < liveBase)) {
      nextBase[key] = liveBase;
      changed = true;
    }
    const stored = finiteNumber(nextAffinity[key], null);
    if (liveBase >= 90 && (stored == null || (stored >= 0 && stored < liveBase))) {
      nextAffinity[key] = liveBase;
      changed = true;
    }
  });
  return changed;
}
