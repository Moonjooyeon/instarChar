import { sanitizePosts, type FeedPost } from "@/domain/feed/feedUtils";
import { hasRemoteApiClient, hasBackendApiConfig } from "@/api/client";
import { upsertProfile } from "@/api/profiles";
import type { AppStep } from "@/domain/app/aliveCore";
import { DM_RESPONSE_MODES, type DmResponseFlow } from "@/domain/dm/dmResponseMode";
import type { RoomAffinityPref } from "@/hooks/useAliveRelationships";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type MutableRef<T> = {
  current: T;
};

type CharacterState = Record<string, unknown> & {
  name?: string;
};

type AccountState = {
  char: CharacterState;
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
  dmResponseFlows?: Record<string, DmResponseFlow>;
  dmThreads?: Record<string, unknown>;
  dmWorldPrefs?: Record<string, RoomAffinityPref>;
  following?: unknown[];
  gallery?: unknown[];
  ownerPersona?: string;
  personas?: unknown[];
  posts?: FeedPost[];
  profileName?: string;
  step?: AppStep;
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
  dmResponseFlows: Record<string, DmResponseFlow>;
  dmThreads: Record<string, unknown>;
  dmWorldPrefs: Record<string, RoomAffinityPref>;
  feedInitRef: MutableRef<boolean>;
  following: unknown[];
  gallery: unknown[];
  onboardingOpen: boolean;
  ownerPersona: string;
  persistLocalSnapshot: (snapshot: AppState) => void;
  personas: unknown[];
  posts: FeedPost[];
  profileName: string;
  profileTableBrokenRef: MutableRef<boolean>;
  session: SessionLike | null;
  syncStructuredState: (snapshot: unknown) => Promise<unknown>;
  setAccounts: SetState<AccountState[]>;
  setActiveId: SetState<string | null>;
  setActiveSharedId: (value: string) => void;
  setAffinity: SetState<Record<string, unknown>>;
  setChar: SetState<CharacterState>;
  setCommentOn: (value: unknown) => void;
  setCommentText: (value: string) => void;
  setDeletedDmKeys: SetState<string[]>;
  setDiscoverQuery: (value: string) => void;
  setDmDrafts: SetState<Record<string, string>>;
  setDmThreads: SetState<Record<string, unknown>>;
  setDmThreadTitles: SetState<Record<string, string>>;
  setDmResponseFlows: SetState<Record<string, DmResponseFlow>>;
  setDmWorldPrefs: SetState<Record<string, RoomAffinityPref>>;
  setEditingDmTitle: (value: unknown) => void;
  setFollowerCounts: SetState<Record<string, number>>;
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
  setStep: (value: AppStep) => void;
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
  dmResponseFlows,
  dmThreads,
  dmWorldPrefs,
  feedInitRef,
  following,
  gallery,
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
  setDmDrafts,
  setDmThreads,
  setDmThreadTitles,
  setDmResponseFlows,
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
  setStep,
}: AppStatePersistenceOptions) {
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
      dmResponseFlows: {},
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
        ? saved.accounts.map(normalizeSavedAccount).filter((account): account is AccountState => account !== null)
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
      dmResponseFlows,
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
    const { posts: _posts, ...baseSnapshot } = snapshot;
    return {
      ...baseSnapshot,
      accounts: (snapshot.accounts || []).map(compactAccountBackup),
      gallery: compactGallery(snapshot.gallery),
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
    payload.app_state = compactProfileBackup(snapshot);
    return payload;
  }
  async function saveAppStateSnapshot(snapshot: AppState | null | undefined): Promise<void> {
    if (!snapshot) return;
    if (!hasBackendApiConfig || !hasRemoteApiClient() || !session?.user) {
      persistLocalSnapshot(snapshot);
      return;
    }
    if (profileTableBrokenRef.current) {
      await syncStructuredState(snapshot);
      setSaveStatus("저장됨");
      return;
    }
    const { error } = await upsertProfile(profileUpsertPayload(snapshot));
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
    setDmDrafts({});
    setCommentOn(null);
    setCommentText("");
    setNewChatMode(null);
    setEditingDmTitle(null);
    setDmThreadTitles({});
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
    setDmResponseFlows(sanitizeDmResponseFlows(cleanSaved.dmResponseFlows));
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
  function normalizeSavedAccount(value: AccountState): AccountState | null {
    if (!value || typeof value !== "object" || typeof value.id !== "string" || !value.id) return null;
    const char = normalizeSavedCharacter(value.char);
    return { ...value, char, posts: sanitizePosts(value.posts) };
  }

  function normalizeSavedCharacter(value: unknown): CharacterState {
    const raw = value && typeof value === "object" && !Array.isArray(value) ? value as CharacterState : {};
    const character = { ...blankChar(), ...raw };
    ["name", "handle", "age", "tone", "persona", "world", "speech", "catchphrase", "avatarImg", "headerImg", "surface", "inner", "situational", "triggers", "interests", "relations", "directions"].forEach((key) => {
      if (typeof character[key] !== "string") character[key] = "";
    });
    character.corrections = Array.isArray(character.corrections) ? character.corrections : [];
    character.lorebook = Array.isArray(character.lorebook) ? character.lorebook : [];
    return character;
  }
}

function sanitizeDmResponseFlows(value: unknown): Record<string, DmResponseFlow> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, DmResponseFlow] => DM_RESPONSE_MODES.some((mode) => mode.code === entry[1])));
}

function compactAccountBackup(account: AccountState): AccountState {
  const { posts: _posts, ...baseAccount } = account;
  return {
    ...baseAccount,
    gallery: compactGallery(account.gallery),
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
