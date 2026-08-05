import React from "react";
import { AppView } from "@/app/AppView";
import { useAliveAppController } from "@/hooks/useAliveAppController";
import { useAliveTheme } from "@/hooks/useAliveTheme";

function App() {
  const appViewCtx = useAliveAppController();
  const theme = useAliveTheme();
  return <AppView ctx={appViewCtx} theme={theme} />;
}

export default App;
