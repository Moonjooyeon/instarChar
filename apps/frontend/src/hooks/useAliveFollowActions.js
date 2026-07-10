import {
  mergeTimelinePosts,
  postsFromFollowedCharacter,
} from "@/domain/feed/feedUtils";
import {
  applyRelationshipAutoFollowsToAccounts as applyRelationshipAutoFollowsToAccountsUtil,
  relationAutoFollowsFor as relationAutoFollowsForUtil,
} from "@/domain/relationships/relationshipFollowUtils";
import { dirKey, nameMatch } from "@/domain/relationships/affinityUtils";
import { parseRelations } from "@/domain/app/aliveCore";

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
}) {
  function verifyMutualLove(myChar, otherChar) {
    const myHit = relationFor(myChar, otherChar, true);
    const theirHit = relationFor(otherChar, myChar, true);
    const myLabel = myHit?.label || "";
    const theirLabel = theirHit?.label || "";
    return { mutual: isLoveLabel(myLabel) && isLoveLabel(theirLabel), theirLoves: isLoveLabel(theirLabel) };
  }
  function relationAutoFollowsFor(sourceChar, sourceAccountId = "", baseFollowing = [], poolAccounts = accounts) {
    return relationAutoFollowsForUtil({ sourceChar, sourceAccountId, baseFollowing, poolAccounts, sharedCharacters, nameMatch, parseRelations, relationFor, profileName });
  }
  function applyRelationshipAutoFollowsToAccounts(accountList) {
    return applyRelationshipAutoFollowsToAccountsUtil({ accountList, sharedCharacters, nameMatch, parseRelations, relationFor, profileName });
  }
  async function toggleFollow(poolChar) {
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

function isLoveLabel(label) {
  return /연인|애인|연애|사랑|부부|배우자|약혼|반려/.test(label || "");
}

function followedCharacterFromPool(poolChar) {
  return { ...poolChar, corrections: [], directions: "", relations: poolChar.relations || "", external: true };
}

function nextPostsForFollowToggle(posts, poolChar, already) {
  if (!already) return mergeTimelinePosts(posts, postsFromFollowedCharacter(poolChar));
  return posts.filter((post) => !(post.importedFromFollow && ((poolChar.sharedId && post.authorSharedId === poolChar.sharedId) || post.author === poolChar.name)));
}

function applyFollowBackSeed({ char, followSaved, poolChar, recordRelationshipFollowBack, relationBaseFor, setAffinity, verifyMutualLove }) {
  const { mutual, theirLoves } = verifyMutualLove(char, poolChar);
  if (theirLoves) {
    const seed = relationBaseFor(poolChar.name, char.name);
    setAffinity((prev) => ({ ...prev, [dirKey(poolChar.name, char.name)]: seed == null ? 100 : seed }));
  }
  if (followSaved && mutual) recordRelationshipFollowBack(poolChar);
}
