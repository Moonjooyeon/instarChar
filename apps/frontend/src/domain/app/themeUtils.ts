export const THEME_STORAGE_KEY = "alive-theme";

export type ResolvedTheme = "light" | "dark";

const THEME_COLORS: Readonly<Record<ResolvedTheme, string>> = {
  light: "#fbfaf7",
  dark: "#15131a",
};

export function clearThemePreference(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(THEME_STORAGE_KEY);
  } catch {
    return;
  }
}

export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function initializeTheme(): void {
  clearThemePreference(window.localStorage);
  applyTheme("dark");
}
