import { splitCreationDump } from "./creationDraft.js";
import { normalizeCharacterName, normalizeHandle } from "./textUtils.js";

export type AnalysisFallbackProfile = {
  age: string;
  handle: string;
  name: string;
  persona: string;
  speech: string;
};

export function analysisFallbackProfile(dump: string, rpLog: string, suffix: string): AnalysisFallbackProfile {
  const { identity, personality } = splitCreationDump(dump);
  const name = normalizeCharacterName(identity);
  const persona = personality.trim() || identity.trim() || "아직 소개를 적지 않은 새 캐릭터";
  return { age: ageFrom(identity), handle: fallbackHandle(name, suffix), name, persona, speech: rpLog.trim() };
}

function ageFrom(identity: string): string {
  return identity.match(/\d{1,3}\s*(?:세|살)/u)?.[0] || "";
}

function fallbackHandle(name: string, suffix: string): string {
  const safeSuffix = normalizeHandle(suffix).slice(0, 8) || "new";
  const base = normalizeHandle(name) || "character";
  return `${base.slice(0, 24 - safeSuffix.length - 1)}-${safeSuffix}`;
}
