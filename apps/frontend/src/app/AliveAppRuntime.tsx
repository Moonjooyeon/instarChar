import React from "react";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@/styles/index.css";
import { AppView } from "@/app/AppView";
import { useAliveAppController } from "@/hooks/useAliveAppController";

function AliveAppRuntime(): React.ReactElement {
  const appViewCtx = useAliveAppController();
  return <AppView ctx={appViewCtx} />;
}

export default AliveAppRuntime;
