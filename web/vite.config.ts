import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
const backend = process.env.VITE_BACKEND_URL || "http://localhost:4000"; // configurable in dev

// Custom plugin to strip the eval usage in protobufjs's minimal build (inquire helper)
// to silence Vite's eval warning while keeping module behavior (returns null for optional deps).
function stripProtobufEval() {
  return {
    name: "strip-protobuf-eval",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (id.includes("protobufjs/dist/minimal/protobuf.js")) {
        const before = code;
        const replaced = code.replace(
          'var mod = eval("quire".replace(/^/,"re"))(moduleName); // eslint-disable-line no-eval',
          'var mod = null; // stripped eval (dynamic require) for bundler safety'
        );
        if (before !== replaced) {
          return { code: replaced, map: null };
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), stripProtobufEval(), visualizer({ filename: "dist/stats.html", brotliSize: true, gzipSize: true })],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      // "/cesium": { target: backend, changeOrigin: true }, // retained until asset requests verified
      // Optional: surface metrics locally (comment out if not needed)
      "/metrics": { target: backend, changeOrigin: true },
    },
  },
  resolve: {
    alias: {
  // (intentionally empty) – earlier attempt to alias protobufjs to its minimal
  // runtime caused path rewriting issues (Cesium already imports
  // "protobufjs/dist/minimal/protobuf.js" directly). Leaving this empty avoids
  // build failures like: protobufjs/minimal.js/dist/minimal/protobuf.js ENOENT.
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
