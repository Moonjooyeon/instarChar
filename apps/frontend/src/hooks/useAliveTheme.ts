import { useEffect, useState } from "react";
import {
  applyTheme,
  persistThemePreference,
  readSystemTheme,
  readThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/domain/app/themeUtils";

export interface ThemeController {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export function useAliveTheme(): ThemeController {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readThemePreference(window.localStorage));
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() => readSystemTheme());
  const resolvedTheme = resolveTheme(preference, isSystemDark);
  useEffect(() => subscribeToSystemTheme(setIsSystemDark), []);
  useEffect(() => applyTheme(resolvedTheme), [resolvedTheme]);
  function setPreference(value: ThemePreference): void {
    persistThemePreference(window.localStorage, value);
    setPreferenceState(value);
  }
  return { preference, resolvedTheme, setPreference };
}

function subscribeToSystemTheme(setIsSystemDark: (value: boolean) => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (event: MediaQueryListEvent): void => setIsSystemDark(event.matches);
  media.addEventListener("change", handleChange);
  return () => media.removeEventListener("change", handleChange);
}
