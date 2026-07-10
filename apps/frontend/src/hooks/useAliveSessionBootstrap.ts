import { useEffect } from "react";
import {
  exchangeOAuthCodeForSession,
  getAuthSession,
  isAuthApiAvailable,
  setHashAuthSession,
  signOutAuthSession,
  subscribeAuthState,
} from "@/api/auth";
import { hasRemoteApiConfig as hasSupabaseConfig } from "@/api/client";

type MutableRef<T> = {
  current: T;
};

type SessionLike = {
  user?: {
    id?: string;
  };
};

type AuthCallbackState = {
  hashAccessToken: string | null;
  hashRefreshToken: string | null;
  hasOAuthCallback: boolean;
  oauthCode: string | null;
  oauthError: string | null;
  wantsAuthReset: boolean;
};

type SessionBootstrapOptions = {
  applyAppState: (snapshot: unknown) => void;
  authBusy: boolean;
  authResolvedRef: MutableRef<boolean>;
  clearLocalAuthStorage: () => void;
  profileLoadedRef: MutableRef<boolean>;
  readLocalSnapshot: () => unknown;
  readableAuthError: (error: unknown) => string;
  resetRuntimeState: (name?: string) => void;
  setAuthLoading: (value: boolean) => void;
  setAuthMessage: (value: string | ((current: string) => string)) => void;
  setPasswordRecoveryOpen: (value: boolean) => void;
  setProfileLoading: (value: boolean) => void;
  setSaveStatus: (value: string) => void;
  setSession: (value: SessionLike | null | ((prev: SessionLike | null) => SessionLike | null)) => void;
  setStateReady: (value: boolean) => void;
};

type RuntimeOptions = Omit<SessionBootstrapOptions, "applyAppState" | "authBusy" | "readLocalSnapshot" | "setSaveStatus">;

export function useAliveSessionBootstrap({
  applyAppState,
  authBusy,
  authResolvedRef,
  clearLocalAuthStorage,
  profileLoadedRef,
  readLocalSnapshot,
  readableAuthError,
  resetRuntimeState,
  setAuthLoading,
  setAuthMessage,
  setPasswordRecoveryOpen,
  setProfileLoading,
  setSaveStatus,
  setSession,
  setStateReady,
}: SessionBootstrapOptions): void {
  useEffect(() => {
    if (!hasSupabaseConfig || !isAuthApiAvailable()) {
      const snapshot = readLocalSnapshot();
      if (snapshot) applyAppState(snapshot);
      profileLoadedRef.current = true;
      setStateReady(true);
      setProfileLoading(false);
      setSaveStatus("로컬 저장");
      return;
    }
    return startSessionBootstrap({
      authResolvedRef,
      clearLocalAuthStorage,
      profileLoadedRef,
      readableAuthError,
      resetRuntimeState,
      setAuthLoading,
      setAuthMessage,
      setPasswordRecoveryOpen,
      setProfileLoading,
      setSession,
      setStateReady,
    });
  }, []);
  useEffect(() => {
    if (!hasSupabaseConfig || !isAuthApiAvailable() || !authBusy) return;
    const timer = setTimeout(() => {
      refreshSlowSession({ profileLoadedRef, setAuthLoading, setAuthMessage, setProfileLoading, setSaveStatus, setSession, setStateReady });
    }, 8000);
    return () => clearTimeout(timer);
  }, [authBusy]);
}

function startSessionBootstrap(options: RuntimeOptions): (() => void) | undefined {
  let alive = true;
  const callback = authCallbackState();
  if (callback.wantsAuthReset) {
    resetAuthState(options);
    return undefined;
  }
  if (callback.oauthError) {
    options.setAuthMessage(`소셜 로그인 실패: ${decodeURIComponent(callback.oauthError)}`);
    window.history.replaceState({}, "", window.location.pathname);
  }
  if (callback.hasOAuthCallback) options.setAuthLoading(true);
  options.authResolvedRef.current = false;
  resolveInitialSession(callback).then((resolvedSession) => {
    if (!alive) return;
    if (resolvedSession || !callback.hasOAuthCallback) options.authResolvedRef.current = true;
    options.setSession(resolvedSession);
    if (!callback.hasOAuthCallback || resolvedSession) options.setAuthLoading(false);
  }).catch((error) => {
    if (!alive) return;
    options.authResolvedRef.current = true;
    options.setAuthMessage(options.readableAuthError(error));
    options.setAuthLoading(false);
    options.setProfileLoading(false);
  });
  const initFallback = sessionFallbackTimer(aliveRef(() => alive), options, callback);
  const subscription = subscribeAuthStateChange(options, callback);
  return () => {
    alive = false;
    clearTimeout(initFallback.initFallback);
    if (initFallback.oauthFallback) clearTimeout(initFallback.oauthFallback);
    subscription.unsubscribe();
  };
}

function authCallbackState(): AuthCallbackState {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const oauthCode = url.searchParams.get("code");
  const hashAccessToken = hashParams.get("access_token");
  const hashRefreshToken = hashParams.get("refresh_token");
  const hasOAuthHash = Boolean(hashAccessToken || hashParams.get("error"));
  return {
    hashAccessToken,
    hashRefreshToken,
    hasOAuthCallback: Boolean(oauthCode || hasOAuthHash),
    oauthCode,
    oauthError: url.searchParams.get("error_description") || url.searchParams.get("error") || hashParams.get("error_description") || hashParams.get("error"),
    wantsAuthReset: url.searchParams.get("resetAuth") === "1" || url.searchParams.get("clearAuth") === "1",
  };
}

function resetAuthState({ authResolvedRef, clearLocalAuthStorage, resetRuntimeState, setAuthLoading, setAuthMessage, setProfileLoading, setSession, setStateReady }: RuntimeOptions): void {
  clearLocalAuthStorage();
  signOutAuthSession().catch(() => {});
  window.history.replaceState({}, "", window.location.pathname);
  authResolvedRef.current = true;
  setSession(null);
  resetRuntimeState("");
  setAuthLoading(false);
  setProfileLoading(false);
  setStateReady(false);
  setAuthMessage("꼬인 로그인 저장값을 지웠어. 다시 로그인해줘.");
}

async function resolveInitialSession({ hashAccessToken, hashRefreshToken, oauthCode }: AuthCallbackState): Promise<SessionLike | null> {
  const existing = await getAuthSession();
  if (existing.data.session) {
    window.history.replaceState({}, "", "/app");
    return existing.data.session;
  }
  if (hashAccessToken && hashRefreshToken) {
    await setHashSession(hashAccessToken, hashRefreshToken);
  } else if (oauthCode) {
    await exchangeOAuthCode(oauthCode);
  }
  const { data } = await getAuthSession();
  return data.session || null;
}

async function setHashSession(hashAccessToken: string, hashRefreshToken: string): Promise<void> {
  await setHashAuthSession(hashAccessToken, hashRefreshToken);
  window.history.replaceState({}, "", "/app");
}

async function exchangeOAuthCode(oauthCode: string): Promise<void> {
  await exchangeOAuthCodeForSession(oauthCode);
  window.history.replaceState({}, "", "/app");
}

function sessionFallbackTimer(isAlive: () => boolean, options: RuntimeOptions, callback: AuthCallbackState): {
  initFallback: ReturnType<typeof setTimeout>;
  oauthFallback: ReturnType<typeof setTimeout> | null;
} {
  const initFallback = setTimeout(() => {
    if (!isAlive()) return;
    if (!options.authResolvedRef.current) {
      options.setAuthMessage("저장된 로그인 상태 확인이 오래 걸리고 있어. 세션을 확인하는 중이야.");
      return;
    }
    options.setAuthLoading(false);
    options.setProfileLoading(false);
  }, 7000);
  const oauthFallback = callback.hasOAuthCallback ? setTimeout(() => {
    if (!isAlive()) return;
    if (!options.authResolvedRef.current) {
      options.setAuthMessage("소셜 로그인 세션을 아직 확인하는 중이야. 조금만 더 기다려줘.");
      return;
    }
    options.setAuthLoading(false);
    options.setProfileLoading(false);
    options.setAuthMessage("소셜 로그인 처리가 끝나지 않았어. 다시 시도해줘.");
    window.history.replaceState({}, "", window.location.pathname);
  }, 9000) : null;
  return { initFallback, oauthFallback };
}

function subscribeAuthStateChange(options: RuntimeOptions, callback: AuthCallbackState): { unsubscribe: () => void } {
  return subscribeAuthState((event, nextSession) => {
    options.authResolvedRef.current = true;
    if (event === "PASSWORD_RECOVERY") options.setPasswordRecoveryOpen(true);
    if (nextSession && callback.hasOAuthCallback) window.history.replaceState({}, "", "/app");
    options.setSession((prevSession) => nextSessionState(prevSession, nextSession, options));
    options.setAuthLoading(false);
  });
}

function nextSessionState(prevSession: SessionLike | null, nextSession: SessionLike | null, { profileLoadedRef, setProfileLoading, setStateReady }: RuntimeOptions): SessionLike | null {
  const sameUser = prevSession?.user?.id && nextSession?.user?.id === prevSession.user.id;
  if (!nextSession) {
    profileLoadedRef.current = false;
    setStateReady(false);
    setProfileLoading(false);
  } else if (sameUser && profileLoadedRef.current) {
    setStateReady(true);
    setProfileLoading(false);
  } else {
    profileLoadedRef.current = false;
    setStateReady(false);
    setProfileLoading(true);
  }
  return nextSession;
}

async function refreshSlowSession({ profileLoadedRef, setAuthLoading, setAuthMessage, setProfileLoading, setSaveStatus, setSession, setStateReady }: Pick<SessionBootstrapOptions, "profileLoadedRef" | "setAuthLoading" | "setAuthMessage" | "setProfileLoading" | "setSaveStatus" | "setSession" | "setStateReady">): Promise<void> {
  const { data, error } = await getAuthSession();
  if (error) {
    setAuthMessage(error.message || "로그인 상태 확인에 실패했어.");
    setAuthLoading(false);
    setProfileLoading(false);
    return;
  }
  if (!data.session) {
    setSession(null);
    setAuthLoading(false);
    setProfileLoading(false);
    setStateReady(false);
    return;
  }
  setSession(data.session);
  setAuthLoading(false);
  if (profileLoadedRef.current) {
    setProfileLoading(false);
    setStateReady(true);
    return;
  }
  profileLoadedRef.current = false;
  setProfileLoading(true);
  setStateReady(false);
  setSaveStatus("캐릭터 불러오는 중");
  setAuthMessage((msg) => msg.includes("캐릭터를 불러오지 못했어요")
    ? msg
    : "캐릭터를 불러오고 있어요. 저장된 캐릭터를 확인하는 중이라 잠깐만 기다려줘.");
}

function aliveRef(getter: () => boolean): () => boolean {
  return getter;
}
