export const USER_PERSONA_FEATURE_ENABLED = false;

export function normalizeUserPersonaSpeaker(value: unknown, fallback = "char"): string {
  const speaker = typeof value === "string" && value ? value : fallback;
  if (!USER_PERSONA_FEATURE_ENABLED && speaker.startsWith("p:")) return fallback;
  return speaker;
}
