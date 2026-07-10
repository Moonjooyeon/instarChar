import type { CharacterRow, SharedCharacterRow } from "@/domain/discover/discoverUtils";
import { queryResult, resultWithError, type ApiError, type ApiResult } from "@/api/client";
import { supabase } from "@/supabaseClient";

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

export function listFollowerTargetRows(ids: string[]): Promise<ApiResult<FollowRow[]>> {
  if (!supabase) return Promise.resolve(unavailableQueryResult<FollowRow[]>());
  return runQuery<FollowRow[]>(supabase.from("alive_character_follows").select("target_shared_character_id").in("target_shared_character_id", ids));
}

export function listSharedFollowers(sharedId: string): Promise<ApiResult<FollowRow[]>> {
  if (!supabase) return Promise.resolve(unavailableQueryResult<FollowRow[]>());
  return runQuery<FollowRow[]>(supabase.from("alive_character_follows").select("id,follower_id,follower_name,follower_account_id,follower_character,created_at").eq("target_shared_character_id", sharedId).order("created_at", { ascending: false }));
}

export function loadSharedCharacterRow(sharedId: string): Promise<ApiResult<SharedCharacterRow>> {
  if (!supabase) return Promise.resolve(unavailableQueryResult<SharedCharacterRow>());
  return runQuery<SharedCharacterRow>(supabase.from("alive_shared_characters").select("id,owner_id,owner_name,source_account_id,name,handle,persona,tags,character,created_at").eq("id", sharedId).maybeSingle());
}

export function upsertSharedCharacter(payload: unknown): Promise<ApiResult<{ id: string }>> {
  if (!supabase) return Promise.resolve(unavailableQueryResult<{ id: string }>());
  return runQuery<{ id: string }>(supabase.from("alive_shared_characters").upsert(payload, { onConflict: "owner_id,source_account_id" }).select("id").single());
}

export function updateSharedCharacter(ownerId: string, sourceAccountId: string, payload: unknown): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve({ error: { message: "Discover client is not configured." } });
  return Promise.resolve(supabase.from("alive_shared_characters").update(payload).eq("owner_id", ownerId).eq("source_account_id", sourceAccountId)).then(resultWithError);
}

export function upsertOwnFollowRows(rows: unknown[]): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve({ error: { message: "Discover client is not configured." } });
  return Promise.resolve(supabase.from("alive_character_follows").upsert(rows, { onConflict: "follower_id,follower_account_id,target_shared_character_id" })).then(resultWithError);
}

export function saveRelationshipFollowBack(poolSharedId: string, activeSharedId: string): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve({ error: { message: "Discover client is not configured." } });
  return Promise.resolve(supabase.rpc("alive_relationship_follow_back", { p_follower_shared_character_id: poolSharedId, p_target_shared_character_id: activeSharedId })).then(resultWithError);
}

export function sharedCharacterResults(): Promise<[DiscoverQueryResult<CharacterRow>, DiscoverQueryResult<SharedCharacterRow>]> {
  if (!supabase) return Promise.resolve([rejectedQueryResult(), rejectedQueryResult()]);
  return Promise.allSettled([characterRowsQuery(), sharedRowsQuery()]) as Promise<[DiscoverQueryResult<CharacterRow>, DiscoverQueryResult<SharedCharacterRow>]>;
}

export function deleteFollowRow(userId: string, activeId: string, sharedId: string): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve({ error: { message: "Discover client is not configured." } });
  return Promise.resolve(supabase.from("alive_character_follows").delete().eq("follower_id", userId).eq("follower_account_id", activeId).eq("target_shared_character_id", sharedId)).then(resultWithError);
}

export function upsertFollowRow(payload: unknown): Promise<{ error: ApiError | null }> {
  if (!supabase) return Promise.resolve({ error: { message: "Discover client is not configured." } });
  return Promise.resolve(supabase.from("alive_character_follows").upsert(payload, { onConflict: "follower_id,follower_account_id,target_shared_character_id" })).then(resultWithError);
}

export async function loadActiveSharedCharacterId(ownerId: string, sourceAccountId: string): Promise<{ data: { id?: string } | null; error: ApiError | null }> {
  if (!supabase) return unavailableQueryResult<{ id?: string }>();
  const result = await supabase.from("alive_shared_characters").select("id").eq("owner_id", ownerId).eq("source_account_id", sourceAccountId).maybeSingle();
  const next = queryResult<{ id?: string }>(result);
  return { data: next.data || null, error: next.error || null };
}

function characterRowsQuery(): Promise<ApiResult<CharacterRow[]>> {
  return runQuery<CharacterRow[]>(supabase.from("alive_characters").select("owner_id,source_account_id,name,handle,character,gallery,posts,following,updated_at").order("updated_at", { ascending: false }).limit(120));
}

function sharedRowsQuery(): Promise<ApiResult<SharedCharacterRow[]>> {
  return runQuery<SharedCharacterRow[]>(supabase.from("alive_shared_characters").select("id,owner_id,owner_name,source_account_id,name,handle,persona,tags,character,created_at").order("created_at", { ascending: false }).limit(80));
}

function unavailableQueryResult<T>(): { data: T | null; error: ApiError } {
  return { data: null, error: { message: "Discover client is not configured." } };
}

function rejectedQueryResult<T>(): PromiseRejectedResult {
  return { reason: "Discover client is not configured.", status: "rejected" };
}

async function runQuery<T>(query: unknown): Promise<ApiResult<T>> {
  const result = await Promise.resolve(query);
  return queryResult<T>(result);
}
