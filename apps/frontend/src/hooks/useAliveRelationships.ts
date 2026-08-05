import { useState, type Dispatch, type SetStateAction } from "react";
import type { ProposalState, RelationEntry } from "@/domain/app/aliveCore";
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

type CharacterLike = {
  directions?: string;
  inner?: string;
  name?: string;
  persona?: string;
  relations?: string;
  situational?: string;
  speech?: string;
  warmth?: string;
  [key: string]: unknown;
};

type AccountLike = {
  char: CharacterLike;
};

export type RoomAffinityPref = {
  affinity?: Record<string, unknown>;
  affinityBase?: Record<string, unknown>;
  [key: string]: unknown;
};

type RepairPair = {
  from?: string;
  hint?: string;
  to?: string;
};

type RelationshipsOptions = {
  accounts: AccountLike[];
  char: CharacterLike;
  dmWorldPrefs: Record<string, RoomAffinityPref>;
  findPeerChar: (name: string) => CharacterLike | null;
  following: CharacterLike[];
  isPersonaName: (name: string) => boolean;
  parseRelations: (relations: string) => RelationEntry[];
  relationMatched: (char: CharacterLike, ident: { name: string; relation?: string }) => string;
  relationTargetMatches: (relation: RelationEntry, target: CharacterLike, strictSpecial?: boolean) => boolean;
  setDmWorldPrefs: Dispatch<SetStateAction<Record<string, RoomAffinityPref>>>;
};

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
}: RelationshipsOptions) {
  const [affinity, setAffinity] = useState<Record<string, number>>({});
  const [proposal, setProposal] = useState<ProposalState | null>(null);
  const [relationResult, setRelationResult] = useState<unknown>(null);
  const [affinityOpen, setAffinityOpen] = useState(false);
  const isOwnerName = (name: string): boolean => name === "나";
  function relationFor(fromChar: CharacterLike | string | null | undefined, toCharOrName: CharacterLike | string, strictSpecial = false): RelationEntry | null {
    const candidate = relationCandidate(fromChar, findPeerChar);
    if (!candidate?.relations) return null;
    const target = typeof toCharOrName === "string" ? { name: toCharOrName } : toCharOrName;
    return parseRelations(candidate.relations).find((relation) => relationTargetMatches(relation, target, strictSpecial)) || null;
  }
  function isFollowedCharacterName(name: string): boolean {
    return following.some((item) => relationTargetMatches({ who: name, label: "" }, item, true));
  }
  function canActivateSpecialRelation(fromName: string, toName: string): boolean {
    if (fromName === char.name) return isFollowedCharacterName(toName);
    if (toName === char.name) return isFollowedCharacterName(fromName);
    return isFollowedCharacterName(fromName) && isFollowedCharacterName(toName);
  }
  function relationBaseFor(fromName: string, toName: string): number | null {
    const source = fromName === char.name ? char : (findPeerChar(fromName) || null);
    const target = findPeerChar(toName) || { name: toName };
    const direct = relationBaseFromDirect(source, target, relationFor);
    if (direct != null) return direct;
    return relationBaseFromReverse(target, fromName, char, findPeerChar, relationFor);
  }
  function relLabelFor(fromChar: CharacterLike | string | null | undefined, toName: string): string {
    const target = findPeerChar(toName) || { name: toName };
    const hit = relationFor(fromChar, target, true);
    if (hit?.label) return hit.label;
    const reverseChar = target.name === char.name ? char : (findPeerChar(target.name) || null);
    const fromName = characterName(fromChar);
    const reverseHit = reverseChar?.relations ? relationFor(reverseChar, { name: fromName }, true) : null;
    if (reverseHit?.label && SYMMETRIC_RELATION_BASE.some(([matcher]) => matcher.test(reverseHit.label))) return reverseHit.label;
    return "";
  }
  function affOf(from: string, to: string): number {
    const key = dirKey(from, to);
    if (key in affinity) return affinity[key];
    const base = relationBaseFor(from, to);
    return base == null ? 0 : base;
  }
  function relationHintFor(fromName: string, toName: string, fallback = "", fromCharOverride: CharacterLike | null = null): string {
    const fromChar = fromCharOverride || (fromName === char.name ? char : (findPeerChar(fromName) || null));
    const direct = fromChar ? relationMatched(fromChar, { name: toName, relation: fallback }) : fallback;
    if (direct) return direct;
    const reverseChar = toName === char.name ? char : (findPeerChar(toName) || null);
    const reverseHit = reverseChar?.relations ? relationFor(reverseChar, { name: fromName }, true) : null;
    if (reverseHit?.label && SYMMETRIC_RELATION_BASE.some(([matcher]) => matcher.test(reverseHit.label))) return `${toName} — ${reverseHit.label}`;
    return fallback;
  }
  function dmAffOf(from: string, to: string, relationHint = ""): number {
    const key = dirKey(from, to);
    const directBase = relationBaseFor(from, to);
    const hintBase = relationBaseFromLabel(relationHint);
    const base = directBase ?? hintBase;
    if (key in affinity) return affinityWithBase(affinity[key], base);
    if (directBase != null) return directBase;
    return hintBase == null ? 0 : hintBase;
  }
  function roomInitialAffinity(from: string, to: string, relationHint = ""): number {
    const directBase = relationBaseFor(from, to);
    const hintBase = relationBaseFromLabel(relationHint);
    return directBase ?? hintBase ?? 0;
  }
  function roomAffOf(roomKey: string, from: string, to: string, relationHint = ""): number {
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
  function bumpRoomAffinity(roomKey: string, from: string, to: string, amount: number, relationHint = ""): void {
    if (!roomKey?.startsWith("local::") || !from || !to || from === to) return;
    setDmWorldPrefs((prev) => nextRoomAffinityPrefs(prev, roomKey, from, to, amount, relationHint, roomInitialAffinity));
  }
  function bumpRoomMutual(roomKey: string, a: string, b: string, amount: number, aToBHint = "", bToAHint = ""): void {
    const aPersona = isPersonaName(a);
    const bPersona = isPersonaName(b);
    const jitter = () => amount + Math.floor(Math.random() * 2 - 0.5);
    if (aPersona && !bPersona) { bumpRoomAffinity(roomKey, b, a, jitter(), bToAHint); return; }
    if (bPersona && !aPersona) { bumpRoomAffinity(roomKey, a, b, jitter(), aToBHint); return; }
    bumpRoomAffinity(roomKey, a, b, jitter(), aToBHint);
    bumpRoomAffinity(roomKey, b, a, jitter(), bToAHint);
  }
  function repairRoomAffinityBase(roomKey: string, pairs: RepairPair[]): void {
    if (!roomKey?.startsWith("local::") || !pairs?.length) return;
    setDmWorldPrefs((prev) => repairedRoomAffinityPrefs(prev, roomKey, pairs, roomInitialAffinity));
  }
  function myFollowers(): CharacterLike[] {
    return following.filter((item) => affOf(item.name, char.name) >= 15);
  }
  function followsCharacter(followerName: string, targetName: string): boolean {
    if (!followerName || !targetName) return false;
    if (followerName === targetName) return true;
    if (followerName === char.name) return following.some((item) => item.name === targetName);
    if (targetName === char.name) return myFollowers().some((item) => item.name === followerName);
    return false;
  }
  function canAutoComment(commenterName: string, postAuthorName: string): boolean {
    return followsCharacter(commenterName, postAuthorName);
  }
  function isMyOwnChar(name: string): boolean {
    if (isOwnerName(name) || isPersonaName(name)) return false;
    return name === char.name || accounts.some((account) => account.char.name === name);
  }
  function stageLabelFor(from: string, value: number): string {
    return isOwnerName(from) ? attachStage(value) : affinityStage(value);
  }
  return { affOf, affinity, affinityOpen, canActivateSpecialRelation, canAutoComment, dmAffOf, followsCharacter, isFollowedCharacterName, isMyOwnChar, isOwnerName, myFollowers, proposal, relationBaseFor, relationFor, relationHintFor, relationResult, relLabelFor, repairRoomAffinityBase, roomAffOf, roomInitialAffinity, bumpRoomAffinity, bumpRoomMutual, setAffinity, setAffinityOpen, setProposal, setRelationResult, stageLabelFor };
}

function relationCandidate(fromChar: CharacterLike | string | null | undefined, findPeerChar: (name: string) => CharacterLike | null): CharacterLike | null {
  if (fromChar && typeof fromChar === "object" && fromChar.relations) return fromChar;
  return findPeerChar(characterName(fromChar));
}

function characterName(value: CharacterLike | string | null | undefined): string {
  if (typeof value === "string") return value;
  return value?.name || "";
}

function relationBaseFromDirect(source: CharacterLike | null, target: CharacterLike, relationFor: (fromChar: CharacterLike, toCharOrName: CharacterLike, strictSpecial?: boolean) => RelationEntry | null): number | null {
  if (!source?.relations) return null;
  const hit = relationFor(source, target, true);
  if (!hit?.label) return null;
  const rule = RELATION_BASE.find(([matcher]) => matcher.test(hit.label));
  return rule ? rule[1] : null;
}

function relationBaseFromReverse(
  target: CharacterLike,
  fromName: string,
  char: CharacterLike,
  findPeerChar: (name: string) => CharacterLike | null,
  relationFor: (fromChar: CharacterLike, toCharOrName: CharacterLike, strictSpecial?: boolean) => RelationEntry | null,
): number | null {
  const reverseChar = target.name === char.name ? char : (findPeerChar(target.name) || null);
  if (!reverseChar?.relations) return null;
  const reverseHit = relationFor(reverseChar, { name: fromName }, true);
  if (!reverseHit?.label) return null;
  const rule = SYMMETRIC_RELATION_BASE.find(([matcher]) => matcher.test(reverseHit.label));
  return rule ? rule[1] : null;
}

function nextRoomAffinityPrefs(
  prev: Record<string, RoomAffinityPref>,
  roomKey: string,
  from: string,
  to: string,
  amount: number,
  relationHint: string,
  roomInitialAffinity: (from: string, to: string, relationHint?: string) => number,
): Record<string, RoomAffinityPref> {
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

function repairedRoomAffinityPrefs(
  prev: Record<string, RoomAffinityPref>,
  roomKey: string,
  pairs: RepairPair[],
  roomInitialAffinity: (from: string, to: string, relationHint?: string) => number,
): Record<string, RoomAffinityPref> {
  const pref = prev[roomKey] || {};
  const nextBase = { ...(pref.affinityBase || {}) };
  const nextAffinity = { ...(pref.affinity || {}) };
  const changed = repairPairRomanceBase(nextBase, nextAffinity, pairs) || repairPairLiveBase(nextBase, nextAffinity, pairs, roomInitialAffinity);
  if (!changed) return prev;
  return { ...prev, [roomKey]: { ...pref, affinityBase: nextBase, affinity: nextAffinity } };
}

function repairPairRomanceBase(nextBase: Record<string, unknown>, nextAffinity: Record<string, unknown>, pairs: RepairPair[]): boolean {
  let changed = false;
  const pairLive = pairs.map(({ from, to, hint = "" }) => ({ from, to, key: dirKey(from, to), symmetricBase: symmetricRelationBaseFromLabel(hint) })).filter(({ from, to }) => from && to && from !== to);
  const pairRomanticBase = Math.max(0, ...pairLive.map(({ symmetricBase }) => symmetricBase || 0));
  if (pairRomanticBase < 90) return false;
  pairLive.forEach(({ key }) => {
    const base = finiteNumber(nextBase[key], null);
    if (base == null || base < pairRomanticBase) {
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

function repairPairLiveBase(
  nextBase: Record<string, unknown>,
  nextAffinity: Record<string, unknown>,
  pairs: RepairPair[],
  roomInitialAffinity: (from: string, to: string, relationHint?: string) => number,
): boolean {
  let changed = false;
  pairs.forEach(({ from, to, hint = "" }) => {
    if (!from || !to || from === to) return;
    const key = dirKey(from, to);
    const liveBase = roomInitialAffinity(from, to, hint);
    const base = finiteNumber(nextBase[key], null);
    if (liveBase >= 90 && (base == null || base < liveBase)) {
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
