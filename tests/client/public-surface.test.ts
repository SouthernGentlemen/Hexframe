import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../src/client/front-app.ts", import.meta.url), "utf8");
const frontCss = readFileSync(new URL("../../src/client/styles/front.css", import.meta.url), "utf8");
const labCss = readFileSync(new URL("../../src/client/styles/lab.css", import.meta.url), "utf8");
const labMain = readFileSync(new URL("../../src/client/lab-main.ts", import.meta.url), "utf8");
const rootHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const labHtml = readFileSync(new URL("../../lab/index.html", import.meta.url), "utf8");

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

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

  it("gates coarse-pointer visitors with the desktop-only support policy", () => {
    const notice = source.match(/export function desktopOnlyMarkup[\s\S]*?\n}/)?.[0] ?? "";
    expect(source).toContain('const DESKTOP_ONLY_QUERY = "(pointer: coarse), (max-width: 960px)"');
    expect(source).toContain("isUnsupportedMobileDevice()");
    expect(notice).toContain("Desktop only.");
    expect(notice).toContain("Mobile and tablet support is not planned.");
    expect(notice).toContain('role="note"');
    expect(labMain).toContain("if (isUnsupportedMobileDevice())");
    expect(frontCss).toContain(".desktop-only-gate");
  });

  it("uses the real training renderer on the refreshed overview", () => {
    const overview = source.match(/function overviewMarkup[\s\S]*?\n}/)?.[0] ?? "";
    expect(overview).toContain("Practice the hit.");
    expect(overview).toContain("data-training-stage");
    expect(overview).toContain("Pause on contact");
  });

  it("keeps compact footer and control labels above AA text contrast", () => {
    expect(frontCss).toMatch(/\.desktop-only-gate > footer \{[^}]*color: #758089;/);
    expect(frontCss).toMatch(/\.overview-footer \{[^}]*color: #758089;/);
    expect(labCss).toMatch(/\.control-legend \{[^}]*background: #0d1115; color: #758089;/);
    expect(contrastRatio("#758089", "#07090d")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#758089", "#0d1115")).toBeGreaterThanOrEqual(4.5);
  });

  it("does not paint fallback copy before either JavaScript app mounts", () => {
    expect(rootHtml).toContain('<div id="app" aria-busy="true"></div>');
    expect(labHtml).toContain('<div id="lab" aria-busy="true"></div>');
    expect(rootHtml).toContain("<noscript>");
    expect(labHtml).toContain("<noscript>");
  });
});
