import assert from "node:assert/strict";
import test from "node:test";
import {
  followerCharacterId,
  hydrateFollowedCharacters,
  characterRowToDiscoverChar,
  sameDiscoverCharacter,
} from "../../src/domain/discover/discoverUtils.js";

test("sameDiscoverCharacter matches alternate rows for the same owned character", () => {
  const discovered = { id: "char_owner_account", ownerId: "owner", sourceAccountId: "account" };
  const follower = { id: "follower_row", ownerId: "owner", sourceAccountId: "account" };
  assert.equal(sameDiscoverCharacter(discovered, follower), true);
});

test("sameDiscoverCharacter keeps different source accounts distinct", () => {
  const first = { id: "same", ownerId: "owner", sourceAccountId: "account-a" };
  const second = { id: "same", ownerId: "owner", sourceAccountId: "account-b" };
  assert.equal(sameDiscoverCharacter(first, second), false);
});

test("followerCharacterId does not duplicate the follower prefix", () => {
  assert.equal(followerCharacterId("follower_row"), "follower_row");
  assert.equal(followerCharacterId("row"), "follower_row");
});

test("hydrateFollowedCharacters adds authoritative posts to stored follows", () => {
  const following = [{ id: "stored", ownerId: "owner", sourceAccountId: "account", name: "세라", posts: [] }];
  const discovered = [{ id: "fresh", ownerId: "owner", sourceAccountId: "account", name: "세라", posts: [{ id: "post-1", text: "최신 글" }] }];
  const hydrated = hydrateFollowedCharacters(following, discovered);
  assert.deepEqual(hydrated[0].posts, [{ id: "post-1", text: "최신 글" }]);
  assert.equal(hydrated[0].id, "stored");
});

test("character discovery exposes the persistent character id", () => {
  const discovered = characterRowToDiscoverChar({ character_id: "character-1", owner_id: "owner", source_account_id: "account", name: "세라" });
  assert.equal(discovered.characterId, "character-1");
});
