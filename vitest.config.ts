import { defineConfig } from "vitest/config";

// The simulation is plain integer TypeScript with no DOM and no timers, so the whole
// combat, rollback and input suite runs in the default node environment. Renderer and
// lab code is deliberately excluded from the simulation suites: nothing under
// src/renderer or src/lab may ever be needed to decide what the game does.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
