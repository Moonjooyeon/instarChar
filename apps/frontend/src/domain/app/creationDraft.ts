export interface CreationDraftSections {
  identity: string;
  personality: string;
}

const IDENTITY_SECTION = "[기본 정보]";
const PERSONALITY_SECTION = "[성격]";
const STRUCTURED_DRAFT_PATTERN = /^\[기본 정보\]\n([\s\S]*?)\n\n\[성격\]\n([\s\S]*)$/;

export function splitCreationDump(value: string): CreationDraftSections {
  const match = value.match(STRUCTURED_DRAFT_PATTERN);
  if (!match) return { identity: value, personality: "" };
  return { identity: match[1], personality: match[2] };
}

export function joinCreationDump(identity: string, personality: string): string {
  if (!personality.trim()) return identity;
  return `${IDENTITY_SECTION}\n${identity}\n\n${PERSONALITY_SECTION}\n${personality}`;
}
