import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  deleteFollowRow as deleteRemoteFollowRow,
  listFollowerTargetRows,
  listSharedFollowers,
  loadSharedCharacterRow,
  saveRelationshipFollowBack,
  sharedCharacterResults as loadSharedCharacterResults,
  updateSharedCharacter,
  upsertFollowRow as upsertRemoteFollowRow,
  upsertOwnFollowRows,
  upsertSharedCharacter,
} from "@/api/discover";
import { hasRemoteApiClient, hasRemoteApiConfig as hasSupabaseConfig } from "@/api/client";
import { mergeDiscoverCharacters, sharedRowToChar, type CharacterRow, type DiscoverCharacter, type SharedCharacterRow } from "@/domain/discover/discoverUtils";

type SetState<T> = Dispatch<SetStateAction<T>>;

type SessionLike = {
  user?: {
    email?: string;
    id?: string;
  };
};

type AliveCharacter = DiscoverCharacter & {
  age?: string;
  handle?: string;
  interests?: string;
  name?: string;
  persona?: string;
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
  profileName?: string;
  session?: SessionLike | null;
};

type UseAliveDiscoverReturn = {
  activeSharedId: string;
  baseFollowerCount: (name?: string) => number;
  discoverQuery: string;
  discoverShowFollowed: boolean;
  flashShareStatus: (message: string, ms?: number) => void;
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
  setShareStatus: SetState<string>;
  setWorldModal: SetState<unknown>;
  shareCurrentCharacter: (publicPostSnapshot: PostSnapshotProvider) => Promise<void>;
  sharedCharacters: DiscoverCharacter[];
  sharedFocusId: string;
  sharedFollowers: SharedFollowersState;
  sharedLoadState: SharedLoadState;
  shareStatus: string;
  shareStatusTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
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

type SharedPayloadOptions = {
  activeId: string;
  char: AliveCharacter;
  following: DiscoverCharacter[];
  profileName: string;
  publicPostSnapshot: PostSnapshotProvider;
  session: SessionLike;
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

export function useAliveDiscover({ activeId = null, char = null, profileName = "", session = null }: UseAliveDiscoverOptions = {}): UseAliveDiscoverReturn {
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
  const [shareStatus, setShareStatus] = useState<string>("");
  const shareStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFollowing = (id: string): boolean => following.some((item) => item.id === id);
  const baseFollowerCount = (name = ""): number => deterministicFollowerCount(name);
  const publicFollowingCount = (target?: { following?: unknown[] } | null): number => Array.isArray(target?.following) ? target.following.length : 0;
  const publicFollowerCount = (target?: DiscoverCharacter | null): number => {
    if (target?.sharedId) return followerCounts[target.sharedId] ?? 0;
    return hasSupabaseConfig ? 0 : baseFollowerCount(target?.name || "");
  };
  async function loadFollowerCountsFor(rows: Array<{ id?: string }>): Promise<void> {
    if (!hasRemoteApiClient() || !rows?.length) return;
    const ids = rows.map((row) => row.id).filter(Boolean);
    if (!ids.length) return;
    const { data, error } = await listFollowerTargetRows(ids);
    if (error) {
      console.warn("팔로워 수 불러오기 실패:", error);
      return;
    }
    setFollowerCounts((prev) => ({ ...prev, ...followerCountsForRows(ids, data || []) }));
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
  async function shareCurrentCharacter(publicPostSnapshot: PostSnapshotProvider): Promise<void> {
    if (!activeId || !char?.name?.trim()) return;
    if (!hasRemoteApiClient() || !session?.user) {
      flashShareStatus("로그인 후 공유할 수 있어.");
      return;
    }
    const { data, error } = await upsertSharedCharacter(sharedCharacterPayload({ activeId, char, following, profileName, publicPostSnapshot, session }));
    if (error) {
      flashShareStatus(`공유 실패: ${error.message}`, 3600);
      return;
    }
    setActiveSharedId(data.id);
    await writeShareUrl(data.id, flashShareStatus);
    loadSharedCharacters();
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
  function flashShareStatus(message: string, ms = 2200): void {
    if (shareStatusTimerRef.current) clearTimeout(shareStatusTimerRef.current);
    setShareStatus(message);
    shareStatusTimerRef.current = setTimeout(() => {
      setShareStatus("");
      shareStatusTimerRef.current = null;
    }, ms);
  }
  useEffect(() => () => {
    if (shareStatusTimerRef.current) clearTimeout(shareStatusTimerRef.current);
  }, []);
  function updateFollowerCount(sharedId: string, wasFollowing: boolean): void {
    setFollowerCounts((prev) => ({ ...prev, [sharedId]: Math.max(0, (prev[sharedId] || 0) + (wasFollowing ? -1 : 1)) }));
  }
  return { activeSharedId, baseFollowerCount, discoverQuery, discoverShowFollowed, flashShareStatus, followerCounts, followPanel, following, isFollowing, loadFollowerCountsFor, loadSharedCharacterById, loadSharedCharacters, loadSharedFollowers, publicFollowerCount, publicFollowingCount, publicProfile, recordFollowChange, recordRelationshipFollowBack, setActiveSharedId, setDiscoverQuery, setDiscoverShowFollowed, setFollowerCounts, setFollowPanel, setFollowing, setPublicProfile, setSharedCharacters, setSharedFocusId, setSharedFollowers, setSharedLoadState, setShareStatus, setWorldModal, shareCurrentCharacter, sharedCharacters, sharedFocusId, sharedFollowers, sharedLoadState, shareStatus, shareStatusTimerRef, syncActiveSharedCharacter, syncOwnFollowRows, worldModal };
}

function deterministicFollowerCount(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) % 9000;
  return 800 + hash;
}

function followerCountsForRows(ids: string[], rows: FollowRow[]): Record<string, number> {
  const counts = Object.fromEntries(ids.map((id) => [id, 0]));
  rows.forEach((row) => {
    if (!row.target_shared_character_id) return;
    counts[row.target_shared_character_id] = (counts[row.target_shared_character_id] || 0) + 1;
  });
  return counts;
}

function followerRowToChar(row: FollowRow, sharedCharacters: DiscoverCharacter[]): FollowerCharacter {
  const character = row.follower_character || {};
  const shared = sharedCharacters.find((item) => item.ownerId === row.follower_id && item.sourceAccountId === row.follower_account_id);
  return { ...(shared || {}), ...character, external: shared?.external ?? true, id: shared?.id || `follower_${row.id}`, shared: Boolean(shared), sharedId: shared?.sharedId || "", ownerId: row.follower_id, sourceAccountId: row.follower_account_id, name: character.name || row.follower_name || "이름 없음", handle: character.handle || "", owner: shared?.owner || `@${row.follower_name || "user"}`, ownerName: shared?.ownerName || row.follower_name || "user", persona: character.persona || shared?.persona || "", tags: character.tags || shared?.tags || [], posts: character.posts || shared?.posts || [], followerAccountId: row.follower_account_id, followedAt: row.created_at };
}

function sharedResultRows(characterResult: SharedCharacterQueryResult, sharedResult: SharedRowsQueryResult): SharedResultRows {
  const characterError = characterResult.status === "fulfilled" ? characterResult.value.error : characterResult.reason;
  const sharedError = sharedResult.status === "fulfilled" ? sharedResult.value.error : sharedResult.reason;
  const characterRows = characterResult.status === "fulfilled" && !characterResult.value.error ? (characterResult.value.data || []) : [];
  const sharedRows = sharedResult.status === "fulfilled" && !sharedResult.value.error ? (sharedResult.value.data || []) : [];
  return { characterError, sharedError, characterRows, sharedRows };
}

function sharedCharacterPayload({ activeId, char, following, profileName, publicPostSnapshot, session }: SharedPayloadOptions): Record<string, unknown> {
  return { owner_id: session.user.id, owner_name: profileName || session.user.email?.split("@")[0] || "user", source_account_id: activeId, name: char.name, handle: char.handle || "", persona: char.persona || "", tags: [char.age, char.surface, char.interests].filter(Boolean).slice(0, 6), character: { ...char, following, posts: publicPostSnapshot() } };
}

function sharedCharacterUpdatePayload(char: AliveCharacter, following: DiscoverCharacter[], publicPostSnapshot: PostSnapshotProvider): Record<string, unknown> {
  return { name: char.name, handle: char.handle || "", persona: char.persona || "", tags: [char.age, char.surface, char.interests].filter(Boolean).slice(0, 6), character: { ...char, following, posts: publicPostSnapshot() } };
}

async function writeShareUrl(sharedId: string, flashShareStatus: (message: string, ms?: number) => void): Promise<void> {
  const url = `${window.location.origin}/?shared=${sharedId}`;
  try {
    await navigator.clipboard.writeText(url);
    flashShareStatus("공유 링크를 복사했어.");
  } catch (error) {
    flashShareStatus(url, 4200);
  }
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
  const { error } = await upsertRemoteFollowRow(payload);
  if (error) console.warn("팔로우 저장 실패:", error);
  return !error;
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const message = (error as QueryErrorLike).message;
  return typeof message === "string" ? message : "";
}
