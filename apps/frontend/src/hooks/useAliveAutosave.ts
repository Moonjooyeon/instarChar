import { useEffect } from "react";
import { hasSupabaseConfig, supabase } from "@/supabaseClient";

type MutableRef<T> = {
  current: T;
};

type SessionLike = {
  user?: {
    id?: string;
  };
};

type AutosaveOptions = {
  accounts: unknown;
  activeId: unknown;
  affinity: unknown;
  char: unknown;
  deletedDmKeys: unknown;
  discoverQuery: unknown;
  dmThreadTitles: unknown;
  dmThreads: unknown;
  dmWorldPrefs: unknown;
  exportAppState: () => unknown;
  following: unknown;
  gallery: unknown;
  onboardingOpen: unknown;
  ownerPersona: unknown;
  personas: unknown;
  persistLocalSnapshot: (snapshot: unknown) => void;
  posts: unknown;
  profileLoadedRef: MutableRef<boolean>;
  profileName: unknown;
  profileTableBrokenRef: MutableRef<boolean>;
  profileUpsertPayload: (snapshot: unknown) => unknown;
  saveTimerRef: MutableRef<ReturnType<typeof setTimeout> | null>;
  session: SessionLike | null;
  setSaveStatus: (value: string) => void;
  stateReady: boolean;
  syncStructuredState: (snapshot: unknown) => Promise<unknown>;
};

export function useAliveAutosave({
  accounts,
  activeId,
  affinity,
  char,
  deletedDmKeys,
  discoverQuery,
  dmThreadTitles,
  dmThreads,
  dmWorldPrefs,
  exportAppState,
  following,
  gallery,
  onboardingOpen,
  ownerPersona,
  personas,
  persistLocalSnapshot,
  posts,
  profileLoadedRef,
  profileName,
  profileTableBrokenRef,
  profileUpsertPayload,
  saveTimerRef,
  session,
  setSaveStatus,
  stateReady,
  syncStructuredState,
}: AutosaveOptions): void {
  useEffect(() => {
    if (!profileLoadedRef.current || !stateReady) return;
    const snapshot = exportAppState();
    if (!hasSupabaseConfig || !supabase || !session?.user) {
      saveLocalSnapshot(snapshot, persistLocalSnapshot, setSaveStatus);
      return;
    }
    setSaveStatus("저장 중");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveRemoteSnapshot({ profileTableBrokenRef, profileUpsertPayload, setSaveStatus, snapshot, syncStructuredState });
    }, 700);
    return () => clearTimeout(saveTimerRef.current);
  }, [accounts, activeId, char, gallery, posts, personas, dmThreads, dmThreadTitles, dmWorldPrefs, deletedDmKeys, ownerPersona, following, affinity, profileName, onboardingOpen, stateReady, session?.user?.id]);
  useEffect(() => {
    if (!stateReady) return;
    function saveBeforeLeave() {
      const snapshot = exportAppState();
      if (!hasSupabaseConfig) persistLocalSnapshot(snapshot);
    }
    window.addEventListener("pagehide", saveBeforeLeave);
    window.addEventListener("beforeunload", saveBeforeLeave);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeave);
      window.removeEventListener("beforeunload", saveBeforeLeave);
    };
  }, [accounts, activeId, char, gallery, posts, personas, dmThreads, dmThreadTitles, dmWorldPrefs, deletedDmKeys, ownerPersona, following, affinity, discoverQuery, profileName, onboardingOpen, stateReady]);
}

function saveLocalSnapshot(snapshot: unknown, persistLocalSnapshot: (snapshot: unknown) => void, setSaveStatus: (value: string) => void): void {
  try {
    persistLocalSnapshot(snapshot);
    setSaveStatus("로컬 저장");
  } catch (e) {
    setSaveStatus("로컬 저장 실패");
  }
}

async function saveRemoteSnapshot(options: {
  profileTableBrokenRef: MutableRef<boolean>;
  profileUpsertPayload: (snapshot: unknown) => unknown;
  setSaveStatus: (value: string) => void;
  snapshot: unknown;
  syncStructuredState: (snapshot: unknown) => Promise<unknown>;
}): Promise<void> {
  const { profileTableBrokenRef, profileUpsertPayload, setSaveStatus, snapshot, syncStructuredState } = options;
  if (profileTableBrokenRef.current) {
    await syncStructuredState(snapshot);
    setSaveStatus("저장됨");
    return;
  }
  if (!supabase) return;
  const { error } = await supabase.from("alive_profiles").upsert(profileUpsertPayload(snapshot));
  if (error) {
    console.warn("프로필 메타 저장 실패:", error.message);
    await syncStructuredState(snapshot);
    setSaveStatus("저장됨");
    return;
  }
  syncStructuredState(snapshot).catch((e) => console.warn("분리 테이블 동기화 실패:", e));
  setSaveStatus("저장됨");
}
