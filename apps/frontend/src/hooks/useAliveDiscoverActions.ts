type DiscoverActionsOptions = {
  publicPostSnapshot: unknown;
  recordFollowChangeFromDiscover: (poolChar: unknown, wasFollowing: boolean) => Promise<unknown>;
  recordRelationshipFollowBackFromDiscover: (poolChar: unknown) => Promise<unknown>;
  syncActiveSharedCharacterFromDiscover: (publicPostSnapshot: unknown, nextFollowing?: unknown, nextChar?: unknown) => Promise<unknown>;
  syncOwnFollowRowsFromDiscover: (publicPostSnapshot: unknown, nextFollowing?: unknown, nextChar?: unknown) => Promise<unknown>;
};

export function useAliveDiscoverActions({
  publicPostSnapshot,
  recordFollowChangeFromDiscover,
  recordRelationshipFollowBackFromDiscover,
  syncActiveSharedCharacterFromDiscover,
  syncOwnFollowRowsFromDiscover,
}: DiscoverActionsOptions): {
  recordFollowChange: (poolChar: unknown, wasFollowing: boolean) => Promise<unknown>;
  recordRelationshipFollowBack: (poolChar: unknown) => Promise<unknown>;
  syncActiveSharedCharacter: (nextFollowing?: unknown, nextChar?: unknown) => Promise<unknown>;
  syncOwnFollowRows: (nextFollowing?: unknown, nextChar?: unknown) => Promise<unknown>;
} {
  async function syncActiveSharedCharacter(nextFollowing?: unknown, nextChar?: unknown): Promise<unknown> {
    return syncActiveSharedCharacterFromDiscover(publicPostSnapshot, nextFollowing, nextChar);
  }
  async function syncOwnFollowRows(nextFollowing?: unknown, nextChar?: unknown): Promise<unknown> {
    return syncOwnFollowRowsFromDiscover(publicPostSnapshot, nextFollowing, nextChar);
  }
  async function recordFollowChange(poolChar: unknown, wasFollowing: boolean): Promise<unknown> {
    return recordFollowChangeFromDiscover(poolChar, wasFollowing);
  }
  async function recordRelationshipFollowBack(poolChar: unknown): Promise<unknown> {
    return recordRelationshipFollowBackFromDiscover(poolChar);
  }
  return { recordFollowChange, recordRelationshipFollowBack, syncActiveSharedCharacter, syncOwnFollowRows };
}
