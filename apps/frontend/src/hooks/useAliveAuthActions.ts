import type { Provider } from "@supabase/supabase-js";
import { LOCAL_STATE_KEY } from "@/domain/app/aliveCore";
import { supabase } from "@/supabaseClient";

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
  authEmail: string;
  authMode: string;
  authPassword: string;
  newPassword: string;
  profileName: string;
  profileTableBrokenRef: MutableRef<boolean>;
  resetRuntimeState: (name?: string) => void;
  session: SessionLike | null;
  setAuthLoading: (value: boolean) => void;
  setAuthMessage: (value: string) => void;
  setNewPassword: (value: string) => void;
  setOnboardingOpen: (value: boolean) => void;
  setPasswordRecoveryOpen: (value: boolean) => void;
  setProfileName: (value: string) => void;
  setProfileLoading: (value: boolean) => void;
  setSaveStatus: (value: string) => void;
  setSession: (value: SessionLike | null) => void;
  setStateReady: (value: boolean) => void;
  setStep: (value: string) => void;
};

type AuthData = {
  session?: unknown;
};

export function useAliveAuthActions({
  authEmail,
  authMode,
  authPassword,
  newPassword,
  profileName,
  profileTableBrokenRef,
  resetRuntimeState,
  session,
  setAuthLoading,
  setAuthMessage,
  setNewPassword,
  setOnboardingOpen,
  setPasswordRecoveryOpen,
  setProfileName,
  setProfileLoading,
  setSaveStatus,
  setSession,
  setStateReady,
  setStep,
}: AuthActionsOptions): Record<string, unknown> {
  function clearLocalAuthStorage(): void {
    try {
      clearStorage(localStorage, true);
      clearStorage(sessionStorage, false);
    } catch (e) {
      console.warn("로그인 저장값 초기화 실패:", e);
    }
  }
  function authRedirectUrl(): string {
    return `${window.location.origin}/app`;
  }
  function readableAuthError(error: unknown): string {
    const message = errorMessage(error);
    if (/invalid_client|client secret/i.test(message)) return "소셜 로그인 Provider 설정 오류: Supabase Authentication > Providers의 Client Secret이 Google/Kakao 개발자 콘솔 값과 달라. Secret을 다시 복사해서 저장한 뒤 새 로그인으로 시도해줘.";
    if (/Unable to exchange external code/i.test(message)) return "소셜 로그인 코드를 세션으로 바꾸지 못했어. 이미 소비된 일회용 코드일 수 있으니 로그인 상태 초기화 후 새로 로그인해줘.";
    return message || "로그인 상태 확인에 실패했어.";
  }
  async function submitAuth(): Promise<void> {
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password || !supabase) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { data, error } = authMode === "signup"
      ? await signUpWithEmail(email, password, authRedirectUrl())
      : await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) {
      setAuthMessage(error.message);
      return;
    }
    setAuthMessage(signInMessage(authMode, data));
  }
  async function sendMagicLoginLink(): Promise<void> {
    const email = authEmail.trim();
    if (!email || !supabase) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: magicLinkOptions(email, authRedirectUrl()) });
    setAuthLoading(false);
    setAuthMessage(error ? error.message : "이메일로 간편 로그인 링크를 보냈어. 메일에서 링크를 누르면 바로 들어올 수 있어.");
  }
  async function sendPasswordReset(): Promise<void> {
    const email = authEmail.trim();
    if (!email || !supabase) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
    setAuthLoading(false);
    setAuthMessage(error ? error.message : "비밀번호 재설정 링크를 보냈어. 메일에서 링크를 누르고 새 비밀번호를 정하면 돼.");
  }
  async function signInWithProvider(provider: Provider): Promise<void> {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: authRedirectUrl() } });
    if (error) {
      setAuthLoading(false);
      setAuthMessage(readableAuthError(error));
    }
  }
  async function updateRecoveredPassword(): Promise<void> {
    if (!supabase || newPassword.length < 6) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAuthLoading(false);
    if (error) {
      setAuthMessage(error.message);
      return;
    }
    setNewPassword("");
    setPasswordRecoveryOpen(false);
    setAuthMessage("비밀번호를 바꿨어. 이제 그대로 이용하면 돼.");
  }
  async function signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearLocalAuthStorage();
    profileTableBrokenRef.current = false;
    setSession(null);
    setStateReady(false);
    resetRuntimeState("");
    setStep("home");
    setSaveStatus("로그인 대기");
  }
  async function completeOnboarding(): Promise<void> {
    if (!session?.user || !supabase) {
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
    if (supabase) await supabase.auth.signOut();
    clearLocalAuthStorage();
    profileTableBrokenRef.current = false;
    setSession(null);
    resetRuntimeState("");
    setAuthLoading(false);
    setProfileLoading(false);
    setStateReady(false);
    setAuthMessage("로그인 상태를 초기화했어. 다시 로그인해줘.");
  }
  return { authRedirectUrl, clearLocalAuthStorage, completeOnboarding, readableAuthError, recoverAuthScreen, sendMagicLoginLink, sendPasswordReset, signInWithProvider, signOut, submitAuth, updateRecoveredPassword };
}

function clearStorage(storage: Storage, includeLocalState: boolean): void {
  Object.keys(storage).forEach((key) => {
    if (key.startsWith("sb-") || key.includes("supabase") || (includeLocalState && key === LOCAL_STATE_KEY)) storage.removeItem(key);
  });
}

function signUpWithEmail(email: string, password: string, redirectUrl: string): Promise<{ data: AuthData; error: { message: string } | null }> {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: { display_name: email.split("@")[0] },
    },
  });
}

function magicLinkOptions(email: string, redirectUrl: string): { data: { display_name: string }; emailRedirectTo: string; shouldCreateUser: boolean } {
  return {
    emailRedirectTo: redirectUrl,
    shouldCreateUser: true,
    data: { display_name: email.split("@")[0] },
  };
}

function signInMessage(authMode: string, data: AuthData): string {
  if (authMode === "signup" && !data.session) return "가입 확인 메일을 보냈어. Supabase 설정에서 이메일 확인이 켜져 있으면 메일 확인 후 로그인돼.";
  return authMode === "signup" ? "가입 완료. 온보딩으로 넘어갈게." : "로그인 완료.";
}

async function upsertOnboardingProfile(session: SessionLike, name: string): Promise<{ error: { message: string } | null }> {
  const result = await Promise.resolve(supabase.from("alive_profiles").upsert({
    id: session.user.id,
    email: session.user.email,
    display_name: name,
    onboarded: true,
  }));
  return resultWithError(result);
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

function resultWithError(value: unknown): { error: { message: string } | null } {
  if (!value || typeof value !== "object") return { error: null };
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return { error: null };
  return { error: { message: errorMessage(error) } };
}
