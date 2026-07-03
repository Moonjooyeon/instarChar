import React from "react";
import { AppView } from "@/app/AppView";
import { useAliveAppController } from "@/hooks/useAliveAppController.jsx";

function App() {
  const appViewCtx = useAliveAppController();
  return <AppView ctx={appViewCtx} />;
}

export default App;
