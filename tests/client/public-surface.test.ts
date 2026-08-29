import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../src/client/front-app.ts", import.meta.url), "utf8");

describe("public Hexframe surface", () => {
  it("uses a project overview at the root and training at play", () => {
    expect(source).toContain('if (path === "/") return overviewMarkup()');
    expect(source).toContain('if (path === "/play/") return shell(trainingMarkup(state), "Training")');
    expect(source).toContain("Deterministic fighting-game systems");
  });

  it("keeps the public navigation focused on overview and training", () => {
    const shell = source.match(/function shell[\s\S]*?\n}/)?.[0] ?? "";
    expect(shell).toContain('href="/">OVERVIEW');
    expect(shell).toContain('href="/play/" aria-current="page">TRAINING');
    expect(shell).not.toContain("CAMPAIGN");
    expect(shell).not.toContain("LOADOUTS");
    expect(shell).not.toContain("CODEX");
  });

  it("makes the tutorial the primary training action", () => {
    const training = source.match(/function trainingMarkup[\s\S]*?\n}/)?.[0] ?? "";
    expect(training).toContain('data-tutorial="true" autofocus>Start tutorial');
    expect(training).toContain('data-launch="training">Free practice');
  });
});
