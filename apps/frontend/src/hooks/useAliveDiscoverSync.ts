import { useEffect } from "react";
import { loadActiveSharedCharacterId } from "@/api/discover";
import { hasRemoteApiClient } from "@/api/client";
import { sharedIdFromSearch, type AppStep } from "@/domain/app/aliveCore";

type SessionLike = {
  user?: {
    id?: string;
  };
};

type DiscoverCharacter = {
  relations?: string;
  sharedId?: string;
  [key: string]: unknown;
};

type FollowBackSyncRef = {
  current: Set<string>;
};

type DiscoverSyncOptions = {
  activeId: string | null;
  activeSharedId: string;
  canUseApp: boolean;
  char: DiscoverCharacter;
  following: DiscoverCharacter[];
  followBackSyncRef: FollowBackSyncRef;
  loadFollowerCountsFor: (items: Array<{ id: string }>) => unknown;
  loadSharedCharacterById: (sharedId: string) => Promise<unknown>;
  loadSharedCharacters: () => unknown;
  recordRelationshipFollowBack: (poolChar: DiscoverCharacter) => unknown;
  session: SessionLike | null;
  setActiveSharedId: (value: string) => void;
  setDiscoverQuery: (value: string) => void;
  setPublicProfile: (value: unknown) => void;
  setSharedFocusId: (value: string) => void;
  setStep: (value: AppStep) => void;
  step: AppStep;
  verifyMutualLove: (char: DiscoverCharacter, other: DiscoverCharacter) => { mutual: boolean };
};

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
}: DiscoverSyncOptions): void {
  useEffect(() => {
    if (canUseApp && ["discover", "dmlist", "dm", "feed"].includes(step)) loadSharedCharacters();
  }, [canUseApp, step, session?.user?.id]);
  useEffect(() => {
    if (!canUseApp || !hasRemoteApiClient() || !session?.user || !activeId) {
      setActiveSharedId("");
      return;
    }
    let cancelled = false;
    loadActiveShare({ activeId, cancelled: () => cancelled, loadFollowerCountsFor, session, setActiveSharedId });
    return () => { cancelled = true; };
  }, [canUseApp, activeId, session?.user?.id]);
  useEffect(() => {
    const sharedId = sharedIdFromSearch(window.location.search);
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
    if (!canUseApp || !hasRemoteApiClient() || !session?.user || !activeSharedId || !following.length) return;
    following.forEach((f) => syncRelationshipFollowBack({ activeSharedId, char, f, followBackSyncRef, recordRelationshipFollowBack, verifyMutualLove }));
  }, [canUseApp, activeSharedId, following, char.relations, session?.user?.id]);
}

async function loadActiveShare(options: {
  activeId: string;
  cancelled: () => boolean;
  loadFollowerCountsFor: (items: Array<{ id: string }>) => unknown;
  session: SessionLike;
  setActiveSharedId: (value: string) => void;
}): Promise<void> {
  const { activeId, cancelled, loadFollowerCountsFor, session, setActiveSharedId } = options;
  if (!session.user?.id) return;
  const { data, error } = await loadActiveSharedCharacterId(session.user.id, activeId);
  if (cancelled()) return;
  if (error) {
    console.warn("내 공유 캐릭터 확인 실패:", error);
    setActiveSharedId("");
    return;
  }
  setActiveSharedId(data?.id || "");
  if (data?.id) loadFollowerCountsFor([{ id: data.id }]);
}

function syncRelationshipFollowBack(options: {
  activeSharedId: string;
  char: DiscoverCharacter;
  f: DiscoverCharacter;
  followBackSyncRef: FollowBackSyncRef;
  recordRelationshipFollowBack: (poolChar: DiscoverCharacter) => unknown;
  verifyMutualLove: (char: DiscoverCharacter, other: DiscoverCharacter) => { mutual: boolean };
}): void {
  const { activeSharedId, char, f, followBackSyncRef, recordRelationshipFollowBack, verifyMutualLove } = options;
  if (!f?.sharedId) return;
  const key = `${activeSharedId}:${f.sharedId}:${char.relations || ""}:${f.relations || ""}`;
  if (followBackSyncRef.current.has(key)) return;
  if (!verifyMutualLove(char, f).mutual) return;
  followBackSyncRef.current.add(key);
  recordRelationshipFollowBack(f);
}
