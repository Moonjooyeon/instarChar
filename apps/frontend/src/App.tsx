import React, { Suspense, lazy } from "react";
import { AppLaunchScreen } from "@/features/auth/AppLaunchScreen";

const AliveAppRuntime = lazy(() => import("@/app/AliveAppRuntime"));

function App(): React.ReactElement {
  return <Suspense fallback={<AppLaunchScreen />}><AliveAppRuntime /></Suspense>;
}

export default App;
