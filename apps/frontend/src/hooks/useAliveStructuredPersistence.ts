import type { MutableRefObject } from "react";
import {
  deleteStructuredCharacterData,
  loadStructuredRows,
  syncStructuredRows,
  type QueryResult,
  type SettledQueryResult,
} from "@/api/structured";
import { hasRemoteApiClient } from "@/api/client";
import { roomKeyFromDmThreadKey } from "@/domain/dm/dmKeyUtils";

type SessionLike = {
  user?: {
    id?: string;
  };
};

type CharacterData = Record<string, unknown> & {
  handle?: string;
  name?: string;
};

type AccountState = {
  char?: CharacterData;
  following?: FollowCharacter[];
  gallery?: unknown[];
  id?: string;
  posts?: PostState[];
};

type FollowCharacter = Record<string, unknown> & {
  handle?: string;
  id?: string;
  name?: string;
  owner?: string;
  ownerId?: string;
  ownerName?: string;
  shared?: boolean;
  sharedId?: string;
  sourceAccountId?: string;
};

type PersonaState = Record<string, unknown> & {
  id?: string | number;
  name?: string;
};

type PostState = Record<string, unknown> & {
  comments?: unknown[];
};

type AppSnapshot = Record<string, unknown> & {
  accounts?: AccountState[];
  activeId?: string | null;
  deletedDmKeys?: string[];
  dmThreads?: Record<string, unknown[]>;
  dmWorldPrefs?: Record<string, Record<string, unknown>>;
  personas?: PersonaState[];
};

type SharedCharacter = {
  name?: string;
  ownerId?: string;
  sharedId?: string;
};

type DmRow = {
  messages: unknown[];
  thread_key: string;
  world_pref: Record<string, unknown>;
};

type OwnerDmRow = DmRow & {
  owner_id: string;
};

type SharedDmRow = DmRow & {
  created_by: string;
  participant_labels: string[];
  participant_user_ids: string[];
};

type StructuredRows = {
  characterRows: Record<string, unknown>[];
  ownerDmRows: OwnerDmRow[];
  personaRows: Record<string, unknown>[];
  sharedDmRows: SharedDmRow[];
};

type DeletedDmKeysRef = MutableRefObject<Set<string>>;

type StructuredPersistenceOptions = {
  deletedDmKeysRef: DeletedDmKeysRef;
  session?: SessionLike | null;
  sharedCharacters: SharedCharacter[];
};

type StructuredPersistenceReturn = {
  deleteStructuredCharacterAccount: (targetId: string) => Promise<boolean | undefined>;
  loadStructuredStateFallback: (baseState: AppSnapshot, ownerId: string) => Promise<AppSnapshot>;
  syncStructuredState: (snapshot: AppSnapshot | null | undefined) => Promise<void>;
};

export function useAliveStructuredPersistence({ deletedDmKeysRef, session, sharedCharacters }: StructuredPersistenceOptions): StructuredPersistenceReturn {
  async function deleteStructuredCharacterAccount(targetId: string): Promise<boolean | undefined> {
    if (!hasRemoteApiClient() || !session?.user || !targetId) return;
    const ownerId = session.user.id;
    const results = await deleteStructuredCharacterData(ownerId, targetId);
    return structuredDeleteSucceeded(results);
  }
  async function syncStructuredState(snapshot: AppSnapshot | null | undefined): Promise<void> {
    if (!hasRemoteApiClient() || !session?.user || !snapshot) return;
    const ownerId = session.user.id;
    const rows = structuredRows(snapshot, ownerId, sharedCharacters, deletedDmKeysRef);
    const results = await syncStructuredRows(rows);
    if (!results.length) return;
    warnStructuredSyncFailures(results);
  }
  async function loadStructuredStateFallback(baseState: AppSnapshot, ownerId: string): Promise<AppSnapshot> {
    if (!hasRemoteApiClient() || !ownerId) return baseState;
    try {
      return await loadStructuredState(baseState, ownerId, deletedDmKeysRef);
    } catch (e) {
      console.warn("분리 테이블 로드 실패:", e);
      return baseState;
    }
  }
  return { deleteStructuredCharacterAccount, loadStructuredStateFallback, syncStructuredState };
}

function structuredDeleteSucceeded(results: SettledQueryResult[]): boolean {
  let ok = true;
  results.forEach((result) => {
    const error = result.status === "rejected" ? result.reason : result.value?.error;
    if (!error) return;
    ok = false;
    console.warn("캐릭터 삭제 구조화 데이터 정리 실패:", error.message || error);
  });
  return ok;
}

function structuredRows(snapshot: AppSnapshot, ownerId: string, sharedCharacters: SharedCharacter[], deletedDmKeysRef: DeletedDmKeysRef): StructuredRows {
  const deletedKeys = new Set([
    ...(Array.isArray(snapshot.deletedDmKeys) ? snapshot.deletedDmKeys : []),
    ...deletedDmKeysRef.current,
  ]);
  const dmRows = splitDmRows(snapshot, ownerId, deletedKeys, sharedCharacters);
  return {
    characterRows: characterRowsFor(snapshot, ownerId),
    ownerDmRows: dmRows.ownerDmRows,
    personaRows: personaRowsFor(snapshot, ownerId),
    sharedDmRows: dmRows.sharedDmRows,
  };
}

function characterRowsFor(snapshot: AppSnapshot, ownerId: string): Record<string, unknown>[] {
  return (snapshot.accounts || []).map((account) => ({
    owner_id: ownerId,
    source_account_id: account.id,
    name: account.char?.name || "",
    handle: account.char?.handle || "",
    character: compactCharacter(account),
    gallery: compactGallery(account.gallery || []),
    following: compactFollowing(account.following || []),
  })).filter((row) => row.source_account_id && row.name);
}

function personaRowsFor(snapshot: AppSnapshot, ownerId: string): Record<string, unknown>[] {
  return (snapshot.personas || []).map((persona) => ({
    owner_id: ownerId,
    persona_id: String(persona.id),
    name: persona.name || "",
    persona,
  })).filter((row) => row.persona_id && row.name);
}

function splitDmRows(snapshot: AppSnapshot, ownerId: string, deletedKeys: Set<string>, sharedCharacters: SharedCharacter[]): { ownerDmRows: OwnerDmRow[]; sharedDmRows: SharedDmRow[] } {
  const ownerDmRows: OwnerDmRow[] = [];
  const sharedDmRows: SharedDmRow[] = [];
  Object.entries(snapshot.dmThreads || {}).forEach(([threadKey, messages]) => {
    if (!threadKey || deletedKeys.has(threadKey)) return;
    pushDmRow({ messages, ownerDmRows, ownerId, sharedCharacters, sharedDmRows, snapshot, threadKey });
  });
  deletedKeys.forEach((threadKey) => {
    if (!threadKey) return;
    pushDeletedDmRow({ ownerDmRows, ownerId, threadKey });
  });
  return { ownerDmRows, sharedDmRows };
}

function pushDmRow({ messages, ownerDmRows, ownerId, sharedCharacters, sharedDmRows, snapshot, threadKey }: {
  messages: unknown;
  ownerDmRows: OwnerDmRow[];
  ownerId: string;
  sharedCharacters: SharedCharacter[];
  sharedDmRows: SharedDmRow[];
  snapshot: AppSnapshot;
  threadKey: string;
}): void {
  const row = {
    thread_key: threadKey,
    messages: compactMessages(messages),
    world_pref: snapshot.dmWorldPrefs?.[threadKey] || {},
  };
  const participantIds = participantIdsForThread(threadKey, ownerId, snapshot, sharedCharacters);
  if (threadKey.startsWith("dm::") && participantIds.length > 1) {
    sharedDmRows.push({ ...row, participant_user_ids: participantIds, participant_labels: roomKeyFromDmThreadKey(threadKey).split("|"), created_by: ownerId });
    return;
  }
  ownerDmRows.push({ ...row, owner_id: ownerId });
}

function pushDeletedDmRow({ ownerDmRows, ownerId, threadKey }: {
  ownerDmRows: OwnerDmRow[];
  ownerId: string;
  threadKey: string;
}): void {
  if (threadKey.startsWith("dm::")) return;
  const deletedRow = {
    thread_key: threadKey,
    messages: [],
    world_pref: { deleted: true, deleted_at: new Date().toISOString() },
  };
  ownerDmRows.push({ ...deletedRow, owner_id: ownerId });
}

function participantIdsForThread(threadKey: string, ownerId: string, snapshot: AppSnapshot, sharedCharacters: SharedCharacter[]): string[] {
  if (!threadKey?.startsWith("dm::")) return [ownerId];
  const names = roomKeyFromDmThreadKey(threadKey).split("|").map((name) => name.trim()).filter(Boolean);
  const ids = new Set([ownerId]);
  names.forEach((name) => {
    const followed = (snapshot.accounts || []).flatMap((a) => a.following || []).find((f) => f.name === name);
    if (followed?.ownerId) ids.add(followed.ownerId);
    const shared = sharedCharacters.find((c) => c.name === name || c.sharedId === followed?.sharedId);
    if (shared?.ownerId) ids.add(shared.ownerId);
  });
  return [...ids];
}

function warnStructuredSyncFailures(results: SettledQueryResult[]): void {
  const failed = results.find((result) => result.status === "fulfilled" && result.value.error);
  if (failed?.status === "fulfilled" && failed.value.error) console.warn("분리 테이블 동기화 실패:", failed.value.error.message);
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected) console.warn("분리 테이블 동기화 실패:", rejected.reason?.message || rejected.reason);
}

async function loadStructuredState(baseState: AppSnapshot, ownerId: string, deletedDmKeysRef: DeletedDmKeysRef): Promise<AppSnapshot> {
  const [charsResult, charDetailsResult, personasResult, dmResult, sharedDmResult] = await loadStructuredRows(ownerId);
  const next = { ...baseState };
  warnStructuredLoadFailures(charsResult, charDetailsResult);
  applyCharacterRows(next, baseState, charsResult, charDetailsResult);
  applyPersonaRows(next, personasResult);
  applyDmRows(next, dmResult, sharedDmResult, deletedDmKeysRef);
  return next;
}

function warnStructuredLoadFailures(charsResult: SettledQueryResult, charDetailsResult: SettledQueryResult): void {
  if (charsResult.status === "rejected") console.warn("캐릭터 데이터 로드 실패:", charsResult.reason?.message || charsResult.reason);
  else if (charsResult.value.error) console.warn("캐릭터 데이터 로드 실패:", charsResult.value.error.message || charsResult.value.error);
  if (charDetailsResult.status === "rejected") console.warn("캐릭터 세부 데이터 로드 실패:", charDetailsResult.reason?.message || charDetailsResult.reason);
  else if (charDetailsResult.value?.error) console.warn("캐릭터 세부 데이터 로드 실패:", charDetailsResult.value.error.message || charDetailsResult.value.error);
}

function applyCharacterRows(next: AppSnapshot, baseState: AppSnapshot, charsResult: SettledQueryResult, charDetailsResult: SettledQueryResult): void {
  const cachedAccounts = new Map((baseState.accounts || []).map((account) => [account.id, account]));
  const chars = fulfilledRows(charsResult);
  const detailsById = new Map(fulfilledRows(charDetailsResult).map((row) => [row.source_account_id, row]));
  if (!loadedWithoutError(charsResult)) return;
  if (!chars.length) {
    next.accounts = [];
    next.activeId = null;
    next.char = {};
    next.gallery = [];
    next.posts = [];
    next.following = [];
    return;
  }
  next.accounts = chars.map((row) => characterAccountFromRow(row, detailsById, cachedAccounts));
  const activeStillExists = next.activeId && next.accounts.some((account) => account.id === next.activeId);
  if (!activeStillExists) next.activeId = next.accounts[0]?.id || null;
}

function characterAccountFromRow(row: Record<string, unknown>, detailsById: Map<unknown, Record<string, unknown>>, cachedAccounts: Map<unknown, AccountState>): AccountState {
  const cached = cachedAccounts.get(row.source_account_id) || {};
  const detail = detailsById.get(row.source_account_id) || {};
  const rowCharacter = recordValue(row.character);
  return {
    id: stringValue(row.source_account_id),
    char: { ...(cached.char || {}), ...rowCharacter, name: stringValue(rowCharacter.name) || stringValue(row.name) || cached.char?.name || "", handle: stringValue(row.handle) || stringValue(rowCharacter.handle) || cached.char?.handle || "" },
    gallery: Array.isArray(detail.gallery) ? detail.gallery : (cached.gallery || []),
    posts: Array.isArray(detail.posts) ? detail.posts : (cached.posts || []),
    following: Array.isArray(detail.following) ? detail.following : (cached.following || []),
  };
}

function applyPersonaRows(next: AppSnapshot, personasResult: SettledQueryResult): void {
  if (!loadedWithoutError(personasResult)) return;
  next.personas = fulfilledRows(personasResult).map((row) => personaFromRow(row));
}

function loadedWithoutError(result: SettledQueryResult): boolean {
  return result.status === "fulfilled" && !result.value.error;
}

function applyDmRows(next: AppSnapshot, dmResult: SettledQueryResult, sharedDmResult: SettledQueryResult, deletedDmKeysRef: DeletedDmKeysRef): void {
  if (dmResult.status !== "fulfilled" && sharedDmResult.status !== "fulfilled") return;
  const dmLoaded = dmResult.status === "fulfilled" && !dmResult.value.error;
  const sharedLoaded = sharedDmResult.status === "fulfilled" && !sharedDmResult.value.error;
  const dmRows = fulfilledRows(dmResult);
  const sharedDmRows = fulfilledRows(sharedDmResult);
  const deletedSet = deletedKeySet(next, dmRows, sharedDmRows);
  next.deletedDmKeys = [...deletedSet];
  deletedDmKeysRef.current = deletedSet;
  replaceLoadedDmRows(next, dmRows, sharedDmRows, deletedSet, dmLoaded, sharedLoaded);
}

function replaceLoadedDmRows(next: AppSnapshot, dmRows: Record<string, unknown>[], sharedDmRows: Record<string, unknown>[], deletedSet: Set<string>, dmLoaded: boolean, sharedLoaded: boolean): void {
  const shouldReplaceKey = (key: string): boolean => (sharedLoaded && key.startsWith("dm::")) || (dmLoaded && (key.startsWith("owner::") || key.startsWith("local::")));
  next.dmThreads = Object.fromEntries(Object.entries(next.dmThreads || {}).filter(([key]) => !shouldReplaceKey(key)));
  next.dmWorldPrefs = Object.fromEntries(Object.entries(next.dmWorldPrefs || {}).filter(([key]) => !shouldReplaceKey(key)));
  [...dmRows, ...sharedDmRows].forEach((row) => {
    const threadKey = stringValue(row.thread_key);
    const worldPref = recordValue(row.world_pref);
    if (!threadKey || deletedSet.has(threadKey) || worldPref.deleted) return;
    next.dmThreads[threadKey] = Array.isArray(row.messages) ? row.messages : [];
    if (Object.keys(worldPref).length) next.dmWorldPrefs[threadKey] = worldPref;
  });
}

function deletedKeySet(next: AppSnapshot, dmRows: Record<string, unknown>[], sharedDmRows: Record<string, unknown>[]): Set<string> {
  const deletedFromRows = [...dmRows, ...sharedDmRows].filter((row) => recordValue(row.world_pref).deleted).map((row) => stringValue(row.thread_key)).filter(Boolean);
  return new Set([...(next.deletedDmKeys || []), ...deletedFromRows]);
}

function fulfilledRows(result: SettledQueryResult): Record<string, unknown>[] {
  return result.status === "fulfilled" && !result.value.error ? (result.value.data || []) : [];
}

function compactGallery(items: unknown): unknown[] {
  return Array.isArray(items) ? items.slice(-12) : [];
}

function compactFollowing(items: unknown): FollowCharacter[] {
  return Array.isArray(items) ? items.slice(0, 120).map((item) => compactFollowCharacter(item)) : [];
}

function compactCharacter(account: AccountState): CharacterData {
  const { posts: _posts, following: _following, gallery: _gallery, ...baseChar } = account.char || {};
  return baseChar;
}

function compactMessages(messages: unknown): unknown[] {
  return Array.isArray(messages) ? messages.slice(-160) : [];
}

function personaFromRow(row: Record<string, unknown>): PersonaState {
  const persona = recordValue(row.persona);
  return { ...persona, id: stringValue(persona.id) || stringValue(row.persona_id), name: stringValue(persona.name) || stringValue(row.name) || "" };
}

function compactFollowCharacter(item: unknown): FollowCharacter {
  const row = recordValue(item);
  return {
    avatarImg: row.avatarImg,
    external: row.external,
    handle: stringValue(row.handle),
    headerImg: row.headerImg,
    id: stringValue(row.id),
    inner: row.inner,
    name: stringValue(row.name),
    owner: stringValue(row.owner),
    ownerId: stringValue(row.ownerId),
    ownerName: stringValue(row.ownerName),
    persona: row.persona,
    relations: row.relations,
    shared: Boolean(row.shared),
    sharedId: stringValue(row.sharedId),
    sourceAccountId: stringValue(row.sourceAccountId),
    speech: row.speech,
    surface: row.surface,
    tags: row.tags || [],
    world: row.world,
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
