import { useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { LorePeerSelect } from "@/components/ui/LorePeerSelect";

type SetState<T> = Dispatch<SetStateAction<T>>;

type MemoryEntry = {
  content?: string;
  id?: number;
  importance?: number;
  peer?: string;
  pinned?: boolean;
  roomKey?: string;
  source?: string;
};

type CharacterState = Record<string, unknown> & {
  handle?: string;
  lorebook?: MemoryEntry[];
  name?: string;
  relations?: string;
};

type AccountState = {
  char: CharacterState;
  id?: string;
};

type FollowCharacter = Record<string, unknown> & {
  lorebook?: MemoryEntry[];
  name?: string;
};

type RoomPrefs = Record<string, unknown> & {
  memories?: Record<string, MemoryEntry[]>;
};

type DmWorldPrefs = Record<string, RoomPrefs>;

type RelationEntry = {
  who?: string;
};

type ConversationEntry = {
  peerName?: string;
};

type CleanMemoryItem = {
  content: string;
  importance: number;
};

type UseAliveMemoryOptions = {
  accounts: AccountState[];
  activeId?: string | null;
  activeSharedId?: string;
  char: CharacterState;
  following: FollowCharacter[];
  isPersonaName: (name: string) => boolean;
  loadSharedFollowers: (activeSharedId: string) => unknown;
  myConversations: () => ConversationEntry[];
  ownerName?: string;
  parseRelations: (relations?: string) => RelationEntry[];
  setAccounts: SetState<AccountState[]>;
  setChar: SetState<CharacterState>;
  setDmWorldPrefs: SetState<DmWorldPrefs>;
  setFollowing: SetState<FollowCharacter[]>;
  setFollowPanel: SetState<string | null>;
};

export function useAliveMemory({ activeId, activeSharedId, accounts, char, following, isPersonaName, loadSharedFollowers, myConversations, ownerName = "나", parseRelations, setAccounts, setChar, setDmWorldPrefs, setFollowing, setFollowPanel }: UseAliveMemoryOptions) {
  const [showMemory, setShowMemory] = useState(false);
  const [showMemoryAdd, setShowMemoryAdd] = useState(false);
  const [memFilter, setMemFilter] = useState<string | null>(null);
  const [memDraftPeer, setMemDraftPeer] = useState("");
  const [memDraftCustomPeer, setMemDraftCustomPeer] = useState("");
  const [memDraftText, setMemDraftText] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<number | null>(null);
  const [showPeerMem, setShowPeerMem] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  function closeProfilePanels(except = ""): void {
    if (except !== "memory") {
      setShowMemory(false);
      setMemFilter(null);
      setShowMemoryAdd(false);
    }
    if (except !== "relations") setShowRelations(false);
    if (except !== "follow") setFollowPanel(null);
  }
  function toggleMemoryPanel(): void {
    setShowMemory((current) => {
      const next = !current;
      if (next) closeProfilePanels("memory");
      else setShowMemoryAdd(false);
      return next;
    });
  }
  function toggleRelationsPanel(): void {
    setShowRelations((current) => {
      const next = !current;
      if (next) closeProfilePanels("relations");
      return next;
    });
  }
  function toggleFollowPanel(kind: string): void {
    setFollowPanel((current) => {
      const next = current === kind ? null : kind;
      if (next) {
        closeProfilePanels("follow");
        if (next === "followers" && activeSharedId) loadSharedFollowers(activeSharedId);
      }
      return next;
    });
  }
  function updateLorebook(updater: MemoryEntry[] | ((list: MemoryEntry[]) => MemoryEntry[])): void {
    setChar((current) => {
      const nextLore = typeof updater === "function" ? updater(current.lorebook || []) : updater;
      if (activeId) setAccounts((items) => items.map((item) => item.id === activeId ? { ...item, char: { ...item.char, lorebook: nextLore } } : item));
      return { ...current, lorebook: nextLore };
    });
  }
  function normalizeMemoryEntry(entry: MemoryEntry): MemoryEntry {
    return { source: "auto", importance: 2, pinned: false, ...entry };
  }
  function editMemory(id: number, content: string): void {
    updateLorebook((list) => list.map((item) => item.id === id ? { ...item, content } : item));
  }
  function updateMemory(id: number, patch: Partial<MemoryEntry>): void {
    updateLorebook((list) => list.map((item) => item.id === id ? { ...normalizeMemoryEntry(item), ...patch } : item));
  }
  function deleteMemory(id: number): void {
    updateLorebook((list) => list.filter((item) => item.id !== id));
  }
  function updateRoomMemory(roomKey: string, viewer: string, id: number, patch: Partial<MemoryEntry>): void {
    if (!roomKey || !viewer) return;
    setDmWorldPrefs((prev) => updateRoomMemoryPrefs(prev, roomKey, viewer, id, patch, normalizeMemoryEntry));
  }
  function deleteRoomMemory(roomKey: string, viewer: string, id: number): void {
    if (!roomKey || !viewer) return;
    setDmWorldPrefs((prev) => updateRoomMemoryPrefs(prev, roomKey, viewer, id, null, null));
  }
  function addManualMemory(): void {
    const content = memDraftText.trim();
    if (!content) return;
    const peer = ((memDraftPeer === "__custom__" ? memDraftCustomPeer : memDraftPeer).trim() || memFilter || "*").trim();
    updateLorebook((list) => [...list, { id: Date.now(), content, peer, source: "manual", importance: 3, pinned: false }].slice(-60));
    setMemDraftText("");
    setMemDraftCustomPeer("");
    setShowMemoryAdd(false);
    if (!memFilter && peer !== "*") setMemFilter(peer);
  }
  function saveMemories(viewer: string, other: string, items: unknown[], roomKey = ""): void {
    if (!items?.length || isPersonaName(viewer) || viewer === ownerName) return;
    const updateEntries = (existing) => nextMemoryEntries(existing, items, other, roomKey);
    if (roomKey?.startsWith("local::")) {
      setDmWorldPrefs((prev) => saveRoomMemories(prev, roomKey, viewer, updateEntries));
      return;
    }
    if (char.name === viewer) setChar((current) => ({ ...current, lorebook: updateEntries(current.lorebook) }));
    else savePeerMemories(viewer, updateEntries, setAccounts, setFollowing);
  }
  function lorePeerOptions(): string[] {
    const names = new Set(["*"]);
    (char.lorebook || []).forEach((item) => names.add(item.peer || "*"));
    parseRelations(char.relations).forEach((relation) => { if (relation.who) names.add(relation.who); });
    accounts.forEach((item) => { if (item.char.name && item.char.name !== char.name) names.add(item.char.name); });
    following.forEach((item) => { if (item.name) names.add(item.name); });
    myConversations().forEach((item) => { if (item.peerName) names.add(item.peerName); });
    return [...names].filter(Boolean);
  }
  function renderLorePeerSelect(options: string[], fallbackPeer = "*"): ReactElement {
    return <LorePeerSelect options={options} fallbackPeer={fallbackPeer} memDraftPeer={memDraftPeer} memDraftCustomPeer={memDraftCustomPeer} setMemDraftPeer={setMemDraftPeer} setMemDraftCustomPeer={setMemDraftCustomPeer} />;
  }
  return { addManualMemory, cleanMemItems, closeProfilePanels, deleteMemory, deleteRoomMemory, editMemory, editingMemoryId, loreBlockFor, lorePeerOptions, memDraftCustomPeer, memDraftPeer, memDraftText, memFilter, memSimilar, memTokens, normalizeMemoryEntry, renderLorePeerSelect, roomLoreBlockFor, roomMemoryEntries, saveMemories, setEditingMemoryId, setMemDraftCustomPeer, setMemDraftPeer, setMemDraftText, setMemFilter, setShowMemory, setShowMemoryAdd, setShowPeerMem, setShowRelations, showMemory, showMemoryAdd, showPeerMem, showRelations, toggleFollowPanel, toggleMemoryPanel, toggleRelationsPanel, updateLorebook, updateMemory, updateRoomMemory };
}

function updateRoomMemoryPrefs(
  prev: DmWorldPrefs,
  roomKey: string,
  viewer: string,
  id: number,
  patch: Partial<MemoryEntry> | null,
  normalize: ((entry: MemoryEntry) => MemoryEntry) | null,
): DmWorldPrefs {
  const pref = prev[roomKey] || {};
  const memories = pref.memories || {};
  const list = memories[viewer] || [];
  const nextList = patch && normalize ? list.map((item) => item.id === id ? { ...normalize(item), ...patch } : item) : list.filter((item) => item.id !== id);
  return { ...prev, [roomKey]: { ...pref, memories: { ...memories, [viewer]: nextList } } };
}

function roomMemoryEntries(pref: RoomPrefs | null | undefined, viewer: string, other?: string): MemoryEntry[] {
  const book = pref?.memories || {};
  return (book[viewer] || []).filter((entry) => !other || entry.peer === other);
}

function roomLoreBlockFor(pref: RoomPrefs | null | undefined, viewer: string, other?: string): string {
  const picked = roomMemoryEntries(pref, viewer, other).slice(-12).map((entry) => (entry.content || "").trim()).filter(Boolean);
  if (!picked.length) return "";
  return `\n\n[이 DM방에서만 이어지는 기억 — 다른 NPC방/공유DM과 섞지 마라]\n${picked.map((text) => `- ${text}`).join("\n")}`;
}

function loreBlockFor(char: CharacterState | null | undefined, withName?: string): string {
  const mem = (char && char.lorebook) || [];
  if (!mem.length) return "";
  const globalOnly = (entry) => !entry.roomKey;
  const rel = withName ? mem.filter((entry) => entry.peer === withName && globalOnly(entry)) : [];
  const gen = mem.filter((entry) => (!entry.peer || entry.peer === "*") && !entry.roomKey);
  const picked = [...rel, ...gen].slice(-12).map((entry) => (entry.content || "").trim()).filter(Boolean);
  if (!picked.length) return "";
  return `\n\n[지금까지의 기억 — 이미 일어난 일이다. 일관되게 이어가고 절대 잊지 마라]\n${picked.map((text) => `- ${text}`).join("\n")}`;
}

function memTokens(text: unknown): Set<string> {
  const cleaned = String(text).replace(/[.,!?'"~()]/g, " ").replace(/(은|는|이|가|을|를|와|과|에게|에서|으로|로|에|의|도|만|까지|부터|했다|한다|하기로|했음|함|이다|있다|없다)/g, " ");
  return new Set(cleaned.split(/\s+/).filter((word) => word.length >= 2));
}

function memSimilar(a: unknown, b: unknown): boolean {
  const left = memTokens(a);
  const right = memTokens(b);
  if (!left.size || !right.size) return false;
  return intersectionSize(left, right) / Math.min(left.size, right.size) >= 0.6;
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  left.forEach((word) => { if (right.has(word)) count += 1; });
  return count;
}

function nextMemoryEntries(existing: MemoryEntry[] | undefined, items: unknown[], other: string, roomKey: string): MemoryEntry[] {
  const fresh = freshMemoryItems(existing, items, other, roomKey);
  return [...(existing || []), ...fresh.map((item, index) => memoryEntry(item, index, other, roomKey))]
    .sort(memorySort)
    .slice(0, 120);
}

function freshMemoryItems(existing: MemoryEntry[] | undefined, items: unknown[], other: string, roomKey: string): CleanMemoryItem[] {
  const sameScope = (entry: MemoryEntry): boolean => (entry.peer || "") === other && (entry.roomKey || "") === roomKey;
  const history = (existing || []).filter(sameScope).map((entry) => entry.content);
  return normalizeMemoryItems(items).filter((item, index, fresh) => isFreshMemory(item, index, fresh, history));
}

function normalizeMemoryItems(items: unknown[]): CleanMemoryItem[] {
  return (items || [])
    .map((item) => typeof item === "string" ? { content: item, importance: 4 } : recordValue(item))
    .map((item) => ({ content: String(item.content || "").trim(), importance: Math.max(1, Math.min(5, Number(item.importance) || 4)) }))
    .filter((item) => item.content.length >= 12 && item.importance >= 3);
}

function isFreshMemory(item: CleanMemoryItem, index: number, fresh: CleanMemoryItem[], history: Array<string | undefined>): boolean {
  if (history.some((content) => memSimilar(content, item.content))) return false;
  return !fresh.slice(0, index).some((candidate) => memSimilar(candidate.content, item.content));
}

function memoryEntry(item: CleanMemoryItem, index: number, other: string, roomKey: string): MemoryEntry {
  return { id: Date.now() + index, content: item.content, peer: other, roomKey, source: "auto", importance: item.importance, pinned: false };
}

function memorySort(a: MemoryEntry, b: MemoryEntry): number {
  return Number(b.pinned) - Number(a.pinned) || (b.importance || 2) - (a.importance || 2) || (b.id || 0) - (a.id || 0);
}

function saveRoomMemories(prev: DmWorldPrefs, roomKey: string, viewer: string, updateEntries: (existing: MemoryEntry[]) => MemoryEntry[]): DmWorldPrefs {
  const pref = prev[roomKey] || {};
  const memories = pref.memories || {};
  return { ...prev, [roomKey]: { ...pref, memories: { ...memories, [viewer]: updateEntries(memories[viewer] || []) } } };
}

function savePeerMemories(viewer: string, updateEntries: (existing: MemoryEntry[] | undefined) => MemoryEntry[], setAccounts: SetState<AccountState[]>, setFollowing: SetState<FollowCharacter[]>): void {
  setAccounts((items) => items.map((item) => item.char.name === viewer ? { ...item, char: { ...item.char, lorebook: updateEntries(item.char.lorebook) } } : item));
  setFollowing((items) => items.map((item) => item.name === viewer ? { ...item, lorebook: updateEntries(item.lorebook) } : item));
}

function cleanMemItems(raw: unknown): CleanMemoryItem[] {
  const items = Array.isArray(raw) ? raw : String(raw || "").split("\n");
  return items.map(cleanMemItem).filter(validMemItem).slice(0, 1);
}

function cleanMemItem(item: unknown): CleanMemoryItem {
  if (item && typeof item === "object") {
    const row = recordValue(item);
    return { content: cleanMemText(row.content || row.text), importance: Math.max(1, Math.min(5, Number(row.importance) || 0)) };
  }
  return { content: cleanMemText(item), importance: 4 };
}

function cleanMemText(value: unknown): string {
  return String(value || "").replace(/^[-•\d.\s)]+/, "").trim();
}

function validMemItem(item: CleanMemoryItem): boolean {
  if (item.content.length < 12 || item.importance < 3) return false;
  return !/(기억할|내용\s*없|없음|해당\s*없|특별히|없습니다|없다|잡담|인사)/.test(item.content);
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
