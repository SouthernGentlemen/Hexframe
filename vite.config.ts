import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Two built pages, both plain HTML + TypeScript: the public landing page and the unified
// game client. The lab-named build path is an internal asset location retained so old
// deploys and hashed asset routing remain compatible; the product routes are /play and
// /training.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        lab: fileURLToPath(new URL("./lab/index.html", import.meta.url)),
      },
      output: {
        // Keep the historical build location stable while the Worker exposes the same
        // hashed game assets under both /play/assets and /training/assets.
        entryFileNames: (chunk) =>
          chunk.name === "lab" ? "lab/assets/[name]-[hash].js" : "assets/[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.names.some((name) => name.startsWith("lab"))
            ? "lab/assets/[name]-[hash][extname]"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
  // Assets are served through the Worker's ASSETS binding out of dist/; there is no
  // separate publicDir to keep in sync.
  publicDir: false,
});
