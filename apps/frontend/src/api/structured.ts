import { withRejectTimeout } from "@/domain/app/asyncUtils";
import { resultWithError, type ApiError } from "@/api/client";
import { supabase } from "@/supabaseClient";

export type QueryResult = {
  data?: Record<string, unknown>[] | null;
  error?: ApiError | null;
};

export type SettledQueryResult = PromiseSettledResult<QueryResult>;

type StructuredRows = {
  characterRows: Record<string, unknown>[];
  ownerDmRows: Record<string, unknown>[];
  personaRows: Record<string, unknown>[];
  sharedDmRows: Record<string, unknown>[];
};

export function deleteStructuredCharacterData(ownerId: string, targetId: string): Promise<SettledQueryResult[]> {
  if (!supabase) return Promise.resolve([]);
  return Promise.allSettled([
    supabase.from("alive_characters").delete().eq("owner_id", ownerId).eq("source_account_id", targetId),
    supabase.from("alive_shared_characters").delete().eq("owner_id", ownerId).eq("source_account_id", targetId),
    supabase.from("alive_character_follows").delete().eq("follower_id", ownerId).eq("follower_account_id", targetId),
    supabase.from("alive_dm_threads").delete().eq("owner_id", ownerId).like("thread_key", `owner::${targetId}::%`),
  ].map((query) => Promise.resolve(query).then(resultWithError)));
}

export function syncStructuredRows(rows: StructuredRows): Promise<SettledQueryResult[]> {
  if (!supabase) return Promise.resolve([]);
  const jobs = structuredUpsertJobs(rows);
  return Promise.allSettled(jobs.map((job, index) =>
    withRejectTimeout(job, 7000, `분리 테이블 동기화 ${index + 1}`)
  ));
}

export function loadStructuredRows(ownerId: string): Promise<SettledQueryResult[]> {
  if (!supabase) return Promise.resolve([]);
  return Promise.allSettled([
    timedQuery(characterListQuery(ownerId), "캐릭터 목록 로드"),
    timedQuery(characterDetailQuery(ownerId), "캐릭터 세부 데이터 로드", 3500),
    timedQuery(personaQuery(ownerId), "페르소나 데이터 로드", 3500),
    timedQuery(ownerDmQuery(ownerId), "개인 DM 데이터 로드", 3500),
    timedQuery(sharedDmQuery(ownerId), "공유 DM 데이터 로드", 3500),
  ]);
}

function structuredUpsertJobs({ characterRows, ownerDmRows, personaRows, sharedDmRows }: StructuredRows): Array<Promise<QueryResult>> {
  const jobs: Array<Promise<QueryResult>> = [];
  if (characterRows.length) jobs.push(Promise.resolve(supabase.from("alive_characters").upsert(characterRows, { onConflict: "owner_id,source_account_id" })) as Promise<QueryResult>);
  if (personaRows.length) jobs.push(Promise.resolve(supabase.from("alive_personas").upsert(personaRows, { onConflict: "owner_id,persona_id" })) as Promise<QueryResult>);
  if (ownerDmRows.length) jobs.push(Promise.resolve(supabase.from("alive_dm_threads").upsert(ownerDmRows, { onConflict: "owner_id,thread_key" })) as Promise<QueryResult>);
  if (sharedDmRows.length) jobs.push(Promise.resolve(supabase.from("alive_shared_dm_threads").upsert(sharedDmRows, { onConflict: "thread_key" })) as Promise<QueryResult>);
  return jobs;
}

function timedQuery(query: unknown, label: string, ms = 4500): Promise<QueryResult> {
  return withRejectTimeout(Promise.resolve(query) as Promise<QueryResult>, ms, label);
}

function characterListQuery(ownerId: string): unknown {
  return supabase.from("alive_characters").select("source_account_id,name,handle,character,updated_at").eq("owner_id", ownerId).limit(80);
}

function characterDetailQuery(ownerId: string): unknown {
  return supabase.from("alive_characters").select("source_account_id,gallery,posts,following").eq("owner_id", ownerId).limit(80);
}

function personaQuery(ownerId: string): unknown {
  return supabase.from("alive_personas").select("persona_id,name,persona,updated_at").eq("owner_id", ownerId).limit(80);
}

function ownerDmQuery(ownerId: string): unknown {
  return supabase.from("alive_dm_threads").select("thread_key,messages,world_pref,updated_at").eq("owner_id", ownerId).limit(80);
}

function sharedDmQuery(ownerId: string): unknown {
  return supabase.from("alive_shared_dm_threads").select("thread_key,messages,world_pref,updated_at").contains("participant_user_ids", [ownerId]).limit(80);
}
