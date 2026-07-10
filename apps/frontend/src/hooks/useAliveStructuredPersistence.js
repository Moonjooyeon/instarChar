import { withRejectTimeout } from "@/domain/app/asyncUtils";
import { roomKeyFromDmThreadKey } from "@/domain/dm/dmKeyUtils";
import { supabase } from "@/supabaseClient";

export function useAliveStructuredPersistence({ deletedDmKeysRef, session, sharedCharacters }) {
  async function deleteStructuredCharacterAccount(targetId) {
    if (!supabase || !session?.user || !targetId) return;
    const ownerId = session.user.id;
    const jobs = [
      supabase.from("alive_characters").delete().eq("owner_id", ownerId).eq("source_account_id", targetId),
      supabase.from("alive_shared_characters").delete().eq("owner_id", ownerId).eq("source_account_id", targetId),
      supabase.from("alive_character_follows").delete().eq("follower_id", ownerId).eq("follower_account_id", targetId),
      supabase.from("alive_dm_threads").delete().eq("owner_id", ownerId).like("thread_key", `owner::${targetId}::%`),
    ];
    const results = await Promise.allSettled(jobs);
    return structuredDeleteSucceeded(results);
  }
  async function syncStructuredState(snapshot) {
    if (!supabase || !session?.user || !snapshot) return;
    const ownerId = session.user.id;
    const rows = structuredRows(snapshot, ownerId, sharedCharacters, deletedDmKeysRef);
    const jobs = structuredUpsertJobs(rows);
    if (!jobs.length) return;
    const results = await Promise.allSettled(jobs.map((job, index) =>
      withRejectTimeout(job, 7000, `분리 테이블 동기화 ${index + 1}`)
    ));
    warnStructuredSyncFailures(results);
  }
  async function loadStructuredStateFallback(baseState, ownerId) {
    if (!supabase || !ownerId) return baseState;
    try {
      return await loadStructuredState(baseState, ownerId, deletedDmKeysRef);
    } catch (e) {
      console.warn("분리 테이블 로드 실패:", e);
      return baseState;
    }
  }
  return { deleteStructuredCharacterAccount, loadStructuredStateFallback, syncStructuredState };
}

function structuredDeleteSucceeded(results) {
  let ok = true;
  results.forEach((result) => {
    const error = result.status === "rejected" ? result.reason : result.value?.error;
    if (!error) return;
    ok = false;
    console.warn("캐릭터 삭제 구조화 데이터 정리 실패:", error.message || error);
  });
  return ok;
}

function structuredRows(snapshot, ownerId, sharedCharacters, deletedDmKeysRef) {
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

function characterRowsFor(snapshot, ownerId) {
  return (snapshot.accounts || []).map((account) => ({
    owner_id: ownerId,
    source_account_id: account.id,
    name: account.char?.name || "",
    handle: account.char?.handle || "",
    character: compactCharacter(account),
    gallery: compactGallery(account.gallery || []),
    posts: compactPosts(account.posts || []),
    following: compactFollowing(account.following || []),
  })).filter((row) => row.source_account_id && row.name);
}

function personaRowsFor(snapshot, ownerId) {
  return (snapshot.personas || []).map((persona) => ({
    owner_id: ownerId,
    persona_id: String(persona.id),
    name: persona.name || "",
    persona,
  })).filter((row) => row.persona_id && row.name);
}

function splitDmRows(snapshot, ownerId, deletedKeys, sharedCharacters) {
  const ownerDmRows = [];
  const sharedDmRows = [];
  Object.entries(snapshot.dmThreads || {}).forEach(([threadKey, messages]) => {
    if (!threadKey || deletedKeys.has(threadKey)) return;
    pushDmRow({ messages, ownerDmRows, ownerId, sharedCharacters, sharedDmRows, snapshot, threadKey });
  });
  deletedKeys.forEach((threadKey) => {
    if (!threadKey) return;
    pushDeletedDmRow({ ownerDmRows, ownerId, sharedDmRows, threadKey });
  });
  return { ownerDmRows, sharedDmRows };
}

function pushDmRow({ messages, ownerDmRows, ownerId, sharedCharacters, sharedDmRows, snapshot, threadKey }) {
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

function pushDeletedDmRow({ ownerDmRows, ownerId, sharedDmRows, threadKey }) {
  const deletedRow = {
    thread_key: threadKey,
    messages: [],
    world_pref: { deleted: true, deleted_at: new Date().toISOString() },
  };
  if (threadKey.startsWith("dm::")) {
    sharedDmRows.push({ ...deletedRow, participant_user_ids: [ownerId], participant_labels: roomKeyFromDmThreadKey(threadKey).split("|"), created_by: ownerId });
    return;
  }
  ownerDmRows.push({ ...deletedRow, owner_id: ownerId });
}

function participantIdsForThread(threadKey, ownerId, snapshot, sharedCharacters) {
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

function structuredUpsertJobs({ characterRows, ownerDmRows, personaRows, sharedDmRows }) {
  const jobs = [];
  if (characterRows.length) jobs.push(supabase.from("alive_characters").upsert(characterRows, { onConflict: "owner_id,source_account_id" }));
  if (personaRows.length) jobs.push(supabase.from("alive_personas").upsert(personaRows, { onConflict: "owner_id,persona_id" }));
  if (ownerDmRows.length) jobs.push(supabase.from("alive_dm_threads").upsert(ownerDmRows, { onConflict: "owner_id,thread_key" }));
  if (sharedDmRows.length) jobs.push(supabase.from("alive_shared_dm_threads").upsert(sharedDmRows, { onConflict: "thread_key" }));
  return jobs;
}

function warnStructuredSyncFailures(results) {
  const failed = results.find((result) => result.status === "fulfilled" && result.value?.error);
  if (failed?.value?.error) console.warn("분리 테이블 동기화 실패:", failed.value.error.message);
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected) console.warn("분리 테이블 동기화 실패:", rejected.reason?.message || rejected.reason);
}

async function loadStructuredState(baseState, ownerId, deletedDmKeysRef) {
  const [charsResult, charDetailsResult, personasResult, dmResult, sharedDmResult] = await structuredStateQueries(ownerId);
  const next = { ...baseState };
  warnStructuredLoadFailures(charsResult, charDetailsResult);
  applyCharacterRows(next, baseState, charsResult, charDetailsResult);
  applyPersonaRows(next, personasResult);
  applyDmRows(next, dmResult, sharedDmResult, deletedDmKeysRef);
  return next;
}

function structuredStateQueries(ownerId) {
  const timedQuery = (query, label, ms = 4500) => withRejectTimeout(query, ms, label);
  return Promise.allSettled([
    timedQuery(supabase.from("alive_characters").select("source_account_id,name,handle,character,updated_at").eq("owner_id", ownerId).limit(80), "캐릭터 목록 로드"),
    timedQuery(supabase.from("alive_characters").select("source_account_id,gallery,posts,following").eq("owner_id", ownerId).limit(80), "캐릭터 세부 데이터 로드", 3500),
    timedQuery(supabase.from("alive_personas").select("persona_id,name,persona,updated_at").eq("owner_id", ownerId).limit(80), "페르소나 데이터 로드", 3500),
    timedQuery(supabase.from("alive_dm_threads").select("thread_key,messages,world_pref,updated_at").eq("owner_id", ownerId).limit(80), "개인 DM 데이터 로드", 3500),
    timedQuery(supabase.from("alive_shared_dm_threads").select("thread_key,messages,world_pref,updated_at").contains("participant_user_ids", [ownerId]).limit(80), "공유 DM 데이터 로드", 3500),
  ]);
}

function warnStructuredLoadFailures(charsResult, charDetailsResult) {
  if (charsResult.status === "rejected") console.warn("캐릭터 데이터 로드 실패:", charsResult.reason?.message || charsResult.reason);
  else if (charsResult.value.error) console.warn("캐릭터 데이터 로드 실패:", charsResult.value.error.message || charsResult.value.error);
  if (charDetailsResult.status === "rejected") console.warn("캐릭터 세부 데이터 로드 실패:", charDetailsResult.reason?.message || charDetailsResult.reason);
  else if (charDetailsResult.value?.error) console.warn("캐릭터 세부 데이터 로드 실패:", charDetailsResult.value.error.message || charDetailsResult.value.error);
}

function applyCharacterRows(next, baseState, charsResult, charDetailsResult) {
  const cachedAccounts = new Map((baseState.accounts || []).map((account) => [account.id, account]));
  const chars = fulfilledRows(charsResult);
  const detailsById = new Map(fulfilledRows(charDetailsResult).map((row) => [row.source_account_id, row]));
  if (!chars.length) return;
  next.accounts = chars.map((row) => characterAccountFromRow(row, detailsById, cachedAccounts));
  const activeStillExists = next.activeId && next.accounts.some((account) => account.id === next.activeId);
  if (!activeStillExists) next.activeId = next.accounts[0]?.id || null;
}

function characterAccountFromRow(row, detailsById, cachedAccounts) {
  const cached = cachedAccounts.get(row.source_account_id) || {};
  const detail = detailsById.get(row.source_account_id) || {};
  return {
    id: row.source_account_id,
    char: { ...(cached.char || {}), ...(row.character || {}), name: row.character?.name || row.name || cached.char?.name || "", handle: row.character?.handle || row.handle || cached.char?.handle || "" },
    gallery: Array.isArray(detail.gallery) ? detail.gallery : (cached.gallery || []),
    posts: Array.isArray(detail.posts) ? detail.posts : (cached.posts || []),
    following: Array.isArray(detail.following) ? detail.following : (cached.following || []),
  };
}

function applyPersonaRows(next, personasResult) {
  const personaRows = fulfilledRows(personasResult);
  if (personaRows.length) {
    next.personas = personaRows.map((row) => ({ ...(row.persona || {}), id: row.persona?.id || row.persona_id, name: row.persona?.name || row.name || "" }));
  }
}

function applyDmRows(next, dmResult, sharedDmResult, deletedDmKeysRef) {
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

function replaceLoadedDmRows(next, dmRows, sharedDmRows, deletedSet, dmLoaded, sharedLoaded) {
  const shouldReplaceKey = (key) => (sharedLoaded && key.startsWith("dm::")) || (dmLoaded && (key.startsWith("owner::") || key.startsWith("local::")));
  next.dmThreads = Object.fromEntries(Object.entries(next.dmThreads || {}).filter(([key]) => !shouldReplaceKey(key)));
  next.dmWorldPrefs = Object.fromEntries(Object.entries(next.dmWorldPrefs || {}).filter(([key]) => !shouldReplaceKey(key)));
  [...dmRows, ...sharedDmRows].forEach((row) => {
    if (deletedSet.has(row.thread_key) || row.world_pref?.deleted) return;
    next.dmThreads[row.thread_key] = Array.isArray(row.messages) ? row.messages : [];
    if (row.world_pref && Object.keys(row.world_pref).length) next.dmWorldPrefs[row.thread_key] = row.world_pref;
  });
}

function deletedKeySet(next, dmRows, sharedDmRows) {
  const deletedFromRows = [...dmRows, ...sharedDmRows].filter((row) => row.world_pref?.deleted).map((row) => row.thread_key).filter(Boolean);
  return new Set([...(next.deletedDmKeys || []), ...deletedFromRows]);
}

function fulfilledRows(result) {
  return result.status === "fulfilled" && !result.value.error ? (result.value.data || []) : [];
}

function compactGallery(items) {
  return Array.isArray(items) ? items.slice(-12) : [];
}

function compactPosts(items) {
  return Array.isArray(items) ? items.slice(0, 40).map((post) => ({ ...post, comments: Array.isArray(post.comments) ? post.comments.slice(-20) : [] })) : [];
}

function compactFollowing(items) {
  return Array.isArray(items) ? items.slice(0, 120).map((f) => ({
    id: f.id,
    sharedId: f.sharedId,
    ownerId: f.ownerId,
    sourceAccountId: f.sourceAccountId,
    name: f.name,
    handle: f.handle,
    owner: f.owner,
    ownerName: f.ownerName,
    persona: f.persona,
    world: f.world,
    speech: f.speech,
    surface: f.surface,
    inner: f.inner,
    relations: f.relations,
    avatarImg: f.avatarImg,
    headerImg: f.headerImg,
    tags: f.tags || [],
    external: f.external,
    shared: f.shared,
  })) : [];
}

function compactCharacter(account) {
  const { posts: _posts, following: _following, gallery: _gallery, ...baseChar } = account.char || {};
  return baseChar;
}

function compactMessages(messages) {
  return Array.isArray(messages) ? messages.slice(-160) : [];
}
