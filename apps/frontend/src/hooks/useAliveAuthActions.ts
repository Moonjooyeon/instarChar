import {
  deleteAuthAccount,
  type AuthProvider,
  isAuthApiAvailable,
  signInWithOAuthProvider,
  signOutAuthSession,
} from "@/api/auth";
import { upsertProfile } from "@/api/profiles";
import { LOCAL_STATE_KEY } from "@/domain/app/aliveCore";

type MutableRef<T> = {
  current: T;
};

type SessionLike = {
  user?: {
    email?: string;
    id: string;
  };
};

type AuthActionsOptions = {
  profileName: string;
  profileTableBrokenRef: MutableRef<boolean>;
  resetRuntimeState: (name?: string) => void;
  session: SessionLike | null;
  setAuthLoading: (value: boolean) => void;
  setAuthMessage: (value: string) => void;
  setOnboardingOpen: (value: boolean) => void;
  setProfileName: (value: string) => void;
  setProfileLoading: (value: boolean) => void;
  setSaveStatus: (value: string) => void;
  setSession: (value: SessionLike | null) => void;
  setStateReady: (value: boolean) => void;
  setStep: (value: string) => void;
};

export function useAliveAuthActions({
  profileName,
  profileTableBrokenRef,
  resetRuntimeState,
  session,
  setAuthLoading,
  setAuthMessage,
  setOnboardingOpen,
  setProfileName,
  setProfileLoading,
  setSaveStatus,
  setSession,
  setStateReady,
  setStep,
}: AuthActionsOptions) {
  function clearLocalAuthStorage(): void {
    try {
      clearStorage(localStorage, true);
      clearStorage(sessionStorage, false);
    } catch (e) {
      console.warn("로그인 저장값 초기화 실패:", e);
    }
  }
  function readableAuthError(error: unknown): string {
    const message = errorMessage(error);
    if (/invalid_client|client secret/i.test(message)) return "소셜 로그인 Provider 설정 오류야. 백엔드 OAuth 설정을 확인한 뒤 새 로그인으로 시도해줘.";
    return message || "로그인 상태 확인에 실패했어.";
  }
  async function signInWithProvider(provider: AuthProvider): Promise<void> {
    if (!isAuthApiAvailable()) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await signInWithOAuthProvider(provider);
    if (error) {
      setAuthLoading(false);
      setAuthMessage(readableAuthError(error));
    }
  }
  async function signOut(): Promise<void> {
    if (!isAuthApiAvailable()) return;
    await signOutAuthSession();
    clearLocalAuthStorage();
    profileTableBrokenRef.current = false;
    setSession(null);
    setStateReady(false);
    resetRuntimeState("");
    setStep("home");
    setSaveStatus("로그인 대기");
  }
  async function deleteAccount(): Promise<void> {
    const confirmed = window.confirm("계정과 캐릭터, 게시물, DM 등 모든 데이터를 영구 삭제할까요? 이 작업은 되돌릴 수 없어요.");
    if (!confirmed) return;
    const { error } = await deleteAuthAccount();
    if (error) {
      setSaveStatus(`계정 삭제 실패: ${error.message}`);
      return;
    }
    await signOut();
  }
  async function completeOnboarding(): Promise<void> {
    if (!session?.user || !isAuthApiAvailable()) {
      setOnboardingOpen(false);
      return;
    }
    const name = profileName.trim() || session.user.email?.split("@")[0] || "사용자";
    setProfileName(name);
    const { error } = await upsertOnboardingProfile(session, name);
    if (error) {
      setSaveStatus(`온보딩 저장 실패: ${error.message}`);
      return;
    }
    setOnboardingOpen(false);
    setSaveStatus("저장됨");
  }
  async function recoverAuthScreen(): Promise<void> {
    if (isAuthApiAvailable()) await signOutAuthSession();
    clearLocalAuthStorage();
    profileTableBrokenRef.current = false;
    setSession(null);
    resetRuntimeState("");
    setAuthLoading(false);
    setProfileLoading(false);
    setStateReady(false);
    setAuthMessage("로그인 상태를 초기화했어. 다시 로그인해줘.");
  }
  return { clearLocalAuthStorage, completeOnboarding, deleteAccount, readableAuthError, recoverAuthScreen, signInWithProvider, signOut };
}

function clearStorage(storage: Storage, includeLocalState: boolean): void {
  Object.keys(storage).forEach((key) => {
    if (key.startsWith("sb-") || (includeLocalState && key === LOCAL_STATE_KEY)) storage.removeItem(key);
  });
}

async function upsertOnboardingProfile(session: SessionLike, name: string): Promise<{ error: { message: string } | null }> {
  const result = await upsertProfile({
    id: session.user.id,
    email: session.user.email,
    display_name: name,
    onboarded: true,
  });
  return { error: result.error ? { message: result.error.message || "" } : null };
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}
