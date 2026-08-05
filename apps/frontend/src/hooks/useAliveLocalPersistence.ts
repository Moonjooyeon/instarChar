import { LOCAL_STATE_KEY } from "@/domain/app/aliveCore";

type LocalSnapshot = {
  accounts?: unknown[];
};

export function useAliveLocalPersistence(): {
  hasUsableSavedState: (state: unknown) => boolean;
  persistLocalSnapshot: (snapshot: LocalSnapshot) => void;
  readLocalSnapshot: () => unknown | null;
} {
  function persistLocalSnapshot(snapshot: LocalSnapshot): void {
    try {
      localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn("로컬 즉시 저장 실패:", e);
    }
  }

  function readLocalSnapshot(): unknown | null {
    try {
      const raw = localStorage.getItem(LOCAL_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("로컬 저장 복원 실패:", e);
      return null;
    }
  }

  function hasUsableSavedState(state: unknown): boolean {
    const snapshot = state && typeof state === "object" ? state as LocalSnapshot : null;
    return Boolean(snapshot && Array.isArray(snapshot.accounts) && snapshot.accounts.length > 0);
  }

  return {
    hasUsableSavedState,
    persistLocalSnapshot,
    readLocalSnapshot,
  };
}
