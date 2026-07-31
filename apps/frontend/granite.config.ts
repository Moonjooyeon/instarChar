import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "ashwoodfriends-alive",
  brand: {
    displayName: "ALIVE",
    primaryColor: "#a66cff",
    icon: "",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
