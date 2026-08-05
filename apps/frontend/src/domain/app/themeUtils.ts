export const THEME_STORAGE_KEY = "alive-theme";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

const THEME_COLORS: Readonly<Record<ResolvedTheme, string>> = {
  light: "#fbfaf7",
  dark: "#15131a",
};

export function readThemePreference(storage: Pick<Storage, "getItem">): ThemePreference {
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(preference: ThemePreference, isSystemDark: boolean): ResolvedTheme {
  if (preference !== "system") return preference;
  return isSystemDark ? "dark" : "light";
}

export function persistThemePreference(storage: Pick<Storage, "removeItem" | "setItem">, preference: ThemePreference): void {
  try {
    if (preference === "system") {
      storage.removeItem(THEME_STORAGE_KEY);
      return;
    }
    storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    return;
  }
}

export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function readSystemTheme(media: Pick<MediaQueryList, "matches"> = window.matchMedia("(prefers-color-scheme: dark)")): boolean {
  return media.matches;
}

export function initializeTheme(): void {
  const preference = readThemePreference(window.localStorage);
  applyTheme(resolveTheme(preference, readSystemTheme()));
}
