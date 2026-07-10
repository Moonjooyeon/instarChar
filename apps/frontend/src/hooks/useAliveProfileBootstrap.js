import { useEffect } from "react";
import { withRejectTimeout } from "@/domain/app/asyncUtils";
import { hasSupabaseConfig, supabase } from "@/supabaseClient";

export function useAliveProfileBootstrap({
  applyAppState,
  blankAppState,
  hasUsableSavedState,
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
}) {
  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;
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
    return () => { cancelled = true; };
  }, [session?.user?.id, profileLoadRetry]);
}

async function loadProfile(options) {
  const { profileLoadedRef, profileTableBrokenRef, session } = options;
  profileTableBrokenRef.current = false;
  profileLoadedRef.current = false;
  const names = profileNames(session.user);
  const cachedState = options.readLocalSnapshot();
  const hasCachedState = options.hasUsableSavedState(cachedState);
  applyCachedState(options, cachedState, hasCachedState, names.fallbackName);
  try {
    await loadRemoteProfile(options, cachedState, hasCachedState, names);
  } catch (error) {
    await loadFallbackProfile(options, cachedState, hasCachedState, names.fallbackName, error);
  }
}

function profileNames(user) {
  const metadataName = user.user_metadata?.name || user.user_metadata?.full_name || user.user_metadata?.preferred_username || "";
  return {
    fallbackName: user.email?.split("@")[0] || metadataName || "사용자",
    metadataName,
  };
}

function applyCachedState(options, cachedState, hasCachedState, fallbackName) {
  if (hasCachedState) {
    options.applyAppState(cachedState);
    options.setProfileName(cachedState.profileName || fallbackName);
    options.setOnboardingOpen(false);
    options.profileLoadedRef.current = true;
    options.setStateReady(true);
    options.setProfileLoading(false);
    options.setSaveStatus("로컬 캐시");
    options.setAuthMessage("저장된 캐릭터를 먼저 보여주고 있어. 최신 데이터는 뒤에서 확인 중이야.");
  } else {
    options.setStateReady(false);
  }
  options.setProfileLoading(!hasCachedState);
  options.setSaveStatus(hasCachedState ? "최신 데이터 확인 중" : "불러오는 중");
  if (!hasCachedState) options.setAuthMessage("");
}

async function loadRemoteProfile(options, cachedState, hasCachedState, names) {
  const { data, error } = await profileQuery(options.session.user.id);
  if (options.cancelled()) return;
  if (error) throw error;
  const defaultName = data?.display_name || options.session.user.email?.split("@")[0] || names.metadataName || "사용자";
  const profileState = data?.app_state && typeof data.app_state === "object" ? data.app_state : null;
  const backupState = hasCachedState ? cachedState : (options.hasUsableSavedState(profileState) ? profileState : null);
  const baseState = baseProfileState(options.blankAppState, backupState, defaultName);
  const mergedState = await options.loadStructuredStateFallback(baseState, options.session.user.id);
  if (options.cancelled()) return;
  applyLoadedProfile(options, mergedState, defaultName, data);
  if (!data) await createProfileShell(options, defaultName);
}

function profileQuery(userId) {
  return withRejectTimeout(supabase
    .from("alive_profiles")
    .select("display_name,onboarded,app_state")
    .eq("id", userId)
    .maybeSingle(), 5000, "프로필 메타 로드");
}

function baseProfileState(blankAppState, backupState, defaultName) {
  return backupState
    ? { ...blankAppState(defaultName), ...backupState, profileName: backupState.profileName || defaultName }
    : blankAppState(defaultName);
}

function applyLoadedProfile(options, mergedState, defaultName, data) {
  options.applyAppState(mergedState);
  options.setProfileName(defaultName);
  options.setOnboardingOpen(!data?.onboarded);
  options.profileLoadedRef.current = true;
  options.setStateReady(true);
  options.setProfileLoading(false);
  options.setSaveStatus(data ? "저장됨" : "새 프로필");
}

async function createProfileShell(options, defaultName) {
  const { error } = await supabase.from("alive_profiles").upsert({
    id: options.session.user.id,
    email: options.session.user.email || "",
    display_name: defaultName,
    onboarded: false,
  });
  if (error) options.setSaveStatus(`프로필 생성 실패: ${error.message}`);
}

async function loadFallbackProfile(options, cachedState, hasCachedState, fallbackName, error) {
  if (options.cancelled()) return;
  console.warn("프로필 메타 로드 실패:", error);
  try {
    const baseState = hasCachedState
      ? { ...options.blankAppState(fallbackName), ...cachedState, profileName: cachedState.profileName || fallbackName }
      : options.blankAppState(fallbackName);
    const mergedState = await options.loadStructuredStateFallback(baseState, options.session.user.id);
    if (options.cancelled()) return;
    applyStructuredFallback(options, mergedState, fallbackName);
  } catch (fallbackError) {
    applyTemporaryProfile(options, fallbackName, fallbackError);
  }
}

function applyStructuredFallback(options, mergedState, fallbackName) {
  options.applyAppState(mergedState);
  options.setProfileName(fallbackName);
  options.setOnboardingOpen(false);
  options.profileLoadedRef.current = true;
  options.setProfileLoading(false);
  options.setStateReady(true);
  options.setSaveStatus("저장됨");
  options.setAuthMessage("저장된 캐릭터를 불러왔어. 저장 상태는 뒤에서 다시 확인할게.");
}

function applyTemporaryProfile(options, fallbackName, fallbackError) {
  if (options.cancelled()) return;
  console.warn("캐릭터 데이터 로드 실패:", fallbackError);
  options.applyAppState(options.blankAppState(fallbackName));
  options.setProfileName(fallbackName);
  options.setOnboardingOpen(false);
  options.profileLoadedRef.current = true;
  options.setProfileLoading(false);
  options.setStateReady(true);
  options.setSaveStatus("임시 진입");
  options.setAuthMessage("저장된 캐릭터 로드가 느려서 일단 앱에 들어왔어. 새로고침 대신 다시 불러오기를 눌러줘.");
}
