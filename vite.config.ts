import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Three built pages: the legacy/public landing shell, the unified game/lab client, and
// the authenticated developer Move Codex. Product routing remains a Worker concern.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        lab: fileURLToPath(new URL("./lab/index.html", import.meta.url)),
        codex: fileURLToPath(new URL("./codex/index.html", import.meta.url)),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "lab") return "lab/assets/[name]-[hash].js";
          if (chunk.name === "codex") return "codex/assets/[name]-[hash].js";
          return "assets/[name]-[hash].js";
        },
        assetFileNames: (asset) => {
          if (asset.names.some((name) => name.startsWith("codex"))) {
            return "codex/assets/[name]-[hash][extname]";
          }
          if (asset.names.some((name) => name.startsWith("lab"))) {
            return "lab/assets/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  publicDir: false,
});
