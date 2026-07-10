export function canonicalDmKey(a, b) {
  return `dm::${participantPair(a, b)}`;
}

export function makeLocalDmRoomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function scopedLocalDmKey(scopeId, a, b, roomId = "") {
  const pair = participantPair(a, b);
  return roomId ? `local::${scopeId || "new"}::${roomId}::${pair}` : `local::${scopeId || "new"}::${pair}`;
}

export function localRoomIdFromDmThreadKey(key) {
  if (!key.startsWith("local::")) return "";
  const parts = key.split("::");
  return parts.length >= 4 ? parts[2] : "";
}

export function roomKeyFromDmThreadKey(key) {
  if (key.startsWith("dm::")) return key.slice("dm::".length);
  if (key.includes("::")) return key.split("::").slice(-1)[0] || "";
  return key;
}

function participantPair(a, b) {
  return [a || "나", b || "나"].map((value) => String(value).trim() || "나").sort().join("|");
}
