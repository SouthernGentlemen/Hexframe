import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Two pages, both plain HTML + TypeScript: the public shell at `/` and the combat
// laboratory at `/lab/`. The laboratory is gated by the Worker, not by the bundler —
// `dist/lab/index.html` is an ordinary static asset that the Worker refuses to hand
// out without a valid session cookie. Nothing secret is ever built into it.
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
