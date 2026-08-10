import { useRef } from "react";
import { CharacterApiError, saveCharacter, type CharacterWrite } from "@/api/characters";
import type { AppStep } from "@/domain/app/aliveCore";
import type { FeedPost } from "@/domain/feed/feedUtils";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type MutableRef<T> = {
  current: T;
};

type CharacterState = Record<string, unknown> & {
  handle?: string;
  name?: string;
  persona?: unknown;
};

type AccountState = {
  char: CharacterState;
  following?: unknown[];
  gallery?: unknown[];
  id: string;
  posts?: FeedPost[];
};

type DeleteTarget = {
  id: string;
};

type DeletionState = {
  deletingActive: boolean;
  nextAccounts: AccountState[];
  nextDmDrafts: Record<string, string>;
  nextDmImageDrafts: Record<string, unknown>;
  nextDmResponseFlows: Record<string, unknown>;
  nextDmThreads: Record<string, unknown>;
  nextDmWorldPrefs: Record<string, unknown>;
  nextSnapshot: Record<string, unknown>;
};

type CharacterLifecycleOptions = {
  accountSnapshot: () => AccountState[];
  accounts: AccountState[];
  activeId: string | null;
  applyRelationshipAutoFollowsToAccounts: (accounts: AccountState[]) => AccountState[];
  blankChar: () => CharacterState;
  char: CharacterState;
  deleteStructuredCharacterAccount: (targetId: string) => Promise<boolean | undefined>;
  deleteTarget: DeleteTarget | null;
  dmDrafts: Record<string, string>;
  dmImageDrafts: Record<string, unknown>;
  dmResponseFlows: Record<string, unknown>;
  dmThreads: Record<string, unknown>;
  dmWorldPrefs: Record<string, unknown>;
  exportAppState: () => Record<string, unknown>;
  feedInitRef: MutableRef<boolean>;
  following: unknown[];
  gallery: unknown[];
  persistLocalSnapshot: (snapshot: Record<string, unknown>) => void;
  posts: FeedPost[];
  relationAutoFollowsFor: (sourceChar: CharacterState, sourceAccountId: string, baseFollowing: unknown[], poolAccounts: AccountState[]) => unknown[];
  saveAppStateSnapshot: (snapshot: Record<string, unknown>) => Promise<void>;
  setAccounts: SetState<AccountState[]>;
  setActiveId: SetState<string | null>;
  setChar: SetState<CharacterState>;
  setCharacterSaveError: (value: string) => void;
  setDeleteTarget: (value: DeleteTarget | null) => void;
  setDmDrafts: SetState<Record<string, string>>;
  setDmImageDrafts: SetState<Record<string, unknown>>;
  setDmResponseFlows: SetState<Record<string, unknown>>;
  setDmThreads: SetState<Record<string, unknown>>;
  setDmWorldPrefs: SetState<Record<string, unknown>>;
  setDump: (value: string) => void;
  setFollowing: SetState<unknown[]>;
  setGallery: SetState<unknown[]>;
  setParseError: (value: string) => void;
  setParseFailed: (value: boolean) => void;
  setPeer: (value: unknown) => void;
  setPosts: SetState<FeedPost[]>;
  setRpLog: (value: string) => void;
  setSaveStatus: (value: string) => void;
  setStep: (value: AppStep) => void;
  setWaking: (value: boolean) => void;
  syncActiveSharedCharacter: (following: unknown[], char: CharacterState) => unknown;
  syncOwnFollowRows: (following: unknown[], char: CharacterState) => unknown;
  wakingRef: MutableRef<boolean>;
};

export function useAliveCharacterLifecycle({
  accountSnapshot,
  accounts,
  activeId,
  applyRelationshipAutoFollowsToAccounts,
  blankChar,
  char,
  deleteStructuredCharacterAccount,
  deleteTarget,
  dmDrafts,
  dmImageDrafts,
  dmResponseFlows,
  dmThreads,
  dmWorldPrefs,
  exportAppState,
  feedInitRef,
  following,
  gallery,
  persistLocalSnapshot,
  posts,
  relationAutoFollowsFor,
  saveAppStateSnapshot,
  setAccounts,
  setActiveId,
  setChar,
  setCharacterSaveError,
  setDeleteTarget,
  setDmDrafts,
  setDmImageDrafts,
  setDmResponseFlows,
  setDmThreads,
  setDmWorldPrefs,
  setDump,
  setFollowing,
  setGallery,
  setParseError,
  setParseFailed,
  setPeer,
  setPosts,
  setRpLog,
  setSaveStatus,
  setStep,
  setWaking,
  syncActiveSharedCharacter,
  syncOwnFollowRows,
  wakingRef,
}: CharacterLifecycleOptions) {
  const draftIdRef = useRef<string | null>(null);
  function syncActive(next: Record<string, unknown>): void {
    if (!activeId) return;
    setAccounts((accs) => accs.map((a) => a.id === activeId ? { ...a, char, gallery, posts, ...next } : a));
  }
  async function wakeCharacter(): Promise<void> {
    if (await executeCharacterSave(wakeNewCharacter)) setStep("feed");
  }
  function switchAccount(id: string): void {
    persistActiveAccount();
    const target = accounts.find((a) => a.id === id);
    if (!target) return;
    loadAccount(target, id);
    persistLocalSnapshot({ ...exportAppState(), accounts: accountSnapshot(), activeId: id, char: target.char, gallery: target.gallery || [], posts: target.posts || [], following: target.following || [] });
    feedInitRef.current = Boolean(target.posts && target.posts.length > 0);
    setStep("feed");
  }
  function editAccount(id: string): void {
    persistActiveAccount();
    const target = accounts.find((a) => a.id === id);
    if (!target) return;
    loadAccount(target, id);
    setParseFailed(false);
    setParseError("");
    setWaking(false);
    wakingRef.current = false;
    setStep("confirm");
  }
  async function saveCharacterEdits(): Promise<void> {
    if (!activeId) return;
    if (await executeCharacterSave(() => persistCharacterEdits(activeId))) setStep("feed");
  }
  async function persistCharacterEdits(accountId: string): Promise<void> {
    const saved = await saveCharacter(accountId, characterWritePayload(char, gallery, following));
    const savedChar = responseCharacter(char, saved);
    const editedAccounts = accounts.map((a) => a.id === accountId ? { ...a, char: savedChar, gallery: [...saved.gallery], posts, following: saved.following } : a);
    const nextAccounts = applyRelationshipAutoFollowsToAccounts(editedAccounts);
    const nextActive = nextAccounts.find((a) => a.id === accountId);
    const nextFollowing = nextActive?.following || following;
    setAccounts(nextAccounts);
    setChar(savedChar);
    setFollowing(nextFollowing);
    persistLocalSnapshot({ ...exportAppState(), accounts: nextAccounts, activeId: accountId, char: savedChar, gallery: [...saved.gallery], posts, following: nextFollowing });
    syncActiveSharedCharacter(nextFollowing, savedChar);
    syncOwnFollowRows(nextFollowing, savedChar);
  }
  function goHome(): void {
    persistActiveAccount();
    setStep("home");
  }
  function startNewCharacter(): void {
    draftIdRef.current = null;
    wakingRef.current = false;
    setWaking(false);
    setChar(blankChar());
    setGallery([]);
    setPosts([]);
    setDump("");
    setRpLog("");
    setParseFailed(false);
    setParseError("");
    setActiveId(null);
    setStep("dump");
  }
  async function confirmDeleteCharacter(): Promise<void> {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const deletion = deleteCharacterState(targetId);
    setSaveStatus("삭제 저장 중");
    try {
      const structuredOk = await deleteStructuredCharacterAccount(targetId);
      if (structuredOk === false) {
        setSaveStatus("삭제 저장 실패");
        return;
      }
      persistLocalSnapshot(deletion.nextSnapshot);
      applyCharacterDeletion(deletion);
      setDeleteTarget(null);
      await saveAppStateSnapshot(deletion.nextSnapshot);
    } catch (error) {
      setSaveStatus("삭제 저장 실패");
    }
  }
  async function wakeNewCharacter(): Promise<void> {
    const id = draftIdRef.current || newDraftId();
    draftIdRef.current = id;
    const baseAcc = { id, char: { ...char }, gallery: [...gallery], posts: [], following: [] };
    const poolAccounts = [...accounts, baseAcc];
    const acc = { ...baseAcc, following: relationAutoFollowsFor(baseAcc.char, id, [], poolAccounts) };
    const saved = await saveCharacter(id, characterWritePayload(char, gallery, acc.following));
    commitNewCharacter(acc, saved);
    draftIdRef.current = null;
  }
  function commitNewCharacter(account: AccountState, saved: Awaited<ReturnType<typeof saveCharacter>>): void {
    const savedChar = responseCharacter(account.char, saved);
    const savedAccount = { ...account, char: savedChar, gallery: saved.gallery, following: saved.following };
    const nextAccounts = applyRelationshipAutoFollowsToAccounts([...accounts, savedAccount]);
    const nextAcc = nextAccounts.find((item) => item.id === account.id) || savedAccount;
    setAccounts(nextAccounts);
    setActiveId(account.id);
    setChar(savedChar);
    setGallery(saved.gallery);
    setPosts([]);
    setFollowing(nextAcc.following || []);
    persistLocalSnapshot({ ...exportAppState(), accounts: nextAccounts, activeId: account.id, char: savedChar, gallery: saved.gallery, posts: [], following: nextAcc.following || [] });
    feedInitRef.current = false;
  }
  async function executeCharacterSave(action: () => Promise<void>): Promise<boolean> {
    if (wakingRef.current) return false;
    wakingRef.current = true;
    setWaking(true);
    setCharacterSaveError("");
    try {
      await action();
      return true;
    } catch (error) {
      setCharacterSaveError(characterSaveError(error));
      return false;
    } finally {
      wakingRef.current = false;
      setWaking(false);
    }
  }
  function persistActiveAccount(): void {
    if (!activeId) return;
    setAccounts((accs) => accs.map((a) => a.id === activeId ? { ...a, char, gallery, posts, following } : a));
  }
  function loadAccount(target: AccountState, id: string): void {
    setChar(target.char);
    setGallery(target.gallery || []);
    setPosts(target.posts || []);
    setFollowing(target.following || []);
    setActiveId(id);
  }
  function deleteCharacterState(targetId: string): DeletionState {
    const deletingActive = activeId === targetId;
    const nextAccounts = accountSnapshot().filter((a) => a.id !== targetId);
    const nextDmDrafts = Object.fromEntries(Object.entries(dmDrafts).filter(([key]) => !isDeletedAccountDmKey(key, targetId)));
    const nextDmImageDrafts = Object.fromEntries(Object.entries(dmImageDrafts).filter(([key]) => !isDeletedAccountDmKey(key, targetId)));
    const nextDmResponseFlows = Object.fromEntries(Object.entries(dmResponseFlows || {}).filter(([key]) => !isDeletedAccountDmKey(key, targetId)));
    const nextDmThreads = Object.fromEntries(Object.entries(dmThreads || {}).filter(([key]) => !isDeletedAccountDmKey(key, targetId)));
    const nextDmWorldPrefs = Object.fromEntries(Object.entries(dmWorldPrefs || {}).filter(([key]) => !isDeletedAccountDmKey(key, targetId)));
    const nextSnapshot = { ...exportAppState(), accounts: nextAccounts, activeId: deletingActive ? null : activeId, char: deletingActive ? blankChar() : char, gallery: deletingActive ? [] : gallery, posts: deletingActive ? [] : posts, following: deletingActive ? [] : following, dmResponseFlows: nextDmResponseFlows, dmThreads: nextDmThreads, dmWorldPrefs: nextDmWorldPrefs };
    return { deletingActive, nextAccounts, nextDmDrafts, nextDmImageDrafts, nextDmResponseFlows, nextDmThreads, nextDmWorldPrefs, nextSnapshot };
  }
  function applyCharacterDeletion({ deletingActive, nextAccounts, nextDmDrafts, nextDmImageDrafts, nextDmResponseFlows, nextDmThreads, nextDmWorldPrefs }: DeletionState): void {
    setAccounts(nextAccounts);
    setDmDrafts(nextDmDrafts);
    setDmImageDrafts(nextDmImageDrafts);
    setDmResponseFlows(nextDmResponseFlows);
    setDmThreads(nextDmThreads);
    setDmWorldPrefs(nextDmWorldPrefs);
    if (!deletingActive) return;
    wakingRef.current = false;
    setWaking(false);
    setActiveId(null);
    setChar(blankChar());
    setGallery([]);
    setPosts([]);
    setFollowing([]);
    setPeer(null);
    setStep("home");
  }
  return { confirmDeleteCharacter, editAccount, goHome, saveCharacterEdits, startNewCharacter, switchAccount, syncActive, wakeCharacter };
}

function isDeletedAccountDmKey(key: string, targetId: string): boolean {
  return key.startsWith(`owner::${targetId}::`) || key.startsWith(`local::${targetId}::`);
}

function characterWritePayload(char: CharacterState, gallery: unknown[], following: unknown[]): CharacterWrite {
  return { name: textValue(char.name).trim(), handle: textValue(char.handle), character: { ...char }, gallery: [...gallery], following: [...following] };
}

function responseCharacter(char: CharacterState, saved: Awaited<ReturnType<typeof saveCharacter>>): CharacterState {
  return { ...char, ...saved.character, name: saved.name, handle: saved.handle };
}

function characterSaveError(error: unknown): string {
  if (error instanceof CharacterApiError && error.code === "CHARACTER_HANDLE_TAKEN") return "이미 사용 중인 아이디야. 다른 아이디를 골라줘.";
  if (error instanceof Error && error.message) return error.message;
  return "캐릭터를 저장하지 못했어. 잠시 후 다시 시도해줘.";
}

function newDraftId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `acc_${randomId || Date.now()}`;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
