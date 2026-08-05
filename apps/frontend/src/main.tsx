import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor, SystemBars, SystemBarType } from "@capacitor/core";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@/styles/index.css";
import App from "@/App";
import { initializeTheme } from "@/domain/app/themeUtils";

async function hideAndroidNavigationBar(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  await SystemBars.hide({ bar: SystemBarType.NavigationBar });
}

void hideAndroidNavigationBar();
initializeTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
