import { nameMatch } from "@/domain/relationships/affinityUtils";

export function useAlivePeerLookup({ accounts, char, following, peer, sharedCharacters }) {
  function findPeerChar(name) {
    if (char?.name && nameMatch(char.name, name)) return char;
    const account = accounts.find((item) => nameMatch(item.char.name, name));
    if (account) return account.char;
    const followed = following.find((item) => nameMatch(item.name, name));
    if (followed) return followed;
    const shared = sharedCharacters.find((item) => nameMatch(item.name, name));
    if (shared) return shared;
    if (peer && !peer.asOwner && nameMatch(peer.name, name)) return peer;
    return null;
  }
  return { findPeerChar };
}
