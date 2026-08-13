import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "ashwoodfriends-alive",
  brand: {
    displayName: "얼라이브",
    primaryColor: "#a66cff",
    icon: "https://alive.imagebgremover.net/brand-icon.png",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build --mode toss",
    },
  },
  permissions: [],
  outdir: "dist",
});
