type CharacterLike = {
  id?: string;
  name?: string;
  handle?: string;
  avatarImg?: string;
  gallery?: unknown[];
  posts?: unknown[];
  following?: FollowTarget[];
  relations?: string;
  [key: string]: unknown;
};

type AccountLike = {
  id: string;
  char: CharacterLike;
  gallery?: unknown[];
  posts?: unknown[];
  following?: FollowTarget[];
};

type RelationLike = {
  who?: string;
  label?: string;
};

type FollowTarget = CharacterLike & {
  id?: string;
  localAccountId?: string;
  owner?: string;
  ownerName?: string;
  external?: boolean;
  corrections?: string[];
  directions?: string;
  relationAuto?: boolean;
};

type NameMatcher = (a: string | null | undefined, b: string | null | undefined) => boolean;
type ParseRelations = (relations: string) => RelationLike[];
type RelationFor = (fromChar: CharacterLike, toChar: CharacterLike, strictSpecial?: boolean) => RelationLike | null | undefined;

type FollowTargetOptions = {
  targetChar: CharacterLike;
  targetAccountId?: string;
  poolAccounts?: AccountLike[];
  sharedCharacters?: FollowTarget[];
  nameMatch: NameMatcher;
  profileName?: string;
};

type AutoFollowOptions = {
  sourceChar: CharacterLike;
  sourceAccountId?: string;
  baseFollowing?: FollowTarget[];
  poolAccounts?: AccountLike[];
  sharedCharacters?: FollowTarget[];
  nameMatch: NameMatcher;
  parseRelations: ParseRelations;
  relationFor: RelationFor;
  profileName?: string;
};

type ApplyAutoFollowOptions = {
  accountList: AccountLike[];
  sharedCharacters?: FollowTarget[];
  nameMatch: NameMatcher;
  parseRelations: ParseRelations;
  relationFor: RelationFor;
  profileName?: string;
};

export function isLoveRelationLabel(label = ""): boolean {
  return /연인|애인|연애|사랑|부부|배우자|약혼|반려|순애|썸/.test(label || "");
}

export function accountToFollowTarget(account: AccountLike, profileName = ""): FollowTarget | null {
  if (!account?.char?.name) return null;
  return {
    ...account.char,
    id: account.id,
    localAccountId: account.id,
    name: account.char.name,
    handle: account.char.handle || account.char.name.replace(/\s/g, "").toLowerCase(),
    gallery: account.gallery || [],
    posts: account.posts || [],
    following: account.following || [],
    owner: "내 캐릭터",
    ownerName: profileName || "내 캐릭터",
    avatarImg: account.char.avatarImg || "",
    external: false,
  };
}

export function followTargetForCharacter({
  targetChar,
  targetAccountId = "",
  poolAccounts = [],
  sharedCharacters = [],
  nameMatch,
  profileName = "",
}: FollowTargetOptions): FollowTarget | null {
  if (!targetChar?.name) return null;
  const shared = sharedCharacters.find((c) => nameMatch(c.name, targetChar.name));
  if (shared) return { ...shared, relations: shared.relations || targetChar.relations || "" };
  const account = poolAccounts.find((a) => (targetAccountId && a.id === targetAccountId) || nameMatch(a.char.name, targetChar.name));
  if (account) return accountToFollowTarget(account, profileName);
  return null;
}

export function relationAutoFollowsFor({
  sourceChar,
  sourceAccountId = "",
  baseFollowing = [],
  poolAccounts = [],
  sharedCharacters = [],
  nameMatch,
  parseRelations,
  relationFor,
  profileName = "",
}: AutoFollowOptions): FollowTarget[] {
  if (!sourceChar?.relations) return baseFollowing || [];
  const next = [...(baseFollowing || [])];
  const addTarget = (target: FollowTarget | null) => {
    if (!target?.id || nameMatch(target.name, sourceChar.name)) return;
    if (next.some((f) => f.id === target.id || nameMatch(f.name, target.name))) return;
    next.push({ ...target, corrections: [], directions: "", relations: target.relations || "", relationAuto: true });
  };
  parseRelations(sourceChar.relations)
    .filter((rel) => rel.who && isLoveRelationLabel(rel.label))
    .forEach((rel) => {
      const target = followTargetForCharacter({
        targetChar: { name: rel.who },
        poolAccounts,
        sharedCharacters,
        nameMatch,
        profileName,
      });
      addTarget(target);
    });
  poolAccounts
    .filter((account) => account.id !== sourceAccountId)
    .forEach((account) => {
      const reverseHit = relationFor(account.char, sourceChar, true);
      if (reverseHit && isLoveRelationLabel(reverseHit.label)) addTarget(accountToFollowTarget(account, profileName));
    });
  sharedCharacters.forEach((shared) => {
    const reverseHit = relationFor(shared, sourceChar, true);
    if (reverseHit && isLoveRelationLabel(reverseHit.label)) addTarget(shared);
  });
  return next;
}

export function applyRelationshipAutoFollowsToAccounts({
  accountList,
  sharedCharacters = [],
  nameMatch,
  parseRelations,
  relationFor,
  profileName = "",
}: ApplyAutoFollowOptions): AccountLike[] {
  let changed = false;
  const next = accountList.map((account) => {
    const autoFollowing = relationAutoFollowsFor({
      sourceChar: account.char,
      sourceAccountId: account.id,
      baseFollowing: account.following || [],
      poolAccounts: accountList,
      sharedCharacters,
      nameMatch,
      parseRelations,
      relationFor,
      profileName,
    });
    if (autoFollowing.length === (account.following || []).length) return account;
    changed = true;
    return { ...account, following: autoFollowing };
  });
  return changed ? next : accountList;
}
