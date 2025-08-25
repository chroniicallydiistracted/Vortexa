import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const backend = process.env.VITE_BACKEND_URL || "http://localhost:4000"; // configurable in dev

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/cesium": { target: backend, changeOrigin: true },
      // Optional: surface metrics locally (comment out if not needed)
      "/metrics": { target: backend, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ["cesium"],
        },
      },
    },
  },
});
