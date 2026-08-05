import React from "react";
import { AppModals } from "@/app/AppModals";
import { AuthRoutes } from "@/app/AuthRoutes";
import { ExploreDmRoutes } from "@/app/ExploreDmRoutes";
import { FeedRoute } from "@/app/FeedRoute";
import { SetupRoutes } from "@/app/SetupRoutes";
import type { useAliveAppController } from "@/hooks/useAliveAppController";

interface AppViewProps {
  ctx: ReturnType<typeof useAliveAppController>;
}

export function AppView({ ctx }: AppViewProps) {
  return (
    <div className="al-root">
      <AuthRoutes ctx={ctx} />
      <SetupRoutes ctx={ctx} />
      <FeedRoute ctx={ctx} />
      <ExploreDmRoutes ctx={ctx} />
      <AppModals ctx={ctx} />
      <p className="al-footer">ALIVE · prototype</p>
    </div>
  );
}
