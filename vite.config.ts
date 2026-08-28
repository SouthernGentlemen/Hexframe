import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Two built pages, both plain HTML + TypeScript: the public shell and the combat client.
// The Worker serves the combat client as a restricted public playtest at `/play/` and as
// an authenticated operator laboratory at `/lab/`. Nothing secret is built into it.
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
        // Keep lab-owned entry assets under /lab so the Worker's session gate sees them.
        // Shared runtime chunks contain no lab UI or authored model data and may remain
        // public alongside the shell.
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
