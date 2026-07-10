import { sanitizePosts } from "@/domain/feed/feedUtils";
import { hasSupabaseConfig, supabase } from "@/supabaseClient";

export function useAliveAppStatePersistence({
  accounts,
  activeId,
  affinity,
  blankChar,
  char,
  deletedDmKeys,
  deletedDmKeysRef,
  dmThreadTitles,
  dmThreads,
  dmWorldPrefs,
  feedInitRef,
  following,
  gallery,
  hasUsableSavedState,
  onboardingOpen,
  ownerPersona,
  persistLocalSnapshot,
  personas,
  posts,
  profileName,
  profileTableBrokenRef,
  session,
  syncStructuredState,
  setAccounts,
  setActiveId,
  setActiveSharedId,
  setAffinity,
  setChar,
  setCommentOn,
  setCommentText,
  setDeletedDmKeys,
  setDiscoverQuery,
  setDmInput,
  setDmThreads,
  setDmThreadTitles,
  setDmWorldPrefs,
  setEditingDmTitle,
  setFollowerCounts,
  setFollowing,
  setGallery,
  setNewChatMode,
  setOwnerPersona,
  setPeer,
  setPersonas,
  setPosts,
  setProfileName,
  setSaveStatus,
  setSharedFocusId,
  setShareStatus,
  setStep,
}) {
  function blankAppState(name = "") {
    return {
      version: 1,
      step: "home",
      accounts: [],
      activeId: null,
      char: blankChar(),
      gallery: [],
      posts: [],
      personas: [],
      dmThreads: {},
      dmThreadTitles: {},
      dmWorldPrefs: {},
      deletedDmKeys: [],
      ownerPersona: "",
      following: [],
      affinity: {},
      discoverQuery: "",
      profileName: name,
    };
  }
  function sanitizeSavedState(saved = {}) {
    return {
      ...saved,
      accounts: Array.isArray(saved.accounts)
        ? saved.accounts.map((account) => ({ ...account, posts: sanitizePosts(account.posts) }))
        : [],
      posts: sanitizePosts(saved.posts),
    };
  }
  function accountSnapshot() {
    return accounts.map((a) => a.id === activeId ? { ...a, char, gallery, posts: sanitizePosts(posts), following } : { ...a, posts: sanitizePosts(a.posts) });
  }
  function exportAppState() {
    return {
      version: 1,
      step: "home",
      accounts: accountSnapshot(),
      activeId,
      char,
      gallery,
      posts: sanitizePosts(posts),
      personas,
      dmThreads,
      dmThreadTitles,
      dmWorldPrefs,
      deletedDmKeys,
      ownerPersona,
      following,
      affinity,
      discoverQuery: "",
      profileName,
    };
  }
  function compactProfileBackup(snapshot = {}) {
    return {
      ...snapshot,
      accounts: (snapshot.accounts || []).map(compactAccountBackup),
      gallery: compactGallery(snapshot.gallery),
      posts: compactPosts(snapshot.posts),
      following: compactFollowing(snapshot.following),
      dmThreads: compactThreads(snapshot.dmThreads),
    };
  }
  function profileUpsertPayload(snapshot) {
    const payload = {
      id: session.user.id,
      email: session.user.email,
      display_name: profileName.trim() || session.user.email?.split("@")[0] || "",
      onboarded: !onboardingOpen,
    };
    if (hasUsableSavedState(snapshot)) payload.app_state = compactProfileBackup(snapshot);
    return payload;
  }
  async function saveAppStateSnapshot(snapshot) {
    if (!snapshot) return;
    if (!hasSupabaseConfig || !supabase || !session?.user) {
      persistLocalSnapshot(snapshot);
      return;
    }
    if (profileTableBrokenRef.current) {
      await syncStructuredState(snapshot);
      setSaveStatus("저장됨");
      return;
    }
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
  function applyAppState(saved = {}) {
    const cleanSaved = sanitizeSavedState(saved);
    const nextAccounts = Array.isArray(cleanSaved.accounts) ? cleanSaved.accounts : [];
    const active = saved.activeId ? nextAccounts.find((a) => a.id === saved.activeId) : null;
    applyAccountState(cleanSaved, nextAccounts, active);
    applyDmState(cleanSaved);
    applyProfileState(cleanSaved, active);
  }
  function resetRuntimeState(name = "") {
    applyAppState(blankAppState(name));
    setProfileName(name);
    setPeer(null);
    setDmInput("");
    setCommentOn(null);
    setCommentText("");
    setNewChatMode(null);
    setEditingDmTitle(null);
    setDmThreadTitles({});
    setShareStatus("");
    setSharedFocusId("");
    setActiveSharedId("");
    setFollowerCounts({});
  }
  function applyAccountState(cleanSaved, nextAccounts, active) {
    setAccounts(nextAccounts);
    setActiveId(active ? active.id : null);
    setChar(active?.char || cleanSaved.char || blankChar());
    setGallery(active?.gallery || cleanSaved.gallery || []);
    setPosts(sanitizePosts(active?.posts || cleanSaved.posts || []));
    setFollowing(active?.following || cleanSaved.following || []);
    setPersonas(Array.isArray(cleanSaved.personas) ? cleanSaved.personas : []);
  }
  function applyDmState(cleanSaved) {
    setDmThreads(cleanSaved.dmThreads || {});
    setDmThreadTitles(cleanSaved.dmThreadTitles || {});
    setDmWorldPrefs(cleanSaved.dmWorldPrefs || {});
    const nextDeletedKeys = Array.isArray(cleanSaved.deletedDmKeys) ? cleanSaved.deletedDmKeys : [];
    setDeletedDmKeys(nextDeletedKeys);
    deletedDmKeysRef.current = new Set(nextDeletedKeys);
  }
  function applyProfileState(cleanSaved, active) {
    setOwnerPersona(cleanSaved.ownerPersona || "");
    setAffinity(cleanSaved.affinity || {});
    setDiscoverQuery("");
    setSharedFocusId("");
    setPeer(null);
    setStep("home");
    feedInitRef.current = Boolean(active?.posts?.length || cleanSaved.posts?.length);
  }
  return { accountSnapshot, applyAppState, blankAppState, compactProfileBackup, exportAppState, profileUpsertPayload, resetRuntimeState, sanitizeSavedState, saveAppStateSnapshot };
}

function compactAccountBackup(account) {
  return {
    ...account,
    gallery: compactGallery(account.gallery),
    posts: compactPosts(account.posts),
    following: compactFollowing(account.following),
  };
}

function compactGallery(items) {
  return Array.isArray(items) ? items.slice(-12) : [];
}

function compactPosts(items) {
  return sanitizePosts(items).slice(0, 40).map((post) => ({ ...post, comments: Array.isArray(post.comments) ? post.comments.slice(-20) : [] }));
}

function compactFollowing(items) {
  return Array.isArray(items) ? items.slice(0, 120) : [];
}

function compactThreads(threads = {}) {
  return Object.fromEntries(Object.entries(threads).map(([key, value]) => [key, Array.isArray(value) ? value.slice(-80) : value]));
}
