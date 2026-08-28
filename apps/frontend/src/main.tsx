import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { initializeTheme } from "@/domain/app/themeUtils";
import { migrateTossOriginStorage } from "@/domain/app/tossOriginStorageMigration";

async function hideAndroidNavigationBar(): Promise<void> {
  const { Capacitor, SystemBars, SystemBarType } = await import("@capacitor/core");
  if (Capacitor.getPlatform() !== "android") return;
  await SystemBars.hide({ bar: SystemBarType.NavigationBar });
}

void hideAndroidNavigationBar();

async function startApp(): Promise<void> {
  await migrateTossOriginStorage();
  initializeTheme();
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void startApp();
