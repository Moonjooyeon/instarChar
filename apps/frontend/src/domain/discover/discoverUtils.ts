export type CharacterData = {
  name?: string;
  handle?: string;
  persona?: string;
  tags?: unknown[];
  posts?: Record<string, unknown>[];
  following?: Record<string, unknown>[];
  gallery?: unknown[];
  ownerName?: string;
  age?: string;
  surface?: string;
  interests?: string;
  [key: string]: unknown;
};

export type SharedCharacterRow = {
  id?: string;
  character_id?: string;
  owner_id?: string;
  owner_name?: string;
  source_account_id?: string;
  name?: string;
  handle?: string;
  persona?: string;
  tags?: unknown[];
  character?: CharacterData;
};

export type CharacterRow = SharedCharacterRow & {
  posts?: Record<string, unknown>[];
  following?: Record<string, unknown>[];
  gallery?: unknown[];
};

export type DiscoverCharacter = CharacterData & {
  id: string;
  characterId: string;
  sharedId: string;
  ownerId?: string;
  sourceAccountId?: string;
  owner: string;
  ownerName: string;
  external: boolean;
  shared: boolean;
  name: string;
  handle: string;
  persona: string;
  tags: unknown[];
  posts: Record<string, unknown>[];
};

type CharacterIdentity = {
  id?: string;
  ownerId?: string;
  sharedId?: string;
  sourceAccountId?: string;
};

export function sameDiscoverCharacter(left: CharacterIdentity | null | undefined, right: CharacterIdentity | null | undefined): boolean {
  if (!left || !right) return false;
  if (left.ownerId && left.sourceAccountId && right.ownerId && right.sourceAccountId) {
    return left.ownerId === right.ownerId && left.sourceAccountId === right.sourceAccountId;
  }
  if (left.sharedId && right.sharedId) return left.sharedId === right.sharedId;
  return Boolean(left.id && right.id && left.id === right.id);
}

export function followerCharacterId(id = ""): string {
  if (!id) return "follower_unknown";
  return id.startsWith("follower_") ? id : `follower_${id}`;
}

export function hydrateFollowedCharacters(following: DiscoverCharacter[] = [], available: DiscoverCharacter[] = []): DiscoverCharacter[] {
  return following.map((stored) => {
    const fresh = available.find((item) => sameDiscoverCharacter(item, stored));
    if (!fresh) return stored;
    return { ...fresh, ...stored, posts: fresh.posts };
  });
}

export function sharedRowToChar(row: SharedCharacterRow): DiscoverCharacter {
  const base = row.character || {};
  return {
    ...base,
    id: `shared_${row.id}`,
    characterId: row.character_id || "",
    sharedId: row.id,
    ownerId: row.owner_id,
    sourceAccountId: row.source_account_id,
    owner: `@${row.owner_name || "user"}`,
    ownerName: row.owner_name || "user",
    external: true,
    shared: true,
    name: row.name || base.name || "이름 없음",
    handle: row.handle || base.handle || "",
    persona: row.persona || base.persona || "",
    tags: row.tags || base.tags || [],
    posts: Array.isArray(base.posts) ? base.posts : [],
  };
}

export function characterRowToDiscoverChar(row: CharacterRow): DiscoverCharacter {
  const base = row.character || {};
  return {
    ...base,
    id: `char_${row.owner_id || "owner"}_${row.source_account_id || row.name || "unknown"}`,
    characterId: row.character_id || "",
    sharedId: "",
    ownerId: row.owner_id,
    sourceAccountId: row.source_account_id,
    owner: `@${row.owner_name || base.ownerName || "user"}`,
    ownerName: row.owner_name || base.ownerName || "user",
    external: true,
    shared: false,
    autoSynced: true,
    name: row.name || base.name || "이름 없음",
    handle: row.handle || base.handle || "",
    persona: base.persona || row.persona || "",
    tags: [base.age, base.surface, base.interests].filter(Boolean).slice(0, 6),
    posts: Array.isArray(row.posts) ? row.posts : (Array.isArray(base.posts) ? base.posts : []),
    following: Array.isArray(row.following) ? row.following : [],
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
  };
}

export function mergeDiscoverCharacters(sharedRows: SharedCharacterRow[] = [], characterRows: CharacterRow[] = []): DiscoverCharacter[] {
  const byOwnerSource = new Map<string, DiscoverCharacter>();
  characterRows.map(characterRowToDiscoverChar).forEach((item) => {
    byOwnerSource.set(`${item.ownerId || ""}:${item.sourceAccountId || item.id}`, item);
  });
  sharedRows.map(sharedRowToChar).forEach((item) => {
    byOwnerSource.set(`${item.ownerId || ""}:${item.sourceAccountId || item.id}`, item);
  });
  return [...byOwnerSource.values()];
}
