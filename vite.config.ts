import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8010",
        changeOrigin: true,
      },
      "/tally": {
        target: "http://localhost:9000",
        changeOrigin: true,
        rewrite: () => "",
      },
    },
  },
});
