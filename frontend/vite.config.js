import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    fs: {
      // The budget and route-optimizer code is shared with the backend
      // (backend/supabase/functions/_shared), which sits outside this folder.
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
