import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import generateHandler from "./api/generate.js";

function localApiPlugin() {
  return {
    name: "alive-local-api",
    configureServer(server) {
      server.middlewares.use("/api/generate", async (req, res) => {
        let raw = "";
        req.on("data", (chunk) => {
          raw += chunk;
        });

        await new Promise((resolve, reject) => {
          req.on("end", resolve);
          req.on("error", reject);
        });

        try {
          req.body = raw ? JSON.parse(raw) : {};
        } catch (e) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "BAD_JSON", message: String(e) }));
          return;
        }

        const jsonRes = {
          status(code) {
            res.statusCode = code;
            return this;
          },
          json(body) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(body));
            return this;
          },
        };

        try {
          await generateHandler(req, jsonRes);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "LOCAL_API_CRASH", message: String(e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.entries(env).forEach(([key, value]) => {
    if (!(key in process.env)) process.env[key] = value;
  });

  return {
    define: {
      __ALIVE_BUILD__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.VITE_ALIVE_BUILD || "local"),
    },
    plugins: [localApiPlugin(), react()],
    server: {
      watch: {
        ignored: ["**/.gradle/**", "**/android/**/build/**"],
      },
    },
  };
});
