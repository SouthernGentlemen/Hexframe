import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// One page for now: the public shell at `/`. The training laboratory is a second build
// input and arrives with the harness that needs it, so that this configuration always
// describes pages that actually exist.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  // Assets are served through the Worker's ASSETS binding out of dist/; there is no
  // separate publicDir to keep in sync.
  publicDir: false,
});
