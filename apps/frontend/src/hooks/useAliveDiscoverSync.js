import { useEffect } from "react";
import { supabase } from "@/supabaseClient";

export function useAliveDiscoverSync({
  activeId,
  activeSharedId,
  canUseApp,
  char,
  following,
  followBackSyncRef,
  loadFollowerCountsFor,
  loadSharedCharacterById,
  loadSharedCharacters,
  recordRelationshipFollowBack,
  session,
  setActiveSharedId,
  setDiscoverQuery,
  setPublicProfile,
  setSharedFocusId,
  setStep,
  step,
  verifyMutualLove,
}) {
  useEffect(() => {
    if (canUseApp && ["discover", "dmlist", "dm"].includes(step)) loadSharedCharacters();
  }, [canUseApp, step, session?.user?.id]);
  useEffect(() => {
    if (!canUseApp || !supabase || !session?.user || !activeId) {
      setActiveSharedId("");
      return;
    }
    let cancelled = false;
    loadActiveShare({ activeId, cancelled: () => cancelled, loadFollowerCountsFor, session, setActiveSharedId });
    return () => { cancelled = true; };
  }, [canUseApp, activeId, session?.user?.id]);
  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("shared");
    if (!canUseApp || !sharedId) return;
    setSharedFocusId(sharedId);
    setDiscoverQuery("");
    setStep("discover");
    loadSharedCharacterById(sharedId).then((found) => {
      if (found) setPublicProfile(found);
      loadSharedCharacters();
    });
    window.history.replaceState({}, "", window.location.pathname);
  }, [canUseApp]);
  useEffect(() => {
    if (!canUseApp || !supabase || !session?.user || !activeSharedId || !following.length) return;
    following.forEach((f) => syncRelationshipFollowBack({ activeSharedId, char, f, followBackSyncRef, recordRelationshipFollowBack, verifyMutualLove }));
  }, [canUseApp, activeSharedId, following, char.relations, session?.user?.id]);
}

async function loadActiveShare({ activeId, cancelled, loadFollowerCountsFor, session, setActiveSharedId }) {
  const { data, error } = await supabase
    .from("alive_shared_characters")
    .select("id")
    .eq("owner_id", session.user.id)
    .eq("source_account_id", activeId)
    .maybeSingle();
  if (cancelled()) return;
  if (error) {
    console.warn("내 공유 캐릭터 확인 실패:", error);
    setActiveSharedId("");
    return;
  }
  setActiveSharedId(data?.id || "");
  if (data?.id) loadFollowerCountsFor([{ id: data.id }]);
}

function syncRelationshipFollowBack({ activeSharedId, char, f, followBackSyncRef, recordRelationshipFollowBack, verifyMutualLove }) {
  if (!f?.sharedId) return;
  const key = `${activeSharedId}:${f.sharedId}:${char.relations || ""}:${f.relations || ""}`;
  if (followBackSyncRef.current.has(key)) return;
  if (!verifyMutualLove(char, f).mutual) return;
  followBackSyncRef.current.add(key);
  recordRelationshipFollowBack(f);
}
