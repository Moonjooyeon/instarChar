import React from "react";
import { DiscoverRoute } from "@/app/dm/DiscoverRoute";
import { DmListRoute } from "@/app/dm/DmListRoute";
import { DmThreadRoute } from "@/app/dm/DmThreadRoute";

export function ExploreDmRoutes({ ctx }) {
  const { canUseApp, peer, step } = ctx;
  return (
    <>
      {canUseApp && step === "discover" && <DiscoverRoute ctx={ctx} />}
      {canUseApp && step === "dmlist" && <DmListRoute ctx={ctx} />}
      {canUseApp && step === "dm" && peer && <DmThreadRoute ctx={ctx} />}
    </>
  );
}
