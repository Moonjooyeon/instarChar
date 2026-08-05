import type { ReactElement } from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import type { ThemeController } from "@/hooks/useAliveTheme";

export function ThemeToggle({ resolvedTheme, setPreference }: ThemeController): ReactElement {
  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";
  return <button aria-label={label} className="grid size-[34px] place-items-center rounded-full border border-line bg-surface-raised p-0 text-accent-ink transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setPreference(nextTheme)} title={label} type="button"><AliveIcon name={isDark ? "sun" : "moon"} size={15} /></button>;
}
