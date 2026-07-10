import { useEffect } from "react";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type SyncCharacter = {
  name?: string;
  relations?: string;
  [key: string]: unknown;
};

type SyncAccount = {
  char: SyncCharacter;
  [key: string]: unknown;
};

type FollowingSnapshot = {
  changed: boolean;
  items: SyncCharacter[];
};

export function useAliveRelationshipSync({
  accounts,
  activeId,
  affinity,
  applyRelationshipAutoFollowsToAccounts,
  canUseApp,
  char,
  following,
  normalizeRelationLabelsForChar,
  relationAutoFollowsFor,
  setAccounts,
  setChar,
  setFollowing,
  stateReady,
  syncActiveSharedCharacter,
  syncOwnFollowRows,
}: {
  accounts: SyncAccount[];
  activeId: string | null;
  affinity: unknown;
  applyRelationshipAutoFollowsToAccounts: (accountList: SyncAccount[]) => SyncAccount[];
  canUseApp: boolean;
  char: SyncCharacter;
  following: SyncCharacter[];
  normalizeRelationLabelsForChar: (targetChar: SyncCharacter) => SyncCharacter;
  relationAutoFollowsFor: (char: SyncCharacter, activeId: string | null, following: SyncCharacter[], accounts: SyncAccount[]) => SyncCharacter[];
  setAccounts: SetState<SyncAccount[]>;
  setChar: SetState<SyncCharacter>;
  setFollowing: SetState<SyncCharacter[]>;
  stateReady: boolean;
  syncActiveSharedCharacter: (items: SyncCharacter[], char: SyncCharacter) => unknown;
  syncOwnFollowRows: (items: SyncCharacter[], char: SyncCharacter) => unknown;
}): void {
  useEffect(() => {
    if (!canUseApp || !stateReady) return;
    const nextChar = normalizeRelationLabelsForChar(char);
    const charChanged = nextChar !== char;
    if (charChanged) setChar(nextChar);
    syncAccountRelations({ applyRelationshipAutoFollowsToAccounts, normalizeRelationLabelsForChar, setAccounts });
    const nextFollowing = normalizedFollowingSnapshot({ accounts, activeId, char: nextChar, following, normalizeRelationLabelsForChar, relationAutoFollowsFor });
    if (nextFollowing.changed) setFollowing(nextFollowing.items);
    if (charChanged || nextFollowing.changed) {
      syncActiveSharedCharacter(nextFollowing.items, nextChar);
      syncOwnFollowRows(nextFollowing.items, nextChar);
    }
  }, [canUseApp, stateReady, affinity]);
}

function syncAccountRelations(options: {
  applyRelationshipAutoFollowsToAccounts: (accountList: SyncAccount[]) => SyncAccount[];
  normalizeRelationLabelsForChar: (targetChar: SyncCharacter) => SyncCharacter;
  setAccounts: SetState<SyncAccount[]>;
}): void {
  const { applyRelationshipAutoFollowsToAccounts, normalizeRelationLabelsForChar, setAccounts } = options;
  setAccounts((prev) => {
    let localChanged = false;
    const normalizedAccounts = prev.map((account) => {
      const normalized = normalizeRelationLabelsForChar(account.char);
      if (normalized !== account.char) localChanged = true;
      return normalized !== account.char ? { ...account, char: normalized } : account;
    });
    const next = applyRelationshipAutoFollowsToAccounts(normalizedAccounts);
    if (next !== normalizedAccounts) localChanged = true;
    return localChanged ? next : prev;
  });
}

function normalizedFollowingSnapshot(options: {
  accounts: SyncAccount[];
  activeId: string | null;
  char: SyncCharacter;
  following: SyncCharacter[];
  normalizeRelationLabelsForChar: (targetChar: SyncCharacter) => SyncCharacter;
  relationAutoFollowsFor: (char: SyncCharacter, activeId: string | null, following: SyncCharacter[], accounts: SyncAccount[]) => SyncCharacter[];
}): FollowingSnapshot {
  const { accounts, activeId, char, following, normalizeRelationLabelsForChar, relationAutoFollowsFor } = options;
  let changed = false;
  const items = relationAutoFollowsFor(char, activeId, following, accounts).map((f) => {
    const normalized = normalizeRelationLabelsForChar(f);
    if (normalized !== f) changed = true;
    return normalized;
  });
  if (items.length !== following.length) changed = true;
  return { changed, items };
}
