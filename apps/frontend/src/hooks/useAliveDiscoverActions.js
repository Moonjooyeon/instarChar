export function useAliveDiscoverActions({
  publicPostSnapshot,
  recordFollowChangeFromDiscover,
  recordRelationshipFollowBackFromDiscover,
  shareCurrentCharacterFromDiscover,
  syncActiveSharedCharacterFromDiscover,
  syncOwnFollowRowsFromDiscover,
}) {
  async function shareCurrentCharacter() {
    return shareCurrentCharacterFromDiscover(publicPostSnapshot);
  }
  async function syncActiveSharedCharacter(nextFollowing, nextChar) {
    return syncActiveSharedCharacterFromDiscover(publicPostSnapshot, nextFollowing, nextChar);
  }
  async function syncOwnFollowRows(nextFollowing, nextChar) {
    return syncOwnFollowRowsFromDiscover(publicPostSnapshot, nextFollowing, nextChar);
  }
  async function recordFollowChange(poolChar, wasFollowing) {
    return recordFollowChangeFromDiscover(poolChar, wasFollowing);
  }
  async function recordRelationshipFollowBack(poolChar) {
    return recordRelationshipFollowBackFromDiscover(poolChar);
  }
  return { recordFollowChange, recordRelationshipFollowBack, shareCurrentCharacter, syncActiveSharedCharacter, syncOwnFollowRows };
}
