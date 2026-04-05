import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const brainOrigin = env.VITE_INSIGHTOS_API_URL || "http://127.0.0.1:8787";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@nexus/collector-sdk": path.resolve(__dirname, "../collector-sdk/src/index.js"),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      fs: {
        allow: [__dirname, path.resolve(__dirname, "..")],
      },
      proxy: {
        "/api": {
          target: brainOrigin,
          changeOrigin: true,
        },
      },
    },
  };
});
