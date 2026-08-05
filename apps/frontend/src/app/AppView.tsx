import React from "react";
import { AppModals } from "@/app/AppModals";
import { AuthRoutes } from "@/app/AuthRoutes";
import { ExploreDmRoutes } from "@/app/ExploreDmRoutes";
import { FeedRoute } from "@/app/FeedRoute";
import { SetupRoutes } from "@/app/SetupRoutes";
import type { useAliveAppController } from "@/hooks/useAliveAppController";
import type { ThemeController } from "@/hooks/useAliveTheme";

interface AppViewProps {
  ctx: ReturnType<typeof useAliveAppController>;
  theme: ThemeController;
}

export function AppView({ ctx, theme }: AppViewProps) {
  return (
    <div className="al-root">
      <AuthRoutes ctx={ctx} theme={theme} />
      <SetupRoutes ctx={ctx} theme={theme} />
      <FeedRoute ctx={ctx} />
      <ExploreDmRoutes ctx={ctx} />
      <AppModals ctx={ctx} />
      <p className="al-footer">ALIVE · prototype</p>
    </div>
  );
}
