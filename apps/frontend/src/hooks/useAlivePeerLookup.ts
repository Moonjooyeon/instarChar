import { nameMatch } from "@/domain/relationships/affinityUtils";

type CharacterPeer = {
  asOwner?: boolean;
  char?: CharacterPeer;
  name?: string;
};

type PeerLookupOptions = {
  accounts: CharacterPeer[];
  char: CharacterPeer | null;
  following: CharacterPeer[];
  peer: CharacterPeer | null;
  sharedCharacters: CharacterPeer[];
};

export function useAlivePeerLookup({ accounts, char, following, peer, sharedCharacters }: PeerLookupOptions): {
  findPeerChar: (name: string) => CharacterPeer | null;
} {
  function findPeerChar(name: string): CharacterPeer | null {
    if (char?.name && nameMatch(char.name, name)) return char;
    const account = accounts.find((item) => item.char?.name && nameMatch(item.char.name, name));
    if (account) return account.char;
    const followed = following.find((item) => item.name && nameMatch(item.name, name));
    if (followed) return followed;
    const shared = sharedCharacters.find((item) => item.name && nameMatch(item.name, name));
    if (shared) return shared;
    if (peer && !peer.asOwner && nameMatch(peer.name, name)) return peer;
    return null;
  }
  return { findPeerChar };
}
