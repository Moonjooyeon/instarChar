import { LOCAL_STATE_KEY } from "./aliveCore.js";

const MIGRATION_MARKER_KEY = "alive_origin_storage_migrated_v3_1_1";
const MIGRATION_TIMEOUT_MS = 5000;
const MIGRATED_STORAGE_KEYS = new Set([LOCAL_STATE_KEY, "alive_toss_session"]);
const MIGRATED_STORAGE_PREFIXES = ["alive_feed_help_seen_v2:"];

type OriginLocalStorage = Record<string, string | null>;

export function missingAliveStorageEntries(previous: OriginLocalStorage, current: OriginLocalStorage): Array<[string, string]> {
  return Object.entries(previous).flatMap(([key, value]) => {
    if (value == null || current[key] != null || !isAliveStorageKey(key)) return [];
    return [[key, value]];
  });
}

export async function migrateTossOriginStorage(): Promise<void> {
  if (import.meta.env?.VITE_ALIVE_RUNTIME !== "apps-in-toss") return;
  try {
    if (localStorage.getItem(MIGRATION_MARKER_KEY) === "true") return;
    const { Migration } = await import("@apps-in-toss/web-framework");
    const { previous, current } = await withTimeout(Migration.getOriginStorage(), MIGRATION_TIMEOUT_MS);
    if (hasLocalStorageError(previous.errors) || hasLocalStorageError(current.errors)) throw new Error("localStorage 조회 실패");
    missingAliveStorageEntries(previous.localStorage, current.localStorage).forEach(([key, value]) => localStorage.setItem(key, value));
    localStorage.setItem(MIGRATION_MARKER_KEY, "true");
  } catch (error) {
    console.warn("앱인토스 Origin 저장소 마이그레이션 실패:", error);
  }
}

function isAliveStorageKey(key: string): boolean {
  return MIGRATED_STORAGE_KEYS.has(key) || MIGRATED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function hasLocalStorageError(errors: Array<{ storage: string }>): boolean {
  return errors.some(({ storage }) => storage === "localStorage");
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Origin 저장소 조회 시간 초과")), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
