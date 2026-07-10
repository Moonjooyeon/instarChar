import { useEffect, useRef, useState } from "react";
import { mergeDiscoverCharacters, sharedRowToChar } from "@/domain/discover/discoverUtils";
import { hasSupabaseConfig, supabase } from "@/supabaseClient";

export function useAliveDiscover({ activeId, char, profileName, session } = {}) {
  const [publicProfile, setPublicProfile] = useState(null);
  const [worldModal, setWorldModal] = useState(null);
  const [followPanel, setFollowPanel] = useState(null);
  const [following, setFollowing] = useState([]);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [sharedCharacters, setSharedCharacters] = useState([]);
  const [sharedLoadState, setSharedLoadState] = useState({ loading: false, error: "" });
  const [discoverShowFollowed, setDiscoverShowFollowed] = useState(false);
  const [sharedFocusId, setSharedFocusId] = useState("");
  const [followerCounts, setFollowerCounts] = useState({});
  const [sharedFollowers, setSharedFollowers] = useState({ loading: false, rows: [], error: "" });
  const [activeSharedId, setActiveSharedId] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const shareStatusTimerRef = useRef(null);
  const isFollowing = (id) => following.some((item) => item.id === id);
  const baseFollowerCount = (name = "") => deterministicFollowerCount(name);
  const publicFollowingCount = (char) => Array.isArray(char?.following) ? char.following.length : 0;
  const publicFollowerCount = (char) => {
    if (char?.sharedId) return followerCounts[char.sharedId] ?? 0;
    return hasSupabaseConfig ? 0 : baseFollowerCount(char?.name || "");
  };
  async function loadFollowerCountsFor(rows) {
    if (!supabase || !rows?.length) return;
    const ids = rows.map((row) => row.id).filter(Boolean);
    if (!ids.length) return;
    const { data, error } = await supabase.from("alive_character_follows").select("target_shared_character_id").in("target_shared_character_id", ids);
    if (error) {
      console.warn("팔로워 수 불러오기 실패:", error);
      return;
    }
    setFollowerCounts((prev) => ({ ...prev, ...followerCountsForRows(ids, data || []) }));
  }
  async function loadSharedFollowers(sharedId = activeSharedId) {
    if (!supabase || !sharedId) {
      setSharedFollowers({ loading: false, rows: [], error: "" });
      return;
    }
    setSharedFollowers({ loading: true, rows: [], error: "" });
    const { data, error } = await supabase.from("alive_character_follows").select("id,follower_id,follower_name,follower_account_id,follower_character,created_at").eq("target_shared_character_id", sharedId).order("created_at", { ascending: false });
    if (error) {
      console.warn("팔로워 목록 불러오기 실패:", error);
      setSharedFollowers({ loading: false, rows: [], error: error.message || "팔로워를 불러오지 못했어." });
      return;
    }
    const rows = (data || []).map((row) => followerRowToChar(row, sharedCharacters));
    setSharedFollowers({ loading: false, rows, error: "" });
    loadFollowerCountsFor(rows.filter((row) => row.sharedId).map((row) => ({ id: row.sharedId })));
  }
  async function loadSharedCharacters() {
    if (!supabase) return;
    setSharedLoadState({ loading: true, error: "" });
    const [characterResult, sharedResult] = await sharedCharacterResults();
    const { characterError, sharedError, characterRows, sharedRows } = sharedResultRows(characterResult, sharedResult);
    if (characterError) console.warn("alive_characters 탐색 불러오기 실패:", characterError);
    if (sharedError) console.warn("공유 정보 불러오기 실패:", sharedError);
    const merged = mergeDiscoverCharacters(sharedRows, characterRows);
    setSharedCharacters(merged);
    setSharedLoadState({ loading: false, error: characterError && !merged.length ? (characterError.message || "alive_characters를 불러오지 못했어.") : "" });
    loadFollowerCountsFor(sharedRows);
  }
  async function loadSharedCharacterById(sharedId) {
    if (!supabase || !sharedId) return null;
    setSharedLoadState({ loading: true, error: "" });
    const { data, error } = await supabase.from("alive_shared_characters").select("id,owner_id,owner_name,source_account_id,name,handle,persona,tags,character,created_at").eq("id", sharedId).maybeSingle();
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
  async function shareCurrentCharacter(publicPostSnapshot) {
    if (!activeId || !char?.name?.trim()) return;
    if (!supabase || !session?.user) {
      flashShareStatus("로그인 후 공유할 수 있어.");
      return;
    }
    const { data, error } = await supabase.from("alive_shared_characters").upsert(sharedCharacterPayload({ activeId, char, following, profileName, publicPostSnapshot, session }), { onConflict: "owner_id,source_account_id" }).select("id").single();
    if (error) {
      flashShareStatus(`공유 실패: ${error.message}`, 3600);
      return;
    }
    setActiveSharedId(data.id);
    await writeShareUrl(data.id, flashShareStatus);
    loadSharedCharacters();
  }
  async function syncActiveSharedCharacter(publicPostSnapshot, nextFollowing = following, nextChar = char) {
    if (!supabase || !session?.user || !activeId || !activeSharedId || !nextChar?.name?.trim()) return;
    const { error } = await supabase.from("alive_shared_characters").update(sharedCharacterUpdatePayload(nextChar, nextFollowing, publicPostSnapshot)).eq("owner_id", session.user.id).eq("source_account_id", activeId);
    if (error) console.warn("공유 캐릭터 스냅샷 갱신 실패:", error);
  }
  async function syncOwnFollowRows(publicPostSnapshot, nextFollowing = following, nextChar = char) {
    if (!supabase || !session?.user || !activeId || !nextChar?.name?.trim()) return;
    const rows = ownFollowRows({ activeId, nextChar, nextFollowing, profileName, publicPostSnapshot, session });
    if (!rows.length) return;
    const { error } = await supabase.from("alive_character_follows").upsert(rows, { onConflict: "follower_id,follower_account_id,target_shared_character_id" });
    if (error) console.warn("팔로우 캐릭터 스냅샷 갱신 실패:", error);
  }
  async function recordFollowChange(poolChar, wasFollowing) {
    if (!supabase || !session?.user || !activeId || !poolChar?.sharedId) return;
    const ok = wasFollowing ? await deleteFollowRow(session.user.id, activeId, poolChar.sharedId) : await upsertFollowRow({ activeId, char, poolChar, profileName, session });
    if (ok) updateFollowerCount(poolChar.sharedId, wasFollowing);
    loadFollowerCountsFor([{ id: poolChar.sharedId }]);
    return ok;
  }
  async function recordRelationshipFollowBack(poolChar) {
    if (!supabase || !session?.user || !activeSharedId || !poolChar?.sharedId) return false;
    const { error } = await supabase.rpc("alive_relationship_follow_back", { p_follower_shared_character_id: poolChar.sharedId, p_target_shared_character_id: activeSharedId });
    if (error) {
      console.warn("연인 맞팔 저장 실패:", error);
      return false;
    }
    loadFollowerCountsFor([{ id: activeSharedId }, { id: poolChar.sharedId }]);
    return true;
  }
  function flashShareStatus(message, ms = 2200) {
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
  function updateFollowerCount(sharedId, wasFollowing) {
    setFollowerCounts((prev) => ({ ...prev, [sharedId]: Math.max(0, (prev[sharedId] || 0) + (wasFollowing ? -1 : 1)) }));
  }
  return { activeSharedId, baseFollowerCount, discoverQuery, discoverShowFollowed, flashShareStatus, followerCounts, followPanel, following, isFollowing, loadFollowerCountsFor, loadSharedCharacterById, loadSharedCharacters, loadSharedFollowers, publicFollowerCount, publicFollowingCount, publicProfile, recordFollowChange, recordRelationshipFollowBack, setActiveSharedId, setDiscoverQuery, setDiscoverShowFollowed, setFollowerCounts, setFollowPanel, setFollowing, setPublicProfile, setSharedCharacters, setSharedFocusId, setSharedFollowers, setSharedLoadState, setShareStatus, setWorldModal, shareCurrentCharacter, sharedCharacters, sharedFocusId, sharedFollowers, sharedLoadState, shareStatus, shareStatusTimerRef, syncActiveSharedCharacter, syncOwnFollowRows, worldModal };
}

function deterministicFollowerCount(name) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) % 9000;
  return 800 + hash;
}

function followerCountsForRows(ids, rows) {
  const counts = Object.fromEntries(ids.map((id) => [id, 0]));
  rows.forEach((row) => {
    counts[row.target_shared_character_id] = (counts[row.target_shared_character_id] || 0) + 1;
  });
  return counts;
}

function followerRowToChar(row, sharedCharacters) {
  const character = row.follower_character || {};
  const shared = sharedCharacters.find((item) => item.ownerId === row.follower_id && item.sourceAccountId === row.follower_account_id);
  return { ...(shared || {}), ...character, id: shared?.id || `follower_${row.id}`, shared: Boolean(shared), sharedId: shared?.sharedId || "", ownerId: row.follower_id, sourceAccountId: row.follower_account_id, name: character.name || row.follower_name || "이름 없음", handle: character.handle || "", owner: shared?.owner || `@${row.follower_name || "user"}`, ownerName: shared?.ownerName || row.follower_name || "user", followerAccountId: row.follower_account_id, followedAt: row.created_at };
}

function sharedCharacterResults() {
  return Promise.allSettled([
    supabase.from("alive_characters").select("owner_id,source_account_id,name,handle,character,gallery,posts,following,updated_at").order("updated_at", { ascending: false }).limit(120),
    supabase.from("alive_shared_characters").select("id,owner_id,owner_name,source_account_id,name,handle,persona,tags,character,created_at").order("created_at", { ascending: false }).limit(80),
  ]);
}

function sharedResultRows(characterResult, sharedResult) {
  const characterError = characterResult.status === "fulfilled" ? characterResult.value.error : characterResult.reason;
  const sharedError = sharedResult.status === "fulfilled" ? sharedResult.value.error : sharedResult.reason;
  const characterRows = characterResult.status === "fulfilled" && !characterResult.value.error ? (characterResult.value.data || []) : [];
  const sharedRows = sharedResult.status === "fulfilled" && !sharedResult.value.error ? (sharedResult.value.data || []) : [];
  return { characterError, sharedError, characterRows, sharedRows };
}

function sharedCharacterPayload({ activeId, char, following, profileName, publicPostSnapshot, session }) {
  return { owner_id: session.user.id, owner_name: profileName || session.user.email?.split("@")[0] || "user", source_account_id: activeId, name: char.name, handle: char.handle || "", persona: char.persona || "", tags: [char.age, char.surface, char.interests].filter(Boolean).slice(0, 6), character: { ...char, following, posts: publicPostSnapshot() } };
}

function sharedCharacterUpdatePayload(char, following, publicPostSnapshot) {
  return { name: char.name, handle: char.handle || "", persona: char.persona || "", tags: [char.age, char.surface, char.interests].filter(Boolean).slice(0, 6), character: { ...char, following, posts: publicPostSnapshot() } };
}

async function writeShareUrl(sharedId, flashShareStatus) {
  const url = `${window.location.origin}/?shared=${sharedId}`;
  try {
    await navigator.clipboard.writeText(url);
    flashShareStatus("공유 링크를 복사했어.");
  } catch (error) {
    flashShareStatus(url, 4200);
  }
}

function ownFollowRows({ activeId, nextChar, nextFollowing, profileName, publicPostSnapshot, session }) {
  return (nextFollowing || []).filter((item) => item?.sharedId).map((item) => ({ follower_id: session.user.id, follower_name: profileName || session.user.email?.split("@")[0] || "user", follower_account_id: activeId, follower_character: { ...nextChar, following: nextFollowing, posts: publicPostSnapshot() }, target_shared_character_id: item.sharedId }));
}

async function deleteFollowRow(userId, activeId, sharedId) {
  const { error } = await supabase.from("alive_character_follows").delete().eq("follower_id", userId).eq("follower_account_id", activeId).eq("target_shared_character_id", sharedId);
  if (error) console.warn("언팔로우 저장 실패:", error);
  return !error;
}

async function upsertFollowRow({ activeId, char, poolChar, profileName, session }) {
  const payload = { follower_id: session.user.id, follower_name: profileName || session.user.email?.split("@")[0] || "user", follower_account_id: activeId, follower_character: { ...char }, target_shared_character_id: poolChar.sharedId };
  const { error } = await supabase.from("alive_character_follows").upsert(payload, { onConflict: "follower_id,follower_account_id,target_shared_character_id" });
  if (error) console.warn("팔로우 저장 실패:", error);
  return !error;
}
