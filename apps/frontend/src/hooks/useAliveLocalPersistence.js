import { LOCAL_STATE_KEY } from "@/domain/app/aliveCore";

export function useAliveLocalPersistence() {
  function persistLocalSnapshot(snapshot) {
    try {
      const oldRaw = localStorage.getItem(LOCAL_STATE_KEY);
      if ((!snapshot.accounts || snapshot.accounts.length === 0) && oldRaw) {
        const oldState = JSON.parse(oldRaw);
        if (Array.isArray(oldState.accounts) && oldState.accounts.length > 0) return;
      }
      localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn("로컬 즉시 저장 실패:", e);
    }
  }

  function readLocalSnapshot() {
    try {
      const raw = localStorage.getItem(LOCAL_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("로컬 저장 복원 실패:", e);
      return null;
    }
  }

  function hasUsableSavedState(state) {
    return Boolean(state && Array.isArray(state.accounts) && state.accounts.length > 0);
  }

  return {
    hasUsableSavedState,
    persistLocalSnapshot,
    readLocalSnapshot,
  };
}
