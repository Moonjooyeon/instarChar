import { useState } from "react";
import {
  canonicalDmKey,
  localRoomIdFromDmThreadKey,
  roomKeyFromDmThreadKey,
  scopedLocalDmKey,
} from "@/domain/dm/dmKeyUtils";
import type { RoomAffinityPref } from "@/hooks/useAliveRelationships";
import type { DmResponseFlow } from "@/domain/dm/dmResponseMode";

type DmCharacter = {
  name?: string;
};

type Persona = {
  id?: string | number;
  name: string;
};

type DmPeer = {
  asOwner?: boolean;
  dmKey?: string;
  dmKind?: string;
  legacySpeakerName?: string;
  localRoomId?: string;
  name?: string;
  readOnly?: boolean;
};

type DmMessage = {
  deliveryState?: string;
  text?: string;
  [key: string]: unknown;
};

type DmConversation = DmPeer & {
  asPersona?: string | null;
  count?: number;
  key: string;
  last?: string;
  peerName?: string;
};

type EditingDmTitle = {
  key: string;
  title: string;
};

type DmOptions = {
  activeId?: string | null;
  char: DmCharacter;
};

export function useAliveDm({ activeId, char }: DmOptions) {
  const [autoChatting, setAutoChatting] = useState(false);
  const [dmThreads, setDmThreads] = useState<Record<string, DmMessage[]>>({});
  const [dmWorldPrefs, setDmWorldPrefs] = useState<Record<string, RoomAffinityPref>>({});
  const [deletedDmKeys, setDeletedDmKeys] = useState<string[]>([]);
  const [pendingDm, setPendingDm] = useState<unknown>(null);
  const [dmWorldDraft, setDmWorldDraft] = useState("");
  const [dmSettingsOpen, setDmSettingsOpen] = useState(false);
  const [dmPrefDraft, setDmPrefDraft] = useState({ mode: "bridge", note: "" });
  const [peer, setPeer] = useState<DmPeer | null>(null);
  const [dmDrafts, setDmDrafts] = useState<Record<string, string>>({});
  const [dmSending, setDmSending] = useState(false);
  const [ownerPersona, setOwnerPersona] = useState("");
  const [speakAs, setSpeakAs] = useState("char");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaDraft, setPersonaDraft] = useState<unknown>(null);
  const [newChatSpeaker, setNewChatSpeaker] = useState("char");
  const [newChatMode, setNewChatMode] = useState<string | null>(null);
  const [dmThreadTitles, setDmThreadTitles] = useState<Record<string, string>>({});
  const [editingDmTitle, setEditingDmTitle] = useState<EditingDmTitle | null>(null);
  const [chatMode, setChatMode] = useState("talk");
  const [dmResponseFlows, setDmResponseFlows] = useState<Record<string, DmResponseFlow>>({});
  const ownerLabel = "나";
  const activePersona = speakAs.startsWith("p:") ? personas.find((persona) => `p:${persona.id}` === speakAs) : null;
  const ownerSpeaking = speakAs === "owner";
  const meName = peer ? currentSpeakerName(peer, activePersona, ownerSpeaking, ownerLabel, char) : (char.name || "나");
  const dmKey = peer ? dmKeyFor(peer, speakAs) : "";
  const dmInput = dmKey ? dmDrafts[dmKey] || "" : "";
  const dmResponseFlow = dmResponseFlows[dmKey] || "direct_dm_basic";
  const currentWorldPref = dmKey ? dmWorldPrefs[dmKey] : null;
  const dm = (peer && dmThreads[dmKey]) || [];
  function setDmResponseFlow(flow: DmResponseFlow): void {
    if (!dmKey) return;
    setDmResponseFlows((flows) => ({ ...flows, [dmKey]: flow }));
  }
  function setDmInput(value: string): void {
    if (!dmKey) return;
    setDmDrafts((drafts) => ({ ...drafts, [dmKey]: value }));
  }
  function defaultDmTitle(conv: DmConversation | null | undefined): string {
    if (!conv) return "대화방";
    if (conv.asOwner) return `${char.name} · 나(오너)와`;
    if (conv.asPersona) return `${conv.peerName} · ${conv.asPersona}로`;
    return conv.peerName || "대화방";
  }
  function displayDmTitle(conv: DmConversation): string {
    return dmThreadTitles[conv.key] || defaultDmTitle(conv);
  }
  function startRenameDm(conv: DmConversation, event?: { stopPropagation: () => void }): void {
    event?.stopPropagation();
    setEditingDmTitle({ key: conv.key, title: displayDmTitle(conv) });
  }
  function saveRenameDm(): void {
    if (!editingDmTitle) return;
    const title = editingDmTitle.title.trim();
    setDmThreadTitles((prev) => nextThreadTitles(prev, editingDmTitle.key, title));
    setEditingDmTitle(null);
  }
  function deletePersona(id: string | number, commentAs: string, setCommentAs: (value: string) => void): void {
    setPersonas((items) => items.filter((item) => item.id !== id));
    if (speakAs === `p:${id}`) setSpeakAs("char");
    if (commentAs === `p:${id}`) setCommentAs("char");
    if (newChatSpeaker === `p:${id}`) setNewChatSpeaker("char");
  }
  function speakerNameFor(speakerValue = speakAs): string {
    const persona = String(speakerValue || "").startsWith("p:") ? personas.find((item) => `p:${item.id}` === speakerValue) : null;
    if (persona) return persona.name;
    if (speakerValue === "owner") return ownerLabel;
    return char.name || "나";
  }
  function localDmKey(a: string, b: string, roomId = ""): string {
    return scopedLocalDmKey(activeId || char.name || "new", a, b, roomId);
  }
  function ownerDmKey(): string {
    return `owner::${activeId || char.name || "new"}::${ownerLabel}|${char.name || "나"}`;
  }
  function dmKeyFor(peerObj: DmPeer | null, speakerValue = speakAs): string {
    if (!peerObj) return "";
    if (peerObj.asOwner) return ownerDmKey();
    if (peerObj.dmKey) return peerObj.dmKey;
    if (peerObj.dmKind === "npc") return localDmKey(speakerNameFor(speakerValue), peerObj.name || "", peerObj.localRoomId || "");
    return canonicalDmKey(speakerNameFor(speakerValue), peerObj.name || "");
  }
  function myConversations(): DmConversation[] {
    const me = char.name || "나";
    const myNames = new Set([me, ...personas.map((persona) => persona.name)]);
    return Object.entries(dmThreads).filter(([key]) => conversationBelongsToCharacter(key, activeId, char, ownerLabel, myNames)).map(([key, messages]) => conversationFromThread(key, messages as DmMessage[], me, ownerLabel, personas));
  }
  return { activePersona, autoChatting, chatMode, currentWorldPref, defaultDmTitle, deletedDmKeys, deletePersona, displayDmTitle, dm, dmDrafts, dmInput, dmKey, dmKeyFor, dmPrefDraft, dmResponseFlow, dmResponseFlows, dmSending, dmSettingsOpen, dmThreadTitles, dmThreads, dmWorldDraft, dmWorldPrefs, editingDmTitle, localDmKey, meName, myConversations, newChatMode, newChatSpeaker, ownerDmKey, ownerLabel, ownerPersona, ownerSpeaking, peer, pendingDm, personaDraft, personas, saveRenameDm, setAutoChatting, setChatMode, setDeletedDmKeys, setDmDrafts, setDmInput, setDmPrefDraft, setDmResponseFlow, setDmResponseFlows, setDmSending, setDmSettingsOpen, setDmThreadTitles, setDmThreads, setDmWorldDraft, setDmWorldPrefs, setEditingDmTitle, setNewChatMode, setNewChatSpeaker, setOwnerPersona, setPeer, setPendingDm, setPersonaDraft, setPersonas, setSpeakAs, speakAs, speakerNameFor, startRenameDm };
}

function nextThreadTitles(prev: Record<string, string>, key: string, title: string): Record<string, string> {
  const next = { ...prev };
  if (title) next[key] = title;
  else delete next[key];
  return next;
}

function currentSpeakerName(peer: DmPeer, activePersona: Persona | null, ownerSpeaking: boolean, ownerLabel: string, char: DmCharacter): string {
  if (peer.asOwner) return ownerLabel;
  if (activePersona) return activePersona.name;
  if (ownerSpeaking) return ownerLabel;
  return char.name || "나";
}

function conversationBelongsToCharacter(key: string, activeId: string | null | undefined, char: DmCharacter, ownerLabel: string, myNames: Set<string>): boolean {
  const scope = activeId || char.name || "new";
  const roomKey = roomKeyFromDmThreadKey(key);
  const parts = roomKey.split("|");
  if (key.startsWith("owner::") && !key.startsWith(`owner::${scope}::`)) return false;
  if (key.startsWith("local::") && !key.startsWith(`local::${scope}::`)) return false;
  if (parts[0] === ownerLabel && parts[1] === (char.name || "나")) return true;
  return parts.some((name) => myNames.has(name));
}

function conversationFromThread(key: string, messages: DmMessage[], me: string, ownerLabel: string, personas: Persona[]): DmConversation {
  const parts = roomKeyFromDmThreadKey(key).split("|");
  const isOwnerThread = parts[0] === ownerLabel && parts[1] === me;
  const isNpcThread = key.startsWith("local::");
  const personaSide = isOwnerThread ? null : parts.find((name) => personas.some((persona) => persona.name === name));
  const peerName = peerNameFromParts(parts, me, ownerLabel, isOwnerThread, personaSide);
  const last = messages[messages.length - 1];
  return { key, peerName, last: last?.deliveryState === "failed" ? "답장을 다시 보내야 해요" : (last ? last.text : ""), count: messages.length, asOwner: isOwnerThread, asPersona: personaSide, dmKind: isNpcThread ? "npc" : "shared", dmKey: key, localRoomId: localRoomIdFromDmThreadKey(key) };
}

function peerNameFromParts(parts: string[], me: string, ownerLabel: string, isOwnerThread: boolean, personaSide: string | null | undefined): string {
  if (isOwnerThread) return ownerLabel;
  if (personaSide) return parts.find((name) => name !== personaSide) || parts[0];
  const mineSide = parts.find((name) => name === me) || me;
  return parts.find((name) => name !== mineSide) || parts[0];
}
