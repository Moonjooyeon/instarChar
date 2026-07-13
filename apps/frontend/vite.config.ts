import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = new URL("../..", import.meta.url).pathname;
const srcRoot = new URL("./src", import.meta.url).pathname;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  Object.entries(env).forEach(([key, value]) => {
    if (!(key in process.env)) process.env[key] = value;
  });

  return {
    envDir: repoRoot,
    define: {
      __ALIVE_BUILD__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.VITE_ALIVE_BUILD || "local"),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": srcRoot,
      },
    },
    server: {
      watch: {
        ignored: ["**/.gradle/**", "../../android/**/build/**"],
      },
    },
  };
});
