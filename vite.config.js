import { defineConfig } from "vite";

// base: "./" makes the production build use relative asset paths, so dist/
// works from any subpath (e.g. a GitHub Pages project site), not just the
// domain root.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
  },
});
