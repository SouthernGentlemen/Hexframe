import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../src/client/front-app.ts", import.meta.url), "utf8");
const rootHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const labHtml = readFileSync(new URL("../../lab/index.html", import.meta.url), "utf8");

describe("public Hexframe surface", () => {
  it("uses a project overview at the root and training at play", () => {
    expect(source).toContain('if (path === "/") return overviewMarkup()');
    expect(source).toContain('path === "/play/" || path === "/training/"');
    expect(source).toContain('return shell(trainingMarkup(), "Training")');
    expect(source).toContain("Browser fighting-game lab");
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
    expect(training).toContain('data-tutorial="true">Start tutorial');
    expect(training).toContain('data-launch-training="true">Free practice');
    expect(training).toContain("One stage. One dummy. Every frame.");
    expect(training).not.toContain("LOADOUT");
    expect(training).not.toContain("pick-slot");
  });

  it("uses the real training renderer on the refreshed overview", () => {
    const overview = source.match(/function overviewMarkup[\s\S]*?\n}/)?.[0] ?? "";
    expect(overview).toContain("Practice the hit.");
    expect(overview).toContain("data-training-stage");
    expect(overview).toContain("Pause on contact");
  });

  it("does not paint fallback copy before either JavaScript app mounts", () => {
    expect(rootHtml).toContain('<div id="app" aria-busy="true"></div>');
    expect(labHtml).toContain('<div id="lab" aria-busy="true"></div>');
    expect(rootHtml).toContain("<noscript>");
    expect(labHtml).toContain("<noscript>");
  });
});
