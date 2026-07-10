export function useAliveCharacterLifecycle({
  accountSnapshot,
  accounts,
  activeId,
  applyRelationshipAutoFollowsToAccounts,
  blankChar,
  char,
  deleteStructuredCharacterAccount,
  deleteTarget,
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
  setDeleteTarget,
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
}) {
  function syncActive(next) {
    if (!activeId) return;
    setAccounts((accs) => accs.map((a) => a.id === activeId ? { ...a, char, gallery, posts, ...next } : a));
  }
  function wakeCharacter() {
    if (wakingRef.current) return;
    wakingRef.current = true;
    setWaking(true);
    const existing = findExistingCharacter(accounts, char);
    if (existing) wakeExistingCharacter(existing);
    else wakeNewCharacter();
    setStep("feed");
  }
  function switchAccount(id) {
    persistActiveAccount();
    const target = accounts.find((a) => a.id === id);
    if (!target) return;
    loadAccount(target, id);
    persistLocalSnapshot({ ...exportAppState(), accounts: accountSnapshot(), activeId: id, char: target.char, gallery: target.gallery || [], posts: target.posts || [], following: target.following || [] });
    feedInitRef.current = Boolean(target.posts && target.posts.length > 0);
    setStep("feed");
  }
  function editAccount(id) {
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
  function saveCharacterEdits() {
    if (!activeId) return;
    const editedAccounts = accounts.map((a) => a.id === activeId ? { ...a, char: { ...char }, gallery: [...gallery], posts, following } : a);
    const nextAccounts = applyRelationshipAutoFollowsToAccounts(editedAccounts);
    const nextActive = nextAccounts.find((a) => a.id === activeId);
    const nextFollowing = nextActive?.following || following;
    setAccounts(nextAccounts);
    setFollowing(nextFollowing);
    persistLocalSnapshot({ ...exportAppState(), accounts: nextAccounts, activeId, char: { ...char }, gallery: [...gallery], posts, following: nextFollowing });
    syncActiveSharedCharacter(nextFollowing, { ...char });
    syncOwnFollowRows(nextFollowing, { ...char });
    setStep("feed");
  }
  function goHome() {
    persistActiveAccount();
    setStep("home");
  }
  function startNewCharacter() {
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
  async function confirmDeleteCharacter() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const deletion = deleteCharacterState(targetId);
    applyCharacterDeletion(deletion, targetId);
    setDeleteTarget(null);
    setSaveStatus("삭제 저장 중");
    const structuredOk = await deleteStructuredCharacterAccount(targetId);
    await saveAppStateSnapshot(deletion.nextSnapshot);
    if (structuredOk === false) setSaveStatus("삭제 저장 일부 실패");
  }
  function wakeExistingCharacter(existing) {
    const nextFollowing = relationAutoFollowsFor(existing.char, existing.id, existing.following || [], accounts);
    const nextAccounts = applyRelationshipAutoFollowsToAccounts(accounts.map((a) => a.id === existing.id ? { ...a, following: nextFollowing } : a));
    const nextExisting = nextAccounts.find((a) => a.id === existing.id) || { ...existing, following: nextFollowing };
    setAccounts(nextAccounts);
    setActiveId(existing.id);
    setChar(nextExisting.char);
    setGallery(nextExisting.gallery || []);
    setPosts(nextExisting.posts || []);
    setFollowing(nextExisting.following || []);
    persistLocalSnapshot({ ...exportAppState(), accounts: nextAccounts, activeId: existing.id, char: nextExisting.char, gallery: nextExisting.gallery || [], posts: nextExisting.posts || [], following: nextExisting.following || [] });
    feedInitRef.current = Boolean(nextExisting.posts && nextExisting.posts.length > 0);
  }
  function wakeNewCharacter() {
    const id = "acc_" + Date.now();
    const baseAcc = { id, char: { ...char }, gallery: [...gallery], posts: [], following: [] };
    const poolAccounts = [...accounts, baseAcc];
    const acc = { ...baseAcc, following: relationAutoFollowsFor(baseAcc.char, id, [], poolAccounts) };
    const nextAccounts = applyRelationshipAutoFollowsToAccounts([...accounts, acc]);
    const nextAcc = nextAccounts.find((a) => a.id === id) || acc;
    setAccounts(nextAccounts);
    setActiveId(id);
    setPosts([]);
    setFollowing(nextAcc.following || []);
    persistLocalSnapshot({ ...exportAppState(), accounts: nextAccounts, activeId: id, char: { ...char }, gallery: [...gallery], posts: [], following: nextAcc.following || [] });
    feedInitRef.current = false;
  }
  function persistActiveAccount() {
    if (!activeId) return;
    setAccounts((accs) => accs.map((a) => a.id === activeId ? { ...a, char, gallery, posts, following } : a));
  }
  function loadAccount(target, id) {
    setChar(target.char);
    setGallery(target.gallery || []);
    setPosts(target.posts || []);
    setFollowing(target.following || []);
    setActiveId(id);
  }
  function deleteCharacterState(targetId) {
    const deletingActive = activeId === targetId;
    const nextAccounts = accountSnapshot().filter((a) => a.id !== targetId);
    const nextDmThreads = Object.fromEntries(Object.entries(dmThreads || {}).filter(([key]) => !key.startsWith(`owner::${targetId}::`)));
    const nextDmWorldPrefs = Object.fromEntries(Object.entries(dmWorldPrefs || {}).filter(([key]) => !key.startsWith(`owner::${targetId}::`)));
    const nextSnapshot = { ...exportAppState(), accounts: nextAccounts, activeId: deletingActive ? null : activeId, char: deletingActive ? blankChar() : char, gallery: deletingActive ? [] : gallery, posts: deletingActive ? [] : posts, following: deletingActive ? [] : following, dmThreads: nextDmThreads, dmWorldPrefs: nextDmWorldPrefs };
    return { deletingActive, nextAccounts, nextDmThreads, nextDmWorldPrefs, nextSnapshot };
  }
  function applyCharacterDeletion({ deletingActive, nextAccounts, nextDmThreads, nextDmWorldPrefs }) {
    setAccounts(nextAccounts);
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

function findExistingCharacter(accounts, char) {
  const charKey = `${char.name.trim()}|${char.handle.trim()}|${char.persona.trim()}`;
  return accounts.find((x) => `${x.char.name.trim()}|${(x.char.handle || "").trim()}|${x.char.persona.trim()}` === charKey);
}
