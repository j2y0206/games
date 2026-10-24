import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 8081
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    target: "safari15",
    sourcemap: false,
    chunkSizeWarningLimit: 1400
  }
});
