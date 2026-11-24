import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      // The backend (auth + APIs) is served on this same origin at /api, so
      // session cookies are first-party. Production does the same with a Vercel rewrite.
      proxy: {
        "/api": {
          target: env.VITE_DEV_API_TARGET || "http://localhost:8000",
          changeOrigin: false,
        },
      },
      fs: {
        // The budget and route-optimizer code is shared with the backend
        // (backend/functions/_shared), which sits outside this folder.
        allow: [path.resolve(__dirname, "..")],
      },
    },
  };
});
