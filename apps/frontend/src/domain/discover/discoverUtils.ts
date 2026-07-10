type CharacterData = {
  name?: string;
  handle?: string;
  persona?: string;
  tags?: unknown[];
  posts?: unknown[];
  following?: unknown[];
  gallery?: unknown[];
  ownerName?: string;
  age?: string;
  surface?: string;
  interests?: string;
  [key: string]: unknown;
};

type SharedCharacterRow = {
  id?: string;
  owner_id?: string;
  owner_name?: string;
  source_account_id?: string;
  name?: string;
  handle?: string;
  persona?: string;
  tags?: unknown[];
  character?: CharacterData;
};

type CharacterRow = SharedCharacterRow & {
  posts?: unknown[];
  following?: unknown[];
  gallery?: unknown[];
};

type DiscoverCharacter = CharacterData & {
  id: string;
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
  posts: unknown[];
};

export function sharedRowToChar(row: SharedCharacterRow): DiscoverCharacter {
  const base = row.character || {};
  return {
    ...base,
    id: `shared_${row.id}`,
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
