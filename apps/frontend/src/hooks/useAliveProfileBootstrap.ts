import { useEffect } from "react";
import {
  createProfileShell as createRemoteProfileShell,
  loadProfileRow,
  type ProfileState,
} from "@/api/profiles";
import { hasBackendApiConfig } from "@/api/client";

type MutableRef<T> = {
  current: T;
};

type UserLike = {
  email?: string;
  id: string;
  user_metadata?: Record<string, unknown>;
};

type SessionLike = {
  user?: UserLike;
};

type AppState = Record<string, unknown> & {
  profileName?: string;
};

type ProfileNames = {
  fallbackName: string;
  metadataName: string;
};

type ProfileRow = {
  app_state?: unknown;
  display_name?: string;
  onboarded?: boolean;
};

type ProfileBootstrapOptions = {
  applyAppState: (state: AppState) => void;
  blankAppState: (name?: string) => AppState;
  cancelled?: () => boolean;
  hasUsableSavedState: (state: unknown) => boolean;
  hydrateStructuredState: (baseState: AppState, profileState: ProfileState) => AppState;
  loadStructuredStateFallback: (
    baseState: AppState,
    ownerId: string,
  ) => Promise<AppState>;
  profileLoadedRef: MutableRef<boolean>;
  profileLoadRetry: unknown;
  profileTableBrokenRef: MutableRef<boolean>;
  readLocalSnapshot: () => unknown;
  session: SessionLike | null;
  setAuthMessage: (value: string) => void;
  setOnboardingOpen: (value: boolean) => void;
  setProfileLoading: (value: boolean) => void;
  setProfileName: (value: string) => void;
  setSaveStatus: (value: string) => void;
  setStateReady: (value: boolean) => void;
};

type LoadProfileOptions = Omit<ProfileBootstrapOptions, "profileLoadRetry"> & {
  cancelled: () => boolean;
};

export function useAliveProfileBootstrap({
  applyAppState,
  blankAppState,
  hasUsableSavedState,
  hydrateStructuredState,
  loadStructuredStateFallback,
  profileLoadedRef,
  profileLoadRetry,
  profileTableBrokenRef,
  readLocalSnapshot,
  session,
  setAuthMessage,
  setOnboardingOpen,
  setProfileLoading,
  setProfileName,
  setSaveStatus,
  setStateReady,
}: ProfileBootstrapOptions): void {
  useEffect(() => {
    if (!hasBackendApiConfig) return;
    if (!session?.user) {
      profileLoadedRef.current = false;
      setStateReady(false);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    loadProfile({
      applyAppState,
      blankAppState,
      cancelled: () => cancelled,
      hasUsableSavedState,
      hydrateStructuredState,
      loadStructuredStateFallback,
      profileLoadedRef,
      profileTableBrokenRef,
      readLocalSnapshot,
      session,
      setAuthMessage,
      setOnboardingOpen,
      setProfileLoading,
      setProfileName,
      setSaveStatus,
      setStateReady,
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, profileLoadRetry]);
}

async function loadProfile(options: LoadProfileOptions): Promise<void> {
  const { profileLoadedRef, profileTableBrokenRef, session } = options;
  if (!session?.user) return;
  profileTableBrokenRef.current = false;
  profileLoadedRef.current = false;
  const names = profileNames(session.user);
  const cachedState = options.readLocalSnapshot();
  const hasCachedState = options.hasUsableSavedState(cachedState);
  applyCachedState(options, cachedState, hasCachedState, names.fallbackName);
  try {
    await loadRemoteProfile(options, cachedState, hasCachedState, names);
  } catch (error) {
    await loadFallbackProfile(
      options,
      cachedState,
      hasCachedState,
      names.fallbackName,
      error,
    );
  }
}

function profileNames(user: UserLike): ProfileNames {
  const metadataName = stringValue(
    user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.preferred_username,
  );
  return {
    fallbackName: user.email?.split("@")[0] || metadataName || "사용자",
    metadataName,
  };
}

function applyCachedState(
  options: LoadProfileOptions,
  cachedState: unknown,
  hasCachedState: boolean,
  fallbackName: string,
): void {
  if (hasCachedState) {
    const state = appStateFromUnknown(cachedState);
    options.applyAppState(state);
    options.setProfileName(state.profileName || fallbackName);
    options.setOnboardingOpen(false);
    options.profileLoadedRef.current = true;
    options.setStateReady(true);
    options.setProfileLoading(false);
    options.setSaveStatus("로컬 캐시");
    options.setAuthMessage("");
  } else {
    options.setStateReady(false);
  }
  options.setProfileLoading(!hasCachedState);
  options.setSaveStatus(hasCachedState ? "최신 데이터 확인 중" : "불러오는 중");
  if (!hasCachedState) options.setAuthMessage("");
}

async function loadRemoteProfile(
  options: LoadProfileOptions,
  cachedState: unknown,
  hasCachedState: boolean,
  names: ProfileNames,
): Promise<void> {
  if (!options.session?.user) return;
  const { data, error } = await loadProfileRow(options.session.user.id);
  if (options.cancelled()) return;
  if (error) throw error;
  const defaultName =
    data?.display_name ||
    options.session.user.email?.split("@")[0] ||
    names.metadataName ||
    "사용자";
  const profileState =
    data?.app_state && typeof data.app_state === "object"
      ? data.app_state
      : null;
  const backupState = hasCachedState
    ? appStateFromUnknown(cachedState)
    : options.hasUsableSavedState(profileState)
      ? appStateFromUnknown(profileState)
      : null;
  const baseState = baseProfileState(
    options.blankAppState,
    backupState,
    defaultName,
  );
  const mergedState = options.hydrateStructuredState(baseState, data || {});
  if (options.cancelled()) return;
  applyLoadedProfile(options, mergedState, defaultName, data);
  if (!data) await createProfileShell(options, defaultName);
}

function baseProfileState(
  blankAppState: (name?: string) => AppState,
  backupState: AppState | null,
  defaultName: string,
): AppState {
  return backupState
    ? {
        ...blankAppState(defaultName),
        ...backupState,
        profileName: backupState.profileName || defaultName,
      }
    : blankAppState(defaultName);
}

function applyLoadedProfile(
  options: LoadProfileOptions,
  mergedState: AppState,
  defaultName: string,
  data: ProfileRow | null,
): void {
  options.applyAppState(mergedState);
  options.setProfileName(defaultName);
  options.setOnboardingOpen(!data?.onboarded);
  options.profileLoadedRef.current = true;
  options.setStateReady(true);
  options.setProfileLoading(false);
  options.setSaveStatus(data ? "저장됨" : "새 프로필");
}

async function createProfileShell(
  options: LoadProfileOptions,
  defaultName: string,
): Promise<void> {
  if (!options.session?.user) return;
  const { error } = await createRemoteProfileShell({
    id: options.session.user.id,
    email: options.session.user.email || "",
    display_name: defaultName,
    onboarded: false,
  });
  if (error) options.setSaveStatus(`프로필 생성 실패: ${error.message}`);
}

async function loadFallbackProfile(
  options: LoadProfileOptions,
  cachedState: unknown,
  hasCachedState: boolean,
  fallbackName: string,
  error: unknown,
): Promise<void> {
  if (!options.session?.user) return;
  if (options.cancelled()) return;
  console.warn("프로필 메타 로드 실패:", error);
  try {
    const baseState = hasCachedState
      ? {
          ...options.blankAppState(fallbackName),
          ...appStateFromUnknown(cachedState),
          profileName:
            appStateFromUnknown(cachedState).profileName || fallbackName,
        }
      : options.blankAppState(fallbackName);
    const mergedState = await options.loadStructuredStateFallback(
      baseState,
      options.session.user.id,
    );
    if (options.cancelled()) return;
    applyStructuredFallback(options, mergedState, fallbackName);
  } catch (fallbackError) {
    applyTemporaryProfile(options, fallbackName, fallbackError);
  }
}

function applyStructuredFallback(
  options: LoadProfileOptions,
  mergedState: AppState,
  fallbackName: string,
): void {
  options.applyAppState(mergedState);
  options.setProfileName(fallbackName);
  options.setOnboardingOpen(false);
  options.profileLoadedRef.current = true;
  options.setProfileLoading(false);
  options.setStateReady(true);
  options.setSaveStatus("저장됨");
  options.setAuthMessage(
    "저장된 캐릭터를 불러왔어. 저장 상태는 뒤에서 다시 확인할게.",
  );
}

function applyTemporaryProfile(
  options: LoadProfileOptions,
  fallbackName: string,
  fallbackError: unknown,
): void {
  if (options.cancelled()) return;
  console.warn("캐릭터 데이터 로드 실패:", fallbackError);
  options.applyAppState(options.blankAppState(fallbackName));
  options.setProfileName(fallbackName);
  options.setOnboardingOpen(false);
  options.profileLoadedRef.current = true;
  options.setProfileLoading(false);
  options.setStateReady(true);
  options.setSaveStatus("임시 진입");
  options.setAuthMessage(
    "저장된 캐릭터 로드가 느려서 일단 앱에 들어왔어. 새로고침 대신 다시 불러오기를 눌러줘.",
  );
}

function appStateFromUnknown(value: unknown): AppState {
  return value && typeof value === "object" ? (value as AppState) : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
