import type { CharacterRow, SharedCharacterRow } from "@/domain/discover/discoverUtils";
import { apiNoContent, apiResult, type ApiError, type ApiResult } from "./client.js";

export type FollowRow = {
  created_at?: string;
  follower_account_id?: string;
  follower_character?: Record<string, unknown> | null;
  follower_id?: string;
  follower_name?: string;
  id?: string;
  target_shared_character_id?: string;
};

export type DiscoverQueryResult<T> = PromiseSettledResult<{
  data?: T[] | null;
  error: ApiError | null;
}>;

type DiscoverResponse = {
  characters?: DiscoverCharacterDto[];
};

type DiscoverCharacterDto = {
  autoSynced?: boolean;
  characterId?: string;
  character?: Record<string, unknown>;
  followedAt?: string | null;
  followerAccountId?: string;
  following?: Record<string, unknown>[];
  gallery?: unknown[];
  handle?: string;
  id?: string;
  name?: string;
  ownerId?: string;
  ownerName?: string;
  persona?: string;
  posts?: Record<string, unknown>[];
  shared?: boolean;
  sharedId?: string;
  sourceAccountId?: string;
  tags?: unknown[];
};

type FollowerCountsResponse = {
  counts?: Record<string, number>;
};

type FollowersResponse = {
  rows?: DiscoverCharacterDto[];
};

type ShareIdResponse = {
  id?: string | null;
};

type SharedCharacterPayload = Record<string, unknown> & {
  character?: Record<string, unknown>;
  handle?: string;
  name?: string;
  owner_name?: string;
  persona?: string;
  source_account_id?: string;
  tags?: unknown[];
};

type FollowPayload = Record<string, unknown> & {
  follower_account_id?: string;
  follower_character?: Record<string, unknown>;
  follower_name?: string;
  target_shared_character_id?: string;
};

type FollowResponse = {
  ok?: boolean;
};

export async function listFollowerTargetRows(ids: string[]): Promise<ApiResult<FollowRow[]>> {
  const result = await apiResult<FollowerCountsResponse>("/shared-characters/follower-counts", { query: { ids } });
  if (result.error) return { data: null, error: result.error };
  return { data: followerRowsForCounts(result.data?.counts || {}), error: null };
}

export async function listSharedFollowers(sharedId: string): Promise<ApiResult<FollowRow[]>> {
  const result = await apiResult<FollowersResponse>(`/shared-characters/${encodeURIComponent(sharedId)}/followers`);
  if (result.error) return { data: null, error: result.error };
  return { data: (result.data?.rows || []).map(followerDtoToRow), error: null };
}

export async function loadSharedCharacterRow(sharedId: string): Promise<ApiResult<SharedCharacterRow>> {
  const result = await apiResult<DiscoverCharacterDto>(`/shared-characters/${encodeURIComponent(sharedId)}`);
  if (result.error) return { data: null, error: result.error };
  return { data: sharedDtoToRow(result.data || {}), error: null };
}

export async function upsertSharedCharacter(payload: unknown): Promise<ApiResult<{ id: string }>> {
  const sourceAccountId = sourceAccountIdFromPayload(payload);
  const result = await apiResult<ShareIdResponse>(`/shared-characters/by-source/${encodeURIComponent(sourceAccountId)}`, {
    method: "PUT",
    body: JSON.stringify(sharedCharacterBody(payload)),
  });
  return shareIdResult(result);
}

export function updateSharedCharacter(_ownerId: string, sourceAccountId: string, payload: unknown): Promise<{ error: ApiError | null }> {
  return apiNoContent(`/shared-characters/by-source/${encodeURIComponent(sourceAccountId)}`, {
    method: "PATCH",
    body: JSON.stringify(sharedCharacterBody(payload)),
  });
}

export function upsertOwnFollowRows(rows: unknown[]): Promise<{ error: ApiError | null }> {
  return apiNoContent("/follows/sync-owned-snapshot", {
    method: "POST",
    body: JSON.stringify({ rows: rows.map(followSnapshotBody) }),
  });
}

export function saveRelationshipFollowBack(poolSharedId: string, activeSharedId: string): Promise<{ error: ApiError | null }> {
  return apiNoContent(`/shared-characters/${encodeURIComponent(activeSharedId)}/relationship-follow-back`, {
    method: "POST",
    body: JSON.stringify({ follower_shared_character_id: poolSharedId }),
  });
}

export async function sharedCharacterResults(): Promise<[DiscoverQueryResult<CharacterRow>, DiscoverQueryResult<SharedCharacterRow>]> {
  const result = await apiResult<DiscoverResponse>("/discover/characters");
  if (result.error) return [fulfilledQuery(null, result.error), fulfilledQuery(null, result.error)];
  const characters = result.data?.characters || [];
  return [fulfilledQuery(charRows(characters), null), fulfilledQuery(sharedRows(characters), null)];
}

export function deleteFollowRow(_userId: string, activeId: string, sharedId: string): Promise<{ error: ApiError | null }> {
  return apiNoContent(`/shared-characters/${encodeURIComponent(sharedId)}/follow`, {
    method: "DELETE",
    query: { follower_account_id: activeId },
  });
}

export async function upsertFollowRow(payload: unknown): Promise<{ error: ApiError | null; ok: boolean }> {
  const next = followPayload(payload);
  const result = await apiResult<FollowResponse>(`/shared-characters/${encodeURIComponent(next.target_shared_character_id || "")}/follow`, {
    method: "PUT",
    body: JSON.stringify(followBody(next)),
  });
  return { error: result.error, ok: Boolean(result.data?.ok) };
}

export async function loadActiveSharedCharacterId(_ownerId: string, sourceAccountId: string): Promise<{ data: { id?: string } | null; error: ApiError | null }> {
  const result = await apiResult<ShareIdResponse>(`/characters/${encodeURIComponent(sourceAccountId)}/share`);
  if (result.error) return { data: null, error: result.error };
  const id = stringValue(result.data?.id);
  return { data: id ? { id } : null, error: null };
}

function sharedDtoToRow(item: DiscoverCharacterDto): SharedCharacterRow {
  return {
    id: stringValue(item.sharedId),
    character_id: stringValue(item.characterId),
    owner_id: stringValue(item.ownerId),
    owner_name: stringValue(item.ownerName),
    source_account_id: stringValue(item.sourceAccountId),
    name: stringValue(item.name),
    handle: stringValue(item.handle),
    persona: stringValue(item.persona),
    tags: arrayValue(item.tags),
    character: recordValue(item.character),
  };
}

function characterDtoToRow(item: DiscoverCharacterDto): CharacterRow {
  return {
    character_id: stringValue(item.characterId),
    owner_id: stringValue(item.ownerId),
    owner_name: stringValue(item.ownerName),
    source_account_id: stringValue(item.sourceAccountId),
    name: stringValue(item.name),
    handle: stringValue(item.handle),
    character: recordValue(item.character),
    gallery: arrayValue(item.gallery),
    posts: recordArrayValue(item.posts),
    following: recordArrayValue(item.following),
  };
}

function followerDtoToRow(item: DiscoverCharacterDto): FollowRow {
  return {
    created_at: stringValue(item.followedAt),
    follower_account_id: stringValue(item.followerAccountId || item.sourceAccountId),
    follower_character: recordValue(item.character),
    follower_id: stringValue(item.ownerId),
    follower_name: stringValue(item.ownerName || item.name),
    id: stringValue(item.id),
  };
}

function sharedCharacterBody(payload: unknown): SharedCharacterPayload {
  const next = sharedPayload(payload);
  return {
    owner_name: stringValue(next.owner_name) || "user",
    name: stringValue(next.name) || "이름 없음",
    handle: stringValue(next.handle),
    persona: stringValue(next.persona),
    tags: stringArrayValue(next.tags),
    character: recordValue(next.character),
  };
}

function followSnapshotBody(value: unknown): FollowPayload {
  const row = followPayload(value);
  return {
    target_shared_character_id: stringValue(row.target_shared_character_id),
    follower_name: stringValue(row.follower_name) || "user",
    follower_account_id: stringValue(row.follower_account_id),
    follower_character: recordValue(row.follower_character),
  };
}

function followBody(payload: FollowPayload): FollowPayload {
  return {
    follower_name: stringValue(payload.follower_name) || "user",
    follower_account_id: stringValue(payload.follower_account_id),
    follower_character: recordValue(payload.follower_character),
  };
}

function shareIdResult(result: ApiResult<ShareIdResponse>): ApiResult<{ id: string }> {
  if (result.error) return { data: null, error: result.error };
  const id = stringValue(result.data?.id);
  return id ? { data: { id }, error: null } : { data: null, error: { message: "Share id missing." } };
}

function followerRowsForCounts(counts: Record<string, number>): FollowRow[] {
  return Object.entries(counts).flatMap(([id, count]) => Array.from({ length: Math.max(0, Math.floor(count)) }, () => ({ target_shared_character_id: id })));
}

function charRows(characters: DiscoverCharacterDto[]): CharacterRow[] {
  return characters.filter((item) => item.autoSynced && !item.shared).map(characterDtoToRow);
}

function sharedRows(characters: DiscoverCharacterDto[]): SharedCharacterRow[] {
  return characters.filter((item) => item.shared || item.sharedId).map(sharedDtoToRow);
}

function fulfilledQuery<T>(data: T[] | null, error: ApiError | null): PromiseFulfilledResult<{ data?: T[] | null; error: ApiError | null }> {
  return { status: "fulfilled", value: { data, error } };
}

function sourceAccountIdFromPayload(payload: unknown): string {
  return stringValue(sharedPayload(payload).source_account_id);
}

function sharedPayload(value: unknown): SharedCharacterPayload {
  return value && typeof value === "object" ? value as SharedCharacterPayload : {};
}

function followPayload(value: unknown): FollowPayload {
  return value && typeof value === "object" ? value as FollowPayload : {};
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordArrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
