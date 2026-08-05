import { postGenerateContent } from "@/api/generate";
import {
  MODEL_CHAT,
  MODEL_UTIL,
  josa,
  parseRelations,
  speechGuideLine,
  type ProposalState,
  type RelationEntry,
} from "@/domain/app/aliveCore";
import {
  affinityWithBase,
  dirKey,
  isLoveRelation,
  relationLabelFromAffinity,
} from "@/domain/relationships/affinityUtils";

const PROPOSAL_THRESHOLD = 60;
const RELATION_STEP: Record<string, string> = { "": "썸", "아는 사이": "썸", "친구": "썸", "썸": "연인", "짝사랑": "연인", "연인": "약혼", "약혼": "부부" };

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type MutableRef<T> = {
  current: T;
};

type CharacterLike = {
  directions?: string;
  inner?: string;
  name?: string;
  persona?: string;
  relations?: string;
  situational?: string;
  speech?: unknown;
  surface?: string;
  warmth?: string;
  [key: string]: unknown;
};

type AccountLike = {
  char: CharacterLike;
};

type RelationshipMutationsOptions = {
  accounts: AccountLike[];
  affOf: (from: string, to: string) => number;
  affinityRemainderRef: MutableRef<Record<string, number>>;
  char: CharacterLike;
  findPeerChar: (name: string) => CharacterLike | null;
  following: CharacterLike[];
  isOwnerName: (name: string) => boolean;
  isPersonaName: (name: string) => boolean;
  personas: CharacterLike[];
  proposal: ProposalState | null;
  proposalCooldownRef: MutableRef<Record<string, boolean>>;
  proposingRef: MutableRef<boolean>;
  relationBaseFor: (from: string, to: string) => number | null | undefined;
  relationMatched: (char: CharacterLike, ident: { name: string; relation?: string }) => string;
  relLabelFor: (fromChar: unknown, toName: string) => string;
  setAccounts: SetState<AccountLike[]>;
  setAffinity: SetState<Record<string, number>>;
  setChar: SetState<CharacterLike>;
  setFollowing: SetState<CharacterLike[]>;
  setProposal: (value: unknown) => void;
  setRelationResult: (value: unknown) => void;
  update: (key: string, value: unknown) => void;
};

export function useAliveRelationshipMutations({
  accounts,
  affOf,
  affinityRemainderRef,
  char,
  findPeerChar,
  following,
  isOwnerName,
  isPersonaName,
  personas,
  proposal,
  proposalCooldownRef,
  proposingRef,
  relationBaseFor,
  relationMatched,
  relLabelFor,
  setAccounts,
  setAffinity,
  setChar,
  setFollowing,
  setProposal,
  setRelationResult,
  update,
}: RelationshipMutationsOptions) {
  function normalizedRelationLabelFor(fromName: string, otherName: string, current = ""): string {
    const value = affOf(fromName, otherName);
    const counterpart = relLabelFor(findPeerChar(otherName) || { name: otherName }, fromName);
    if (/서운함|미움|혐오|증오|관심|호감|아는 사이/.test(current || "") && value >= 35 && /연인|애인|연애|사랑|부부|배우자|약혼|반려/.test(counterpart || "")) return counterpart;
    return relationLabelFromAffinity(value, current);
  }
  function setRelationLabelFor(fromName: string, otherName: string, label: string): void {
    if (!fromName || !otherName || isOwnerName(fromName) || isPersonaName(fromName)) return;
    const apply = relationLabelApplier(otherName, label);
    if (char.name === fromName) setChar((c) => apply(c));
    setAccounts((accs) => accs.map((a) => a.char.name === fromName ? { ...a, char: apply(a.char) } : a));
    setFollowing((items) => items.map((f) => f.name === fromName ? apply(f) : f));
  }
  function deleteRelationAt(index: number): void {
    const rels = parseRelations(char.relations);
    const target = rels[index];
    update("relations", relationListWithoutIndex(rels, index));
    if (!target?.who) return;
    clearDeletedRelation(target.who);
  }
  function normalizeRelationLabelsForChar(targetChar: CharacterLike): CharacterLike {
    if (!targetChar?.relations) return targetChar;
    let changed = false;
    const next = parseRelations(targetChar.relations).map((relation) => {
      const label = normalizedRelationLabelFor(targetChar.name, relation.who, relation.label);
      if (label !== relation.label) changed = true;
      return { ...relation, label };
    });
    if (!changed) return targetChar;
    return { ...targetChar, relations: relationText(next) };
  }
  function bumpAffinity(from: string, to: string, amount: number, ctxLines: string[]): void {
    if (!from || !to || from === to) return;
    const key = dirKey(from, to);
    const adjusted = adjustedAffinityAmount({ amount, affinityRemainderRef, from, isOwnerName, isPersonaName, key, warmthRate });
    if (adjusted == null) return;
    const seed = relationBaseFor(from, to);
    setAffinity((prev) => nextAffinityState({ char, ctxLines, findPeerChar, from, key, proposalCooldownRef, proposingRef, relLabelFor, seed, setRelationLabelFor, to, triggerProposal, value: adjusted, prev }));
  }
  function setAffinityManual(from: string, to: string, value: unknown): void {
    if (!from || !to || from === to) return;
    const nextValue = Math.max(-100, Math.min(100, Number(value) || 0));
    setAffinity((prev) => ({ ...prev, [dirKey(from, to)]: nextValue }));
    const currentRel = relLabelFor(findPeerChar(from) || (from === char.name ? char : { name: from }), to);
    const nextRel = relationLabelFromAffinity(nextValue, currentRel);
    if (nextRel !== currentRel) setRelationLabelFor(from, to, nextRel);
  }
  function bumpMutual(a: string, b: string, amount: number, ctx: string[]): void {
    const aPersona = isPersonaName(a);
    const bPersona = isPersonaName(b);
    const jitter = () => amount + Math.floor(Math.random() * 2 - 0.5);
    if (aPersona && !bPersona) { bumpAffinity(b, a, jitter(), ctx); return; }
    if (bPersona && !aPersona) { bumpAffinity(a, b, jitter(), ctx); return; }
    bumpAffinity(a, b, jitter(), ctx);
    bumpAffinity(b, a, jitter(), ctx);
  }
  async function triggerProposal(askerName: string, otherName: string): Promise<void> {
    const askerChar = askerCharacter({ accounts, askerName, char, personas });
    const key = dirKey(askerName, otherName);
    const curRel = relationMatched(askerChar, { name: otherName });
    const sys = proposalSystemPrompt({ askerChar, askerName, curRel, otherName });
    let line = `나, ${josa(otherName, "이/가")} 좋아진 것 같아요. 좋아해도 될까요?`;
    try {
      const text = (await postGenerateContent({ model: MODEL_CHAT, max_tokens: 200, system: sys, messages: [{ role: "user", content: `(${askerName}가 오너에게 ${otherName}에 대한 마음을 털어놓으며 허락을 구한다.)` }] }, "관계 제안 API")).trim();
      if (text) line = text.replace(/^["'""']|["'""']$/g, "");
    } catch (error) {
      // 기본 멘트 사용
    }
    setProposal({ asker: askerName, other: otherName, line, pairKey: key });
    proposingRef.current = false;
  }
  function nextRelationLabel(askerName: string, otherName: string): string {
    const targetChar = findPeerChar(askerName) || char;
    const current = relLabelFor(targetChar, otherName);
    return RELATION_STEP[current] || "연인";
  }
  async function resolveProposal(approve: boolean): Promise<void> {
    if (!proposal) return;
    const { asker, other, pairKey } = proposal;
    proposalCooldownRef.current[pairKey] = true;
    setProposal(null);
    if (!approve) {
      setAffinity((prev) => ({ ...prev, [pairKey]: 45 }));
      return;
    }
    const nextLabel = nextRelationLabel(asker, other);
    if (!isLoveRelation(nextLabel)) {
      acceptFriendshipProposal({ asker, other, setAffinity, setRelationResult, advanceRelation });
      return;
    }
    const accepted = await judgeAcceptance(asker, other);
    if (accepted) acceptLoveProposal({ asker, other, setAffinity, setRelationResult, advanceRelation });
    else rejectLoveProposal({ asker, other, pairKey, setAffinity, setRelationResult, setRelationToLove });
  }
  async function judgeAcceptance(askerName: string, otherName: string): Promise<boolean> {
    const otherChar = findPeerChar(otherName);
    const back = affOf(otherName, askerName);
    try {
      const raw = (await postGenerateContent({ model: MODEL_UTIL, max_tokens: 10, system: acceptancePrompt({ askerName, back, otherChar, otherName }), messages: [{ role: "user", content: "판정:" }] }, "관계 판정 API")).toUpperCase();
      return raw.includes("ACCEPT");
    } catch (error) {
      return back >= 50;
    }
  }
  function setRelationToLove(askerName: string, otherName: string, label: string): void {
    const apply = relationLabelApplier(otherName, label, true);
    if (char.name === askerName) setChar((c) => apply(c));
    setAccounts((accs) => accs.map((a) => a.char.name === askerName ? { ...a, char: apply(a.char) } : a));
  }
  function advanceRelation(askerName: string, otherName: string): void {
    const apply = relationAdvancer(otherName);
    if (char.name === askerName) setChar((c) => apply(c));
    setAccounts((accs) => accs.map((a) => a.char.name === askerName ? { ...a, char: apply(a.char) } : a));
  }
  function warmthRate(name: string): number {
    const targetChar = name === char.name ? char : (findPeerChar(name) || null);
    const warmth = targetChar && targetChar.warmth;
    const profileText = targetChar ? [targetChar.persona, targetChar.surface, targetChar.inner, targetChar.situational, targetChar.speech, targetChar.directions].filter(Boolean).join(" ") : "";
    if (warmth === "slow") return 0.25;
    if (/무뚝뚝|느린|느리게|경계심|철벽|낯가림|까칠|무심|냉담|배타/.test(profileText)) return 0.25;
    if (warmth === "fast") return 1.5;
    return 1;
  }
  function clearDeletedRelation(otherName: string): void {
    setAffinity((prev) => {
      const next = { ...prev };
      delete next[dirKey(char.name, otherName)];
      delete next[dirKey(otherName, char.name)];
      return next;
    });
    const withoutTarget = (targetChar) => withoutTargetRelation(targetChar, char.name);
    setAccounts((accs) => accs.map((account) => account.char.name === otherName ? { ...account, char: withoutTarget(account.char) } : account));
    setFollowing((items) => items.map((item) => item.name === otherName ? withoutTarget(item) : item));
  }
  return { advanceRelation, bumpAffinity, bumpMutual, deleteRelationAt, judgeAcceptance, nextRelationLabel, normalizeRelationLabelsForChar, normalizedRelationLabelFor, resolveProposal, setAffinityManual, setRelationLabelFor, setRelationToLove, triggerProposal };
}

function relationLabelApplier(otherName: string, label: string, alwaysPush = false): (targetChar: CharacterLike) => CharacterLike {
  const norm = (value: string): string => value.replace(/\s/g, "");
  return (targetChar: CharacterLike): CharacterLike => {
    const rels = parseRelations(targetChar.relations);
    let found = false;
    const next = rels.map((relation) => {
      if (norm(relation.who).includes(norm(otherName)) || norm(otherName).includes(norm(relation.who))) {
        found = true;
        return { who: otherName, label };
      }
      return relation;
    });
    if ((!found && label) || (!found && alwaysPush)) next.push({ who: otherName, label });
    return { ...targetChar, relations: relationText(next) };
  };
}

function relationAdvancer(otherName: string): (targetChar: CharacterLike) => CharacterLike {
  const norm = (value: string): string => value.replace(/\s/g, "");
  return (targetChar: CharacterLike): CharacterLike => {
    const rels = parseRelations(targetChar.relations);
    let found = false;
    const next = rels.map((relation) => {
      if (norm(relation.who).includes(norm(otherName)) || norm(otherName).includes(norm(relation.who))) {
        found = true;
        return { who: otherName, label: RELATION_STEP[relation.label] || "연인" };
      }
      return relation;
    });
    if (!found) next.push({ who: otherName, label: "썸" });
    return { ...targetChar, relations: relationText(next) };
  };
}

function relationListWithoutIndex(rels: RelationEntry[], index: number): string {
  return relationText(rels.filter((_, itemIndex) => itemIndex !== index));
}

function relationText(rels: RelationEntry[]): string {
  return rels.filter((relation) => relation.who && relation.label).map((relation) => `${relation.who} — ${relation.label}`).join(", ");
}

function withoutTargetRelation(targetChar: CharacterLike, otherName: string): CharacterLike {
  const next = parseRelations(targetChar.relations).filter((relation) => {
    const who = String(relation.who || "").replace(/\s/g, "");
    const other = String(otherName || "").replace(/\s/g, "");
    return !(who && other && (who.includes(other) || other.includes(who)));
  });
  return { ...targetChar, relations: relationText(next) };
}

function adjustedAffinityAmount(options: {
  amount: number;
  affinityRemainderRef: MutableRef<Record<string, number>>;
  from: string;
  isOwnerName: (name: string) => boolean;
  isPersonaName: (name: string) => boolean;
  key: string;
  warmthRate: (name: string) => number;
}): number | null {
  const { amount, affinityRemainderRef, from, isOwnerName, isPersonaName, key, warmthRate } = options;
  if (amount <= 0 || isPersonaName(from) || isOwnerName(from)) return amount;
  const scaled = amount * warmthRate(from);
  if (scaled >= 1) return Math.max(1, Math.round(scaled));
  const total = (affinityRemainderRef.current[key] || 0) + scaled;
  const adjusted = Math.floor(total);
  affinityRemainderRef.current[key] = total - adjusted;
  return adjusted <= 0 ? null : adjusted;
}

function nextAffinityState(options: {
  char: CharacterLike;
  ctxLines: string[];
  findPeerChar: (name: string) => CharacterLike | null;
  from: string;
  key: string;
  prev: Record<string, number>;
  proposalCooldownRef: MutableRef<Record<string, boolean>>;
  proposingRef: MutableRef<boolean>;
  relLabelFor: (fromChar: CharacterLike, toName: string) => string;
  seed: number | null | undefined;
  setRelationLabelFor: (fromName: string, otherName: string, label: string) => void;
  to: string;
  triggerProposal: (askerName: string, otherName: string, ctxLines?: string[]) => void;
  value: number;
}): Record<string, number> {
  const { char, ctxLines, findPeerChar, from, key, prev, proposalCooldownRef, proposingRef, relLabelFor, seed, setRelationLabelFor, to, triggerProposal, value } = options;
  const before = affinityWithBase(key in prev ? prev[key] : null, seed);
  const after = Math.max(-100, Math.min(100, before + value));
  const currentRel = relLabelFor(findPeerChar(from) || (from === char.name ? char : { name: from }), to);
  const nextRel = relationLabelFromAffinity(after, currentRel);
  if (nextRel !== currentRel) setRelationLabelFor(from, to, nextRel);
  const fromIsViewerChar = from === char.name && to !== "나";
  if (fromIsViewerChar && before < PROPOSAL_THRESHOLD && after >= PROPOSAL_THRESHOLD && !proposalCooldownRef.current[key] && !proposingRef.current) {
    proposingRef.current = true;
    if (from && to && from !== to) triggerProposal(from, to, ctxLines || []);
    else proposingRef.current = false;
  }
  return { ...prev, [key]: after };
}

function askerCharacter({ accounts, askerName, char, personas }: { accounts: AccountLike[]; askerName: string; char: CharacterLike; personas: CharacterLike[] }): CharacterLike {
  const askerPersona = personas.find((persona) => persona.name === askerName);
  const askerAcc = accounts.find((account) => account.char.name === askerName);
  return askerPersona || (askerAcc ? askerAcc.char : char);
}

function proposalSystemPrompt({ askerChar, askerName, curRel, otherName }: { askerChar: CharacterLike; askerName: string; curRel: string; otherName: string }): string {
  return `너는 "${askerName}"이다. 너를 만든 오너(나)에게 말한다.
${askerChar.persona ? `너: ${askerChar.persona}` : ""}
${speechGuideLine(askerChar.speech, "말투")}

[상황]
너는 "${otherName}"와 대화를 나누며 마음이 점점 기울었다.${curRel ? ` (지금 관계: ${curRel})` : ""}
지금 그 감정을 오너에게 직접 털어놓고, "${otherName}"를 좋아해도 될지 허락을 구하려 한다.

[규칙]
- 반드시 "나, ${otherName}가/이 좋아진 것 같아요. 좋아해도 될까요?"에 가까운 의미로 말한다.
- "한 걸음 다가가다", "다가가려 합니다", "관계 진전", "허락을 구한다" 같은 설명식 표현 금지.
- 1~2문장. 말투 참고 메모를 그대로 반복하지 말고, 네 성격에 맞게 수줍거나 솔직하게.
- 오너에게 묻는 말투("좋아해도 될까요?" "좋아해도 돼?"). 설명·메타발언 금지.
- "${otherName}"의 이름을 자연스럽게 넣어라.
- 본문만 출력.`;
}

function acceptFriendshipProposal({ asker, other, setAffinity, setRelationResult, advanceRelation }: {
  advanceRelation: (askerName: string, otherName: string) => void;
  asker: string;
  other: string;
  setAffinity: SetState<Record<string, number>>;
  setRelationResult: (value: unknown) => void;
}): void {
  setAffinity((prev) => ({ ...prev, [dirKey(asker, other)]: Math.max(prev[dirKey(asker, other)] || 0, 70), [dirKey(other, asker)]: Math.max(prev[dirKey(other, asker)] || 0, 55) }));
  advanceRelation(asker, other);
  advanceRelation(other, asker);
  setRelationResult({ asker, other, accepted: true, friendship: true });
}

function acceptLoveProposal({ asker, other, setAffinity, setRelationResult, advanceRelation }: {
  advanceRelation: (askerName: string, otherName: string) => void;
  asker: string;
  other: string;
  setAffinity: SetState<Record<string, number>>;
  setRelationResult: (value: unknown) => void;
}): void {
  setAffinity((prev) => ({ ...prev, [dirKey(asker, other)]: Math.max(prev[dirKey(asker, other)] || 0, 88), [dirKey(other, asker)]: Math.max(prev[dirKey(other, asker)] || 0, 80) }));
  advanceRelation(asker, other);
  advanceRelation(other, asker);
  setRelationResult({ asker, other, accepted: true });
}

function rejectLoveProposal({ asker, other, pairKey, setAffinity, setRelationResult, setRelationToLove }: {
  asker: string;
  other: string;
  pairKey: string;
  setAffinity: SetState<Record<string, number>>;
  setRelationResult: (value: unknown) => void;
  setRelationToLove: (askerName: string, otherName: string, label: string) => void;
}): void {
  setAffinity((prev) => ({ ...prev, [pairKey]: Math.max(35, (prev[pairKey] || 60) - 18) }));
  setRelationToLove(asker, other, "짝사랑");
  setRelationResult({ asker, other, accepted: false });
}

function acceptancePrompt({ askerName, back, otherChar, otherName }: { askerName: string; back: number; otherChar: CharacterLike | null; otherName: string }): string {
  return `"${otherName}"가 "${askerName}"에게 고백(또는 관계 진전 제안)을 받았다. 받아들일지 판정하라.
${otherChar && otherChar.persona ? `${otherName}: ${otherChar.persona}` : ""}
${otherChar && otherChar.relations ? `${otherName}의 관계망: ${otherChar.relations}` : ""}
- "${otherName}"가 "${askerName}"에게 느끼는 호감도: ${back} (100=순애, 60+=마음 기움, 30~=관심, 0=무관심, 음수=싫어함)
- 이 호감도와 성격을 고려해, 받아들이면 ACCEPT, 거절하면 REJECT만 출력.
- 호감도가 높으면(50+) 대체로 ACCEPT, 애매하면(20~50) 성격에 따라, 낮거나 음수면 REJECT 경향.
- ACCEPT 또는 REJECT 한 단어만.`;
}
