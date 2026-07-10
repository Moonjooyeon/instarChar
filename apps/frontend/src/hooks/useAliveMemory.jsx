import { useState } from "react";
import { LorePeerSelect } from "@/components/ui/LorePeerSelect";

export function useAliveMemory({ activeId, activeSharedId, accounts, char, following, isPersonaName, loadSharedFollowers, myConversations, ownerName = "나", parseRelations, setAccounts, setChar, setDmWorldPrefs, setFollowing, setFollowPanel }) {
  const [showMemory, setShowMemory] = useState(false);
  const [showMemoryAdd, setShowMemoryAdd] = useState(false);
  const [memFilter, setMemFilter] = useState(null);
  const [memDraftPeer, setMemDraftPeer] = useState("");
  const [memDraftCustomPeer, setMemDraftCustomPeer] = useState("");
  const [memDraftText, setMemDraftText] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [showPeerMem, setShowPeerMem] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  function closeProfilePanels(except = "") {
    if (except !== "memory") {
      setShowMemory(false);
      setMemFilter(null);
      setShowMemoryAdd(false);
    }
    if (except !== "relations") setShowRelations(false);
    if (except !== "follow") setFollowPanel(null);
  }
  function toggleMemoryPanel() {
    setShowMemory((current) => {
      const next = !current;
      if (next) closeProfilePanels("memory");
      else setShowMemoryAdd(false);
      return next;
    });
  }
  function toggleRelationsPanel() {
    setShowRelations((current) => {
      const next = !current;
      if (next) closeProfilePanels("relations");
      return next;
    });
  }
  function toggleFollowPanel(kind) {
    setFollowPanel((current) => {
      const next = current === kind ? null : kind;
      if (next) {
        closeProfilePanels("follow");
        if (next === "followers" && activeSharedId) loadSharedFollowers(activeSharedId);
      }
      return next;
    });
  }
  function updateLorebook(updater) {
    setChar((current) => {
      const nextLore = typeof updater === "function" ? updater(current.lorebook || []) : updater;
      if (activeId) setAccounts((items) => items.map((item) => item.id === activeId ? { ...item, char: { ...item.char, lorebook: nextLore } } : item));
      return { ...current, lorebook: nextLore };
    });
  }
  function normalizeMemoryEntry(entry) {
    return { source: "auto", importance: 2, pinned: false, ...entry };
  }
  function editMemory(id, content) {
    updateLorebook((list) => list.map((item) => item.id === id ? { ...item, content } : item));
  }
  function updateMemory(id, patch) {
    updateLorebook((list) => list.map((item) => item.id === id ? { ...normalizeMemoryEntry(item), ...patch } : item));
  }
  function deleteMemory(id) {
    updateLorebook((list) => list.filter((item) => item.id !== id));
  }
  function updateRoomMemory(roomKey, viewer, id, patch) {
    if (!roomKey || !viewer) return;
    setDmWorldPrefs((prev) => updateRoomMemoryPrefs(prev, roomKey, viewer, id, patch, normalizeMemoryEntry));
  }
  function deleteRoomMemory(roomKey, viewer, id) {
    if (!roomKey || !viewer) return;
    setDmWorldPrefs((prev) => updateRoomMemoryPrefs(prev, roomKey, viewer, id, null, null));
  }
  function addManualMemory() {
    const content = memDraftText.trim();
    if (!content) return;
    const peer = ((memDraftPeer === "__custom__" ? memDraftCustomPeer : memDraftPeer).trim() || memFilter || "*").trim();
    updateLorebook((list) => [...list, { id: Date.now(), content, peer, source: "manual", importance: 3, pinned: false }].slice(-60));
    setMemDraftText("");
    setMemDraftCustomPeer("");
    setShowMemoryAdd(false);
    if (!memFilter && peer !== "*") setMemFilter(peer);
  }
  function saveMemories(viewer, other, items, roomKey = "") {
    if (!items?.length || isPersonaName(viewer) || viewer === ownerName) return;
    const updateEntries = (existing) => nextMemoryEntries(existing, items, other, roomKey);
    if (roomKey?.startsWith("local::")) {
      setDmWorldPrefs((prev) => saveRoomMemories(prev, roomKey, viewer, updateEntries));
      return;
    }
    if (char.name === viewer) setChar((current) => ({ ...current, lorebook: updateEntries(current.lorebook) }));
    else savePeerMemories(viewer, updateEntries, setAccounts, setFollowing);
  }
  function lorePeerOptions() {
    const names = new Set(["*"]);
    (char.lorebook || []).forEach((item) => names.add(item.peer || "*"));
    parseRelations(char.relations).forEach((relation) => { if (relation.who) names.add(relation.who); });
    accounts.forEach((item) => { if (item.char.name && item.char.name !== char.name) names.add(item.char.name); });
    following.forEach((item) => { if (item.name) names.add(item.name); });
    myConversations().forEach((item) => { if (item.peerName) names.add(item.peerName); });
    return [...names].filter(Boolean);
  }
  function renderLorePeerSelect(options, fallbackPeer = "*") {
    return <LorePeerSelect options={options} fallbackPeer={fallbackPeer} memDraftPeer={memDraftPeer} memDraftCustomPeer={memDraftCustomPeer} setMemDraftPeer={setMemDraftPeer} setMemDraftCustomPeer={setMemDraftCustomPeer} />;
  }
  return { addManualMemory, cleanMemItems, closeProfilePanels, deleteMemory, deleteRoomMemory, editMemory, editingMemoryId, loreBlockFor, lorePeerOptions, memDraftCustomPeer, memDraftPeer, memDraftText, memFilter, memSimilar, memTokens, normalizeMemoryEntry, renderLorePeerSelect, roomLoreBlockFor, roomMemoryEntries, saveMemories, setEditingMemoryId, setMemDraftCustomPeer, setMemDraftPeer, setMemDraftText, setMemFilter, setShowMemory, setShowMemoryAdd, setShowPeerMem, setShowRelations, showMemory, showMemoryAdd, showPeerMem, showRelations, toggleFollowPanel, toggleMemoryPanel, toggleRelationsPanel, updateLorebook, updateMemory, updateRoomMemory };
}

function updateRoomMemoryPrefs(prev, roomKey, viewer, id, patch, normalize) {
  const pref = prev[roomKey] || {};
  const memories = pref.memories || {};
  const list = memories[viewer] || [];
  const nextList = patch ? list.map((item) => item.id === id ? { ...normalize(item), ...patch } : item) : list.filter((item) => item.id !== id);
  return { ...prev, [roomKey]: { ...pref, memories: { ...memories, [viewer]: nextList } } };
}

function roomMemoryEntries(pref, viewer, other) {
  const book = pref?.memories || {};
  return (book[viewer] || []).filter((entry) => !other || entry.peer === other);
}

function roomLoreBlockFor(pref, viewer, other) {
  const picked = roomMemoryEntries(pref, viewer, other).slice(-12).map((entry) => (entry.content || "").trim()).filter(Boolean);
  if (!picked.length) return "";
  return `\n\n[이 DM방에서만 이어지는 기억 — 다른 NPC방/공유DM과 섞지 마라]\n${picked.map((text) => `- ${text}`).join("\n")}`;
}

function loreBlockFor(char, withName) {
  const mem = (char && char.lorebook) || [];
  if (!mem.length) return "";
  const globalOnly = (entry) => !entry.roomKey;
  const rel = withName ? mem.filter((entry) => entry.peer === withName && globalOnly(entry)) : [];
  const gen = mem.filter((entry) => (!entry.peer || entry.peer === "*") && !entry.roomKey);
  const picked = [...rel, ...gen].slice(-12).map((entry) => (entry.content || "").trim()).filter(Boolean);
  if (!picked.length) return "";
  return `\n\n[지금까지의 기억 — 이미 일어난 일이다. 일관되게 이어가고 절대 잊지 마라]\n${picked.map((text) => `- ${text}`).join("\n")}`;
}

function memTokens(text) {
  const cleaned = String(text).replace(/[.,!?'"~()]/g, " ").replace(/(은|는|이|가|을|를|와|과|에게|에서|으로|로|에|의|도|만|까지|부터|했다|한다|하기로|했음|함|이다|있다|없다)/g, " ");
  return new Set(cleaned.split(/\s+/).filter((word) => word.length >= 2));
}

function memSimilar(a, b) {
  const left = memTokens(a);
  const right = memTokens(b);
  if (!left.size || !right.size) return false;
  return intersectionSize(left, right) / Math.min(left.size, right.size) >= 0.6;
}

function intersectionSize(left, right) {
  let count = 0;
  left.forEach((word) => { if (right.has(word)) count += 1; });
  return count;
}

function nextMemoryEntries(existing, items, other, roomKey) {
  const fresh = freshMemoryItems(existing, items, other, roomKey);
  return [...(existing || []), ...fresh.map((item, index) => memoryEntry(item, index, other, roomKey))]
    .sort(memorySort)
    .slice(0, 120);
}

function freshMemoryItems(existing, items, other, roomKey) {
  const sameScope = (entry) => (entry.peer || "") === other && (entry.roomKey || "") === roomKey;
  const history = (existing || []).filter(sameScope).map((entry) => entry.content);
  return normalizeMemoryItems(items).filter((item, index, fresh) => isFreshMemory(item, index, fresh, history));
}

function normalizeMemoryItems(items) {
  return (items || [])
    .map((item) => typeof item === "string" ? { content: item, importance: 4 } : item)
    .map((item) => ({ content: String(item?.content || "").trim(), importance: Math.max(1, Math.min(5, Number(item?.importance) || 4)) }))
    .filter((item) => item.content.length >= 12 && item.importance >= 3);
}

function isFreshMemory(item, index, fresh, history) {
  if (history.some((content) => memSimilar(content, item.content))) return false;
  return !fresh.slice(0, index).some((candidate) => memSimilar(candidate.content, item.content));
}

function memoryEntry(item, index, other, roomKey) {
  return { id: Date.now() + index, content: item.content, peer: other, roomKey, source: "auto", importance: item.importance, pinned: false };
}

function memorySort(a, b) {
  return Number(b.pinned) - Number(a.pinned) || (b.importance || 2) - (a.importance || 2) || (b.id || 0) - (a.id || 0);
}

function saveRoomMemories(prev, roomKey, viewer, updateEntries) {
  const pref = prev[roomKey] || {};
  const memories = pref.memories || {};
  return { ...prev, [roomKey]: { ...pref, memories: { ...memories, [viewer]: updateEntries(memories[viewer] || []) } } };
}

function savePeerMemories(viewer, updateEntries, setAccounts, setFollowing) {
  setAccounts((items) => items.map((item) => item.char.name === viewer ? { ...item, char: { ...item.char, lorebook: updateEntries(item.char.lorebook) } } : item));
  setFollowing((items) => items.map((item) => item.name === viewer ? { ...item, lorebook: updateEntries(item.lorebook) } : item));
}

function cleanMemItems(raw) {
  const items = Array.isArray(raw) ? raw : String(raw || "").split("\n");
  return items.map(cleanMemItem).filter(validMemItem).slice(0, 1);
}

function cleanMemItem(item) {
  if (item && typeof item === "object") return { content: cleanMemText(item.content || item.text), importance: Math.max(1, Math.min(5, Number(item.importance) || 0)) };
  return { content: cleanMemText(item), importance: 4 };
}

function cleanMemText(value) {
  return String(value || "").replace(/^[-•\d.\s)]+/, "").trim();
}

function validMemItem(item) {
  if (item.content.length < 12 || item.importance < 3) return false;
  return !/(기억할|내용\s*없|없음|해당\s*없|특별히|없습니다|없다|잡담|인사)/.test(item.content);
}
