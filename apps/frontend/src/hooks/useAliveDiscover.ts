import { useState, type Dispatch, type SetStateAction } from "react";
import {
  deleteFollowRow as deleteRemoteFollowRow,
  listFollowerCounts,
  listSharedFollowers,
  loadSharedCharacterRow,
  saveRelationshipFollowBack,
  sharedCharacterResults as loadSharedCharacterResults,
  updateSharedCharacter,
  upsertFollowRow as upsertRemoteFollowRow,
  upsertOwnFollowRows,
} from "@/api/discover";
import { updateCharacterVisibility } from "@/api/characters";
import { hasRemoteApiClient, hasBackendApiConfig } from "@/api/client";
import { followerCharacterId, mergeDiscoverCharacters, sameDiscoverCharacter, sharedRowToChar, type CharacterData, type CharacterRow, type DiscoverCharacter, type SharedCharacterRow } from "@/domain/discover/discoverUtils";

type SetState<T> = Dispatch<SetStateAction<T>>;

type SessionLike = {
  user?: {
    email?: string;
    id?: string;
  };
};

type AliveCharacter = CharacterData & {
  age?: string;
  handle?: string;
  interests?: string;
  name?: string;
  persona?: string;
  isPublic?: boolean;
  surface?: string;
};

type FollowerCharacter = DiscoverCharacter & {
  followedAt?: string;
  followerAccountId?: string;
};

type FollowRow = {
  created_at?: string;
  follower_account_id?: string;
  follower_character?: Partial<FollowerCharacter> | null;
  follower_id?: string;
  follower_name?: string;
  id?: string;
  target_shared_character_id?: string;
};

type SharedFollowersState = {
  error: string;
  loading: boolean;
  rows: FollowerCharacter[];
};

type SharedLoadState = {
  error: string;
  loading: boolean;
};

type SharedCharacterQueryResult = PromiseSettledResult<{
  data?: CharacterRow[] | null;
  error: { message?: string } | null;
}>;

type SharedRowsQueryResult = PromiseSettledResult<{
  data?: SharedCharacterRow[] | null;
  error: { message?: string } | null;
}>;

type QueryErrorLike = {
  message?: string;
};

type UseAliveDiscoverOptions = {
  activeId?: string | null;
  char?: AliveCharacter | null;
  onVisibilityChange?: (isPublic: boolean) => void;
  profileName?: string;
  session?: SessionLike | null;
};

type UseAliveDiscoverReturn = {
  activeSharedId: string;
  baseFollowerCount: (name?: string) => number;
  discoverQuery: string;
  discoverShowFollowed: boolean;
  followerCounts: Record<string, number>;
  followPanel: unknown;
  following: DiscoverCharacter[];
  isFollowing: (id: string) => boolean;
  loadFollowerCountsFor: (rows: Array<{ id?: string }>) => Promise<void>;
  loadSharedCharacterById: (sharedId: string) => Promise<DiscoverCharacter | null>;
  loadSharedCharacters: () => Promise<void>;
  loadSharedFollowers: (sharedId?: string) => Promise<void>;
  publicFollowerCount: (char?: DiscoverCharacter | null) => number;
  publicFollowingCount: (char?: { following?: unknown[] } | null) => number;
  publicProfile: unknown;
  recordFollowChange: (poolChar: DiscoverCharacter, wasFollowing: boolean) => Promise<boolean | undefined>;
  recordRelationshipFollowBack: (poolChar: DiscoverCharacter) => Promise<boolean>;
  setActiveSharedId: SetState<string>;
  setCharacterVisibility: (isPublic: boolean) => Promise<boolean>;
  setDiscoverQuery: SetState<string>;
  setDiscoverShowFollowed: SetState<boolean>;
  setFollowerCounts: SetState<Record<string, number>>;
  setFollowPanel: SetState<unknown>;
  setFollowing: SetState<DiscoverCharacter[]>;
  setPublicProfile: SetState<unknown>;
  setSharedCharacters: SetState<DiscoverCharacter[]>;
  setSharedFocusId: SetState<string>;
  setSharedFollowers: SetState<SharedFollowersState>;
  setSharedLoadState: SetState<SharedLoadState>;
  setWorldModal: SetState<unknown>;
  sharedCharacters: DiscoverCharacter[];
  sharedFocusId: string;
  sharedFollowers: SharedFollowersState;
  sharedLoadState: SharedLoadState;
  syncActiveSharedCharacter: (publicPostSnapshot: PostSnapshotProvider, nextFollowing?: DiscoverCharacter[], nextChar?: AliveCharacter | null) => Promise<void>;
  syncOwnFollowRows: (publicPostSnapshot: PostSnapshotProvider, nextFollowing?: DiscoverCharacter[], nextChar?: AliveCharacter | null) => Promise<void>;
  worldModal: unknown;
};

type PostSnapshotProvider = () => unknown[];

type SharedResultRows = {
  characterError: QueryErrorLike | unknown;
  characterRows: CharacterRow[];
  sharedError: QueryErrorLike | unknown;
  sharedRows: SharedCharacterRow[];
};

type OwnFollowRowsOptions = {
  activeId: string;
  nextChar: AliveCharacter;
  nextFollowing: DiscoverCharacter[];
  profileName: string;
  publicPostSnapshot: PostSnapshotProvider;
  session: SessionLike;
};

type FollowRowPayload = {
  follower_account_id: string;
  follower_character: Record<string, unknown>;
  follower_id: string | undefined;
  follower_name: string;
  target_shared_character_id: string;
};

type UpsertFollowRowOptions = {
  activeId: string;
  char: AliveCharacter | null;
  poolChar: DiscoverCharacter;
  profileName: string;
  session: SessionLike;
};

export function useAliveDiscover({ activeId = null, char = null, onVisibilityChange, profileName = "", session = null }: UseAliveDiscoverOptions = {}): UseAliveDiscoverReturn {
  const [publicProfile, setPublicProfile] = useState<unknown>(null);
  const [worldModal, setWorldModal] = useState<unknown>(null);
  const [followPanel, setFollowPanel] = useState<unknown>(null);
  const [following, setFollowing] = useState<DiscoverCharacter[]>([]);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [sharedCharacters, setSharedCharacters] = useState<DiscoverCharacter[]>([]);
  const [sharedLoadState, setSharedLoadState] = useState<SharedLoadState>({ loading: false, error: "" });
  const [discoverShowFollowed, setDiscoverShowFollowed] = useState(false);
  const [sharedFocusId, setSharedFocusId] = useState("");
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [sharedFollowers, setSharedFollowers] = useState<SharedFollowersState>({ loading: false, rows: [], error: "" });
  const [activeSharedId, setActiveSharedId] = useState("");
  const isFollowing = (id: string): boolean => {
    const target = [...sharedCharacters, ...sharedFollowers.rows].find((item) => item.id === id);
    return following.some((item) => target ? sameDiscoverCharacter(item, target) : item.id === id);
  };
  const baseFollowerCount = (name = ""): number => deterministicFollowerCount(name);
  const publicFollowingCount = (target?: { following?: unknown[] } | null): number => Array.isArray(target?.following) ? target.following.length : 0;
  const publicFollowerCount = (target?: DiscoverCharacter | null): number => {
    if (target?.sharedId) return followerCounts[target.sharedId] ?? 0;
    return hasBackendApiConfig ? 0 : baseFollowerCount(target?.name || "");
  };
  async function loadFollowerCountsFor(rows: Array<{ id?: string }>): Promise<void> {
    if (!hasRemoteApiClient() || !rows?.length) return;
    const ids = rows.map((row) => row.id).filter(Boolean);
    if (!ids.length) return;
    const { data, error } = await listFollowerCounts(ids);
    if (error) {
      console.warn("팔로워 수 불러오기 실패:", error);
      return;
    }
    setFollowerCounts((prev) => ({ ...prev, ...(data || {}) }));
  }
  async function loadSharedFollowers(sharedId = activeSharedId): Promise<void> {
    if (!hasRemoteApiClient() || !sharedId) {
      setSharedFollowers({ loading: false, rows: [], error: "" });
      return;
    }
    setSharedFollowers({ loading: true, rows: [], error: "" });
    const { data, error } = await listSharedFollowers(sharedId);
    if (error) {
      console.warn("팔로워 목록 불러오기 실패:", error);
      setSharedFollowers({ loading: false, rows: [], error: error.message || "팔로워를 불러오지 못했어." });
      return;
    }
    const rows = (data || []).map((row) => followerRowToChar(row, sharedCharacters));
    setSharedFollowers({ loading: false, rows, error: "" });
    loadFollowerCountsFor(rows.filter((row) => row.sharedId).map((row) => ({ id: row.sharedId })));
  }
  async function loadSharedCharacters(): Promise<void> {
    if (!hasRemoteApiClient()) return;
    setSharedLoadState({ loading: true, error: "" });
    const [characterResult, sharedResult] = await loadSharedCharacterResults();
    const { characterError, sharedError, characterRows, sharedRows } = sharedResultRows(characterResult, sharedResult);
    if (characterError) console.warn("alive_characters 탐색 불러오기 실패:", characterError);
    if (sharedError) console.warn("공유 정보 불러오기 실패:", sharedError);
    const merged = mergeDiscoverCharacters(sharedRows, characterRows);
    setSharedCharacters(merged);
    setSharedLoadState({ loading: false, error: characterError && !merged.length ? (errorMessage(characterError) || "alive_characters를 불러오지 못했어.") : "" });
    loadFollowerCountsFor(sharedRows);
  }
  async function loadSharedCharacterById(sharedId: string): Promise<DiscoverCharacter | null> {
    if (!hasRemoteApiClient() || !sharedId) return null;
    setSharedLoadState({ loading: true, error: "" });
    const { data, error } = await loadSharedCharacterRow(sharedId);
    if (error) {
      console.warn("공유 링크 캐릭터 불러오기 실패:", error);
      setSharedLoadState({ loading: false, error: error.message || "공유 캐릭터를 불러오지 못했어." });
      return null;
    }
    if (!data) {
      setSharedLoadState({ loading: false, error: "이 공유 링크의 캐릭터를 찾지 못했어." });
      return null;
    }
    const next = sharedRowToChar(data);
    setSharedCharacters((prev) => [next, ...(prev || []).filter((item) => item.sharedId !== next.sharedId)]);
    setSharedLoadState({ loading: false, error: "" });
    loadFollowerCountsFor([data]);
    return next;
  }
  async function setCharacterVisibility(isPublic: boolean): Promise<boolean> {
    if (!activeId || !hasRemoteApiClient() || !session?.user) return false;
    try {
      const { is_public, shared_id } = await updateCharacterVisibility(activeId, isPublic);
      onVisibilityChange?.(is_public);
      setActiveSharedId(shared_id);
      loadSharedCharacters();
      return true;
    } catch (error) {
      return false;
    }
  }
  async function syncActiveSharedCharacter(publicPostSnapshot: PostSnapshotProvider, nextFollowing = following, nextChar = char): Promise<void> {
    if (!hasRemoteApiClient() || !session?.user || !activeId || !activeSharedId || !nextChar?.name?.trim()) return;
    const { error } = await updateSharedCharacter(session.user.id, activeId, sharedCharacterUpdatePayload(nextChar, nextFollowing, publicPostSnapshot));
    if (error) console.warn("공유 캐릭터 스냅샷 갱신 실패:", error);
  }
  async function syncOwnFollowRows(publicPostSnapshot: PostSnapshotProvider, nextFollowing = following, nextChar = char): Promise<void> {
    if (!hasRemoteApiClient() || !session?.user || !activeId || !nextChar?.name?.trim()) return;
    const rows = ownFollowRows({ activeId, nextChar, nextFollowing, profileName, publicPostSnapshot, session });
    if (!rows.length) return;
    const { error } = await upsertOwnFollowRows(rows);
    if (error) console.warn("팔로우 캐릭터 스냅샷 갱신 실패:", error);
  }
  async function recordFollowChange(poolChar: DiscoverCharacter, wasFollowing: boolean): Promise<boolean | undefined> {
    if (!hasRemoteApiClient() || !session?.user || !activeId || !poolChar?.sharedId) return;
    const ok = wasFollowing ? await deleteFollowRow(session.user.id, activeId, poolChar.sharedId) : await upsertFollowRow({ activeId, char, poolChar, profileName, session });
    if (ok) updateFollowerCount(poolChar.sharedId, wasFollowing);
    loadFollowerCountsFor([{ id: poolChar.sharedId }]);
    return ok;
  }
  async function recordRelationshipFollowBack(poolChar: DiscoverCharacter): Promise<boolean> {
    if (!hasRemoteApiClient() || !session?.user || !activeSharedId || !poolChar?.sharedId) return false;
    const { error } = await saveRelationshipFollowBack(poolChar.sharedId, activeSharedId);
    if (error) {
      console.warn("연인 맞팔 저장 실패:", error);
      return false;
    }
    loadFollowerCountsFor([{ id: activeSharedId }, { id: poolChar.sharedId }]);
    return true;
  }
  function updateFollowerCount(sharedId: string, wasFollowing: boolean): void {
    setFollowerCounts((prev) => ({ ...prev, [sharedId]: Math.max(0, (prev[sharedId] || 0) + (wasFollowing ? -1 : 1)) }));
  }
  return { activeSharedId, baseFollowerCount, discoverQuery, discoverShowFollowed, followerCounts, followPanel, following, isFollowing, loadFollowerCountsFor, loadSharedCharacterById, loadSharedCharacters, loadSharedFollowers, publicFollowerCount, publicFollowingCount, publicProfile, recordFollowChange, recordRelationshipFollowBack, setActiveSharedId, setCharacterVisibility, setDiscoverQuery, setDiscoverShowFollowed, setFollowerCounts, setFollowPanel, setFollowing, setPublicProfile, setSharedCharacters, setSharedFocusId, setSharedFollowers, setSharedLoadState, setWorldModal, sharedCharacters, sharedFocusId, sharedFollowers, sharedLoadState, syncActiveSharedCharacter, syncOwnFollowRows, worldModal };
}

function deterministicFollowerCount(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) % 9000;
  return 800 + hash;
}

function followerRowToChar(row: FollowRow, sharedCharacters: DiscoverCharacter[]): FollowerCharacter {
  const character = row.follower_character || {};
  const shared = sharedCharacters.find((item) => item.ownerId === row.follower_id && item.sourceAccountId === row.follower_account_id);
  return { ...(shared || {}), ...character, characterId: shared?.characterId || character.characterId || "", external: shared?.external ?? true, id: shared?.id || followerCharacterId(row.id), shared: Boolean(shared), sharedId: shared?.sharedId || "", ownerId: row.follower_id, sourceAccountId: row.follower_account_id, name: character.name || row.follower_name || "이름 없음", handle: character.handle || "", owner: shared?.owner || `@${row.follower_name || "user"}`, ownerName: shared?.ownerName || row.follower_name || "user", persona: character.persona || shared?.persona || "", tags: character.tags || shared?.tags || [], posts: character.posts || shared?.posts || [], followerAccountId: row.follower_account_id, followedAt: row.created_at };
}

function sharedResultRows(characterResult: SharedCharacterQueryResult, sharedResult: SharedRowsQueryResult): SharedResultRows {
  const characterError = characterResult.status === "fulfilled" ? characterResult.value.error : characterResult.reason;
  const sharedError = sharedResult.status === "fulfilled" ? sharedResult.value.error : sharedResult.reason;
  const characterRows = characterResult.status === "fulfilled" && !characterResult.value.error ? (characterResult.value.data || []) : [];
  const sharedRows = sharedResult.status === "fulfilled" && !sharedResult.value.error ? (sharedResult.value.data || []) : [];
  return { characterError, sharedError, characterRows, sharedRows };
}

function sharedCharacterUpdatePayload(char: AliveCharacter, following: DiscoverCharacter[], publicPostSnapshot: PostSnapshotProvider): Record<string, unknown> {
  return { name: char.name, handle: char.handle || "", persona: char.persona || "", tags: [char.age, char.surface, char.interests].filter(Boolean).slice(0, 6), character: { ...char, following, posts: publicPostSnapshot() } };
}


function ownFollowRows({ activeId, nextChar, nextFollowing, profileName, publicPostSnapshot, session }: OwnFollowRowsOptions): FollowRowPayload[] {
  return (nextFollowing || []).filter((item) => item?.sharedId).map((item) => ({ follower_id: session.user.id, follower_name: profileName || session.user.email?.split("@")[0] || "user", follower_account_id: activeId, follower_character: { ...nextChar, following: nextFollowing, posts: publicPostSnapshot() }, target_shared_character_id: item.sharedId }));
}

async function deleteFollowRow(userId: string, activeId: string, sharedId: string): Promise<boolean> {
  const { error } = await deleteRemoteFollowRow(userId, activeId, sharedId);
  if (error) console.warn("언팔로우 저장 실패:", error);
  return !error;
}

async function upsertFollowRow({ activeId, char, poolChar, profileName, session }: UpsertFollowRowOptions): Promise<boolean> {
  const payload = { follower_id: session.user.id, follower_name: profileName || session.user.email?.split("@")[0] || "user", follower_account_id: activeId, follower_character: { ...char }, target_shared_character_id: poolChar.sharedId };
  const { error, ok } = await upsertRemoteFollowRow(payload);
  if (error) console.warn("팔로우 저장 실패:", error);
  return !error && ok;
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const message = (error as QueryErrorLike).message;
  return typeof message === "string" ? message : "";
}
