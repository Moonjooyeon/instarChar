import {
  mergeTimelinePosts,
  postsFromFollowedCharacter,
  type FeedPost,
  type FollowedCharacter,
} from "@/domain/feed/feedUtils";
import {
  applyRelationshipAutoFollowsToAccounts as applyRelationshipAutoFollowsToAccountsUtil,
  relationAutoFollowsFor as relationAutoFollowsForUtil,
} from "@/domain/relationships/relationshipFollowUtils";
import { dirKey, nameMatch } from "@/domain/relationships/affinityUtils";
import { parseRelations, type CharacterLike, type RelationEntry } from "@/domain/app/aliveCore";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type AccountWithCharacter = {
  char: FollowCharacter;
  id: string;
};

type FollowCharacter = FollowedCharacter & CharacterLike & {
  corrections?: string[];
  directions?: string;
  external?: boolean;
  id?: string;
  name: string;
  relations?: string;
};

type FollowActionsOptions = {
  accounts: AccountWithCharacter[];
  char: FollowCharacter;
  following: FollowCharacter[];
  profileName: string;
  recordFollowChange: (poolChar: FollowCharacter, wasFollowing: boolean) => Promise<unknown>;
  recordRelationshipFollowBack: (poolChar: FollowCharacter) => Promise<unknown>;
  relationBaseFor: (from: string, to: string) => number | null | undefined;
  relationFor: (source: FollowCharacter, target: FollowCharacter, strictSpecial?: boolean) => RelationEntry | null | undefined;
  setAffinity: SetState<Record<string, number>>;
  setFollowing: SetState<FollowCharacter[]>;
  setPosts: SetState<FeedPost[]>;
  sharedCharacters: FollowCharacter[];
  syncActiveSharedCharacter: (nextFollowing: FollowCharacter[]) => unknown;
  syncOwnFollowRows: (nextFollowing: FollowCharacter[]) => unknown;
};

export function useAliveFollowActions({
  accounts,
  char,
  following,
  profileName,
  recordFollowChange,
  recordRelationshipFollowBack,
  relationBaseFor,
  relationFor,
  setAffinity,
  setFollowing,
  setPosts,
  sharedCharacters,
  syncActiveSharedCharacter,
  syncOwnFollowRows,
}: FollowActionsOptions): {
  applyRelationshipAutoFollowsToAccounts: (accountList: AccountWithCharacter[]) => AccountWithCharacter[];
  relationAutoFollowsFor: (sourceChar: FollowCharacter, sourceAccountId?: string, baseFollowing?: FollowCharacter[], poolAccounts?: AccountWithCharacter[]) => FollowCharacter[];
  toggleFollow: (poolChar: FollowCharacter) => Promise<void>;
  verifyMutualLove: (myChar: FollowCharacter, otherChar: FollowCharacter) => { mutual: boolean; theirLoves: boolean };
} {
  function verifyMutualLove(myChar: FollowCharacter, otherChar: FollowCharacter): { mutual: boolean; theirLoves: boolean } {
    const myHit = relationFor(myChar, otherChar, true);
    const theirHit = relationFor(otherChar, myChar, true);
    const myLabel = myHit?.label || "";
    const theirLabel = theirHit?.label || "";
    return { mutual: isLoveLabel(myLabel) && isLoveLabel(theirLabel), theirLoves: isLoveLabel(theirLabel) };
  }
  function relationAutoFollowsFor(sourceChar: FollowCharacter, sourceAccountId = "", baseFollowing: FollowCharacter[] = [], poolAccounts = accounts): FollowCharacter[] {
    return relationAutoFollowsForUtil({ sourceChar, sourceAccountId, baseFollowing, poolAccounts, sharedCharacters, nameMatch, parseRelations, relationFor, profileName }) as FollowCharacter[];
  }
  function applyRelationshipAutoFollowsToAccounts(accountList: AccountWithCharacter[]): AccountWithCharacter[] {
    return applyRelationshipAutoFollowsToAccountsUtil({ accountList, sharedCharacters, nameMatch, parseRelations, relationFor, profileName }) as AccountWithCharacter[];
  }
  async function toggleFollow(poolChar: FollowCharacter): Promise<void> {
    const already = following.some((item) => item.id === poolChar.id);
    const nextFollowing = already ? following.filter((item) => item.id !== poolChar.id) : [...following, followedCharacterFromPool(poolChar)];
    setFollowing(nextFollowing);
    setPosts((items) => nextPostsForFollowToggle(items, poolChar, already));
    syncActiveSharedCharacter(nextFollowing);
    syncOwnFollowRows(nextFollowing);
    const followSaved = await recordFollowChange(poolChar, already);
    if (!already) applyFollowBackSeed({ char, followSaved, poolChar, recordRelationshipFollowBack, relationBaseFor, setAffinity, verifyMutualLove });
  }
  return { applyRelationshipAutoFollowsToAccounts, relationAutoFollowsFor, toggleFollow, verifyMutualLove };
}

function isLoveLabel(label: string): boolean {
  return /연인|애인|연애|사랑|부부|배우자|약혼|반려/.test(label || "");
}

function followedCharacterFromPool(poolChar: FollowCharacter): FollowCharacter {
  return { ...poolChar, corrections: [], directions: "", relations: poolChar.relations || "", external: true };
}

function nextPostsForFollowToggle(posts: FeedPost[], poolChar: FollowCharacter, already: boolean): FeedPost[] {
  if (!already) return mergeTimelinePosts(posts, postsFromFollowedCharacter(poolChar));
  return posts.filter((post) => !(post.importedFromFollow && ((poolChar.sharedId && post.authorSharedId === poolChar.sharedId) || post.author === poolChar.name)));
}

function applyFollowBackSeed(options: {
  char: FollowCharacter;
  followSaved: unknown;
  poolChar: FollowCharacter;
  recordRelationshipFollowBack: (poolChar: FollowCharacter) => Promise<unknown>;
  relationBaseFor: (from: string, to: string) => number | null | undefined;
  setAffinity: SetState<Record<string, number>>;
  verifyMutualLove: (myChar: FollowCharacter, otherChar: FollowCharacter) => { mutual: boolean; theirLoves: boolean };
}): void {
  const { char, followSaved, poolChar, recordRelationshipFollowBack, relationBaseFor, setAffinity, verifyMutualLove } = options;
  const { mutual, theirLoves } = verifyMutualLove(char, poolChar);
  if (theirLoves) {
    const seed = relationBaseFor(poolChar.name, char.name);
    setAffinity((prev) => ({ ...prev, [dirKey(poolChar.name, char.name)]: seed == null ? 100 : seed }));
  }
  if (followSaved && mutual) recordRelationshipFollowBack(poolChar);
}
