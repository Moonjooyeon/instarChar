import { useEffect } from "react";

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
}) {
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

function syncAccountRelations({ applyRelationshipAutoFollowsToAccounts, normalizeRelationLabelsForChar, setAccounts }) {
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

function normalizedFollowingSnapshot({ accounts, activeId, char, following, normalizeRelationLabelsForChar, relationAutoFollowsFor }) {
  let changed = false;
  const items = relationAutoFollowsFor(char, activeId, following, accounts).map((f) => {
    const normalized = normalizeRelationLabelsForChar(f);
    if (normalized !== f) changed = true;
    return normalized;
  });
  if (items.length !== following.length) changed = true;
  return { changed, items };
}
