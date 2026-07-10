import { sanitizePosts, type FeedPost } from "@/domain/feed/feedUtils";
import { hasSupabaseConfig, supabase } from "@/supabaseClient";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type MutableRef<T> = {
  current: T;
};

type CharacterState = Record<string, unknown> & {
  name?: string;
};

type AccountState = {
  char?: CharacterState;
  following?: unknown[];
  gallery?: unknown[];
  id: string;
  posts?: FeedPost[];
  [key: string]: unknown;
};

type AppState = {
  accounts?: AccountState[];
  activeId?: string | null;
  affinity?: Record<string, unknown>;
  char?: CharacterState;
  deletedDmKeys?: string[];
  discoverQuery?: string;
  dmThreadTitles?: Record<string, string>;
  dmThreads?: Record<string, unknown>;
  dmWorldPrefs?: Record<string, unknown>;
  following?: unknown[];
  gallery?: unknown[];
  ownerPersona?: string;
  personas?: unknown[];
  posts?: FeedPost[];
  profileName?: string;
  step?: string;
  version?: number;
};

type SessionLike = {
  user?: {
    email?: string;
    id: string;
  };
};

type ProfilePayload = {
  app_state?: AppState;
  display_name: string;
  email?: string;
  id: string;
  onboarded: boolean;
};

type AppStatePersistenceOptions = {
  accounts: AccountState[];
  activeId: string | null;
  affinity: Record<string, unknown>;
  blankChar: () => CharacterState;
  char: CharacterState;
  deletedDmKeys: string[];
  deletedDmKeysRef: MutableRef<Set<string>>;
  dmThreadTitles: Record<string, string>;
  dmThreads: Record<string, unknown>;
  dmWorldPrefs: Record<string, unknown>;
  feedInitRef: MutableRef<boolean>;
  following: unknown[];
  gallery: unknown[];
  hasUsableSavedState: (state: unknown) => boolean;
  onboardingOpen: boolean;
  ownerPersona: string;
  persistLocalSnapshot: (snapshot: AppState) => void;
  personas: unknown[];
  posts: FeedPost[];
  profileName: string;
  profileTableBrokenRef: MutableRef<boolean>;
  session: SessionLike | null;
  syncStructuredState: (snapshot: AppState) => Promise<unknown>;
  setAccounts: SetState<AccountState[]>;
  setActiveId: SetState<string | null>;
  setActiveSharedId: (value: string) => void;
  setAffinity: SetState<Record<string, unknown>>;
  setChar: SetState<CharacterState>;
  setCommentOn: (value: unknown) => void;
  setCommentText: (value: string) => void;
  setDeletedDmKeys: SetState<string[]>;
  setDiscoverQuery: (value: string) => void;
  setDmInput: (value: string) => void;
  setDmThreads: SetState<Record<string, unknown>>;
  setDmThreadTitles: SetState<Record<string, string>>;
  setDmWorldPrefs: SetState<Record<string, unknown>>;
  setEditingDmTitle: (value: unknown) => void;
  setFollowerCounts: (value: Record<string, unknown>) => void;
  setFollowing: SetState<unknown[]>;
  setGallery: SetState<unknown[]>;
  setNewChatMode: (value: unknown) => void;
  setOwnerPersona: (value: string) => void;
  setPeer: (value: unknown) => void;
  setPersonas: SetState<unknown[]>;
  setPosts: SetState<FeedPost[]>;
  setProfileName: (value: string) => void;
  setSaveStatus: (value: string) => void;
  setSharedFocusId: (value: string) => void;
  setShareStatus: (value: string) => void;
  setStep: (value: string) => void;
};

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
}: AppStatePersistenceOptions): Record<string, unknown> {
  function blankAppState(name = ""): AppState {
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
  function sanitizeSavedState(saved: AppState = {}): AppState {
    return {
      ...saved,
      accounts: Array.isArray(saved.accounts)
        ? saved.accounts.map((account) => ({ ...account, posts: sanitizePosts(account.posts) }))
        : [],
      posts: sanitizePosts(saved.posts),
    };
  }
  function accountSnapshot(): AccountState[] {
    return accounts.map((a) => a.id === activeId ? { ...a, char, gallery, posts: sanitizePosts(posts), following } : { ...a, posts: sanitizePosts(a.posts) });
  }
  function exportAppState(): AppState {
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
  function compactProfileBackup(snapshot: AppState = {}): AppState {
    return {
      ...snapshot,
      accounts: (snapshot.accounts || []).map(compactAccountBackup),
      gallery: compactGallery(snapshot.gallery),
      posts: compactPosts(snapshot.posts),
      following: compactFollowing(snapshot.following),
      dmThreads: compactThreads(snapshot.dmThreads),
    };
  }
  function profileUpsertPayload(snapshot: AppState): ProfilePayload {
    const payload: ProfilePayload = {
      id: session.user.id,
      email: session.user.email,
      display_name: profileName.trim() || session.user.email?.split("@")[0] || "",
      onboarded: !onboardingOpen,
    };
    if (hasUsableSavedState(snapshot)) payload.app_state = compactProfileBackup(snapshot);
    return payload;
  }
  async function saveAppStateSnapshot(snapshot: AppState | null | undefined): Promise<void> {
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
  function applyAppState(saved: AppState = {}): void {
    const cleanSaved = sanitizeSavedState(saved);
    const nextAccounts = Array.isArray(cleanSaved.accounts) ? cleanSaved.accounts : [];
    const active = saved.activeId ? nextAccounts.find((a) => a.id === saved.activeId) : null;
    applyAccountState(cleanSaved, nextAccounts, active);
    applyDmState(cleanSaved);
    applyProfileState(cleanSaved, active);
  }
  function resetRuntimeState(name = ""): void {
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
  function applyAccountState(cleanSaved: AppState, nextAccounts: AccountState[], active: AccountState | null): void {
    setAccounts(nextAccounts);
    setActiveId(active ? active.id : null);
    setChar(active?.char || cleanSaved.char || blankChar());
    setGallery(active?.gallery || cleanSaved.gallery || []);
    setPosts(sanitizePosts(active?.posts || cleanSaved.posts || []));
    setFollowing(active?.following || cleanSaved.following || []);
    setPersonas(Array.isArray(cleanSaved.personas) ? cleanSaved.personas : []);
  }
  function applyDmState(cleanSaved: AppState): void {
    setDmThreads(cleanSaved.dmThreads || {});
    setDmThreadTitles(cleanSaved.dmThreadTitles || {});
    setDmWorldPrefs(cleanSaved.dmWorldPrefs || {});
    const nextDeletedKeys = Array.isArray(cleanSaved.deletedDmKeys) ? cleanSaved.deletedDmKeys : [];
    setDeletedDmKeys(nextDeletedKeys);
    deletedDmKeysRef.current = new Set(nextDeletedKeys);
  }
  function applyProfileState(cleanSaved: AppState, active: AccountState | null): void {
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

function compactAccountBackup(account: AccountState): AccountState {
  return {
    ...account,
    gallery: compactGallery(account.gallery),
    posts: compactPosts(account.posts),
    following: compactFollowing(account.following),
  };
}

function compactGallery(items: unknown): unknown[] {
  return Array.isArray(items) ? items.slice(-12) : [];
}

function compactPosts(items: unknown): FeedPost[] {
  return sanitizePosts(items).slice(0, 40).map((post) => ({ ...post, comments: Array.isArray(post.comments) ? post.comments.slice(-20) : [] }));
}

function compactFollowing(items: unknown): unknown[] {
  return Array.isArray(items) ? items.slice(0, 120) : [];
}

function compactThreads(threads: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(threads).map(([key, value]) => [key, Array.isArray(value) ? value.slice(-80) : value]));
}
