import { useState } from "react";
import {
  canonicalDmKey,
  localRoomIdFromDmThreadKey,
  roomKeyFromDmThreadKey,
  scopedLocalDmKey,
} from "@/domain/dm/dmKeyUtils";

export function useAliveDm({ activeId, char }) {
  const [autoChatting, setAutoChatting] = useState(false);
  const [dmThreads, setDmThreads] = useState({});
  const [dmWorldPrefs, setDmWorldPrefs] = useState({});
  const [deletedDmKeys, setDeletedDmKeys] = useState([]);
  const [pendingDm, setPendingDm] = useState(null);
  const [dmWorldDraft, setDmWorldDraft] = useState("");
  const [dmSettingsOpen, setDmSettingsOpen] = useState(false);
  const [dmPrefDraft, setDmPrefDraft] = useState({ mode: "bridge", note: "" });
  const [peer, setPeer] = useState(null);
  const [dmInput, setDmInput] = useState("");
  const [dmImageDraft, setDmImageDraft] = useState(null);
  const [dmSending, setDmSending] = useState(false);
  const [ownerPersona, setOwnerPersona] = useState("");
  const [speakAs, setSpeakAs] = useState("char");
  const [personas, setPersonas] = useState([]);
  const [personaDraft, setPersonaDraft] = useState(null);
  const [newChatSpeaker, setNewChatSpeaker] = useState("char");
  const [newChatMode, setNewChatMode] = useState(null);
  const [dmThreadTitles, setDmThreadTitles] = useState({});
  const [editingDmTitle, setEditingDmTitle] = useState(null);
  const [chatMode, setChatMode] = useState("talk");
  const ownerLabel = "나";
  const activePersona = speakAs.startsWith("p:") ? personas.find((persona) => `p:${persona.id}` === speakAs) : null;
  const ownerSpeaking = speakAs === "owner";
  const meName = peer ? currentSpeakerName(peer, activePersona, ownerSpeaking, ownerLabel, char) : (char.name || "나");
  const dmKey = peer ? dmKeyFor(peer, speakAs) : "";
  const currentWorldPref = dmKey ? dmWorldPrefs[dmKey] : null;
  const dm = (peer && dmThreads[dmKey]) || [];
  function handleDmImage(event) {
    const file = Array.from(event.target.files || [])[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => setDmImageDraft(readerEvent.target.result);
    reader.readAsDataURL(file);
    event.target.value = "";
  }
  function defaultDmTitle(conv) {
    if (!conv) return "대화방";
    if (conv.asOwner) return `${char.name} · 나(오너)와`;
    if (conv.asPersona) return `${conv.peerName} · ${conv.asPersona}로`;
    return conv.peerName || "대화방";
  }
  function displayDmTitle(conv) {
    return dmThreadTitles[conv.key] || defaultDmTitle(conv);
  }
  function startRenameDm(conv, event) {
    event?.stopPropagation();
    setEditingDmTitle({ key: conv.key, title: displayDmTitle(conv) });
  }
  function saveRenameDm() {
    if (!editingDmTitle) return;
    const title = editingDmTitle.title.trim();
    setDmThreadTitles((prev) => nextThreadTitles(prev, editingDmTitle.key, title));
    setEditingDmTitle(null);
  }
  function deletePersona(id, commentAs, setCommentAs) {
    setPersonas((items) => items.filter((item) => item.id !== id));
    if (speakAs === `p:${id}`) setSpeakAs("char");
    if (commentAs === `p:${id}`) setCommentAs("char");
    if (newChatSpeaker === `p:${id}`) setNewChatSpeaker("char");
  }
  function speakerNameFor(speakerValue = speakAs) {
    const persona = String(speakerValue || "").startsWith("p:") ? personas.find((item) => `p:${item.id}` === speakerValue) : null;
    if (persona) return persona.name;
    if (speakerValue === "owner") return ownerLabel;
    return char.name || "나";
  }
  function localDmKey(a, b, roomId = "") {
    return scopedLocalDmKey(activeId || char.name || "new", a, b, roomId);
  }
  function ownerDmKey() {
    return `owner::${activeId || char.name || "new"}::${ownerLabel}|${char.name || "나"}`;
  }
  function dmKeyFor(peerObj, speakerValue = speakAs) {
    if (!peerObj) return "";
    if (peerObj.asOwner) return ownerDmKey();
    if (peerObj.dmKey) return peerObj.dmKey;
    if (peerObj.dmKind === "npc") return localDmKey(speakerNameFor(speakerValue), peerObj.name, peerObj.localRoomId || "");
    return canonicalDmKey(speakerNameFor(speakerValue), peerObj.name);
  }
  function myConversations() {
    const me = char.name || "나";
    const myNames = new Set([me, ...personas.map((persona) => persona.name)]);
    return Object.entries(dmThreads).filter(([key]) => conversationBelongsToCharacter(key, activeId, char, ownerLabel, myNames)).map(([key, messages]) => conversationFromThread(key, messages, me, ownerLabel, personas));
  }
  return { activePersona, autoChatting, chatMode, currentWorldPref, defaultDmTitle, deletedDmKeys, deletePersona, displayDmTitle, dm, dmImageDraft, dmInput, dmKey, dmKeyFor, dmPrefDraft, dmSending, dmSettingsOpen, dmThreadTitles, dmThreads, dmWorldDraft, dmWorldPrefs, editingDmTitle, handleDmImage, localDmKey, meName, myConversations, newChatMode, newChatSpeaker, ownerDmKey, ownerLabel, ownerPersona, ownerSpeaking, peer, pendingDm, personaDraft, personas, saveRenameDm, setAutoChatting, setChatMode, setDeletedDmKeys, setDmImageDraft, setDmInput, setDmPrefDraft, setDmSending, setDmSettingsOpen, setDmThreadTitles, setDmThreads, setDmWorldDraft, setDmWorldPrefs, setEditingDmTitle, setNewChatMode, setNewChatSpeaker, setOwnerPersona, setPeer, setPendingDm, setPersonaDraft, setPersonas, setSpeakAs, speakAs, speakerNameFor, startRenameDm };
}

function nextThreadTitles(prev, key, title) {
  const next = { ...prev };
  if (title) next[key] = title;
  else delete next[key];
  return next;
}

function currentSpeakerName(peer, activePersona, ownerSpeaking, ownerLabel, char) {
  if (peer.asOwner) return ownerLabel;
  if (activePersona) return activePersona.name;
  if (ownerSpeaking) return ownerLabel;
  return char.name || "나";
}

function conversationBelongsToCharacter(key, activeId, char, ownerLabel, myNames) {
  const scope = activeId || char.name || "new";
  const roomKey = roomKeyFromDmThreadKey(key);
  const parts = roomKey.split("|");
  if (key.startsWith("owner::") && !key.startsWith(`owner::${scope}::`)) return false;
  if (key.startsWith("local::") && !key.startsWith(`local::${scope}::`)) return false;
  if (parts[0] === ownerLabel && parts[1] === (char.name || "나")) return true;
  return parts.some((name) => myNames.has(name));
}

function conversationFromThread(key, messages, me, ownerLabel, personas) {
  const parts = roomKeyFromDmThreadKey(key).split("|");
  const isOwnerThread = parts[0] === ownerLabel && parts[1] === me;
  const isNpcThread = key.startsWith("local::");
  const personaSide = isOwnerThread ? null : parts.find((name) => personas.some((persona) => persona.name === name));
  const peerName = peerNameFromParts(parts, me, ownerLabel, isOwnerThread, personaSide);
  const last = messages[messages.length - 1];
  return { key, peerName, last: last ? last.text : "", count: messages.length, asOwner: isOwnerThread, asPersona: personaSide, dmKind: isNpcThread ? "npc" : "shared", dmKey: key, localRoomId: localRoomIdFromDmThreadKey(key) };
}

function peerNameFromParts(parts, me, ownerLabel, isOwnerThread, personaSide) {
  if (isOwnerThread) return ownerLabel;
  if (personaSide) return parts.find((name) => name !== personaSide) || parts[0];
  const mineSide = parts.find((name) => name === me) || me;
  return parts.find((name) => name !== mineSide) || parts[0];
}
