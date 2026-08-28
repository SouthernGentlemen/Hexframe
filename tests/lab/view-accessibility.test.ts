import { describe, expect, it } from "vitest";

import { ARMOR_CATALOG, MATERIAL_CATALOG } from "../../src/content/armor";
import { DEFAULT_MOVE_LOADOUT, testFighterWithBuild } from "../../src/content/test-fighter";
import { createDefaultBuildState } from "../../src/lab/build-state";
import { DEFAULT_PREFERENCES } from "../../src/lab/preferences";
import { buildLabView } from "../../src/lab/view";

function view(publicPlay = false): string {
  const buildState = createDefaultBuildState();
  return buildLabView({
    character: testFighterWithBuild(DEFAULT_MOVE_LOADOUT, buildState.presets[0].equipment),
    buildState,
    preferences: DEFAULT_PREFERENCES,
    dummyOptions: [[0, "Stand"]],
    publicPlay,
  });
}

describe("lab accessibility contract", () => {
  it("renders one labeled control for every action and inventory item", () => {
    const html = view();
    expect(html.match(/data-loadout-slot=/g)).toHaveLength(16);
    expect(html.match(/data-select-action=/g)).toHaveLength(16);
    expect(html.match(/data-armor-item=/g)).toHaveLength(buildStateArmorCount());
    expect(html.match(/data-material-item=/g)).toHaveLength(MATERIAL_CATALOG.length);
    expect(html.match(/data-craft-item=/g)).toHaveLength(ARMOR_CATALOG.length);
    expect(html).toContain('aria-label="Move for action 16"');
    expect(html).toContain('aria-label="Action 16: Shift+E+↓, LT+RT+A"');
  });

  it("keeps modal, tabs, live regions, and reduced-effect settings semantic", () => {
    const html = view();
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html.match(/role="tablist"/g)).toHaveLength(3);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(14);
    expect(html).toContain('id="page-loadout"');
    expect(html).toContain('id="page-armor"');
    expect(html).toContain('id="page-craft"');
    expect(html).toContain('id="page-moves"');
    expect(html.match(/class="move-card"/g)).toHaveLength(28);
    expect(html.match(/data-equip-move=/g)).toHaveLength(28);
    expect(html).toContain('data-move-filter="role"');
    expect(html).toContain('data-preset-action="duplicate"');
    expect(html).toContain('id="move-showcase-stage"');
    expect(html).toContain('id="codex-move-stage"');
    expect(html).toContain('id="codex-frame-scrubber"');
    expect(html).toContain('data-demo-mode="block"');
    expect(html).toContain("Fast universal starter with short reach.");
    expect(html).toContain('id="combat-announcer" role="status" aria-live="polite"');
    expect(html).toContain('aria-label="Frame transport controls"');
    expect(html).toContain('id="move-timeline-console"');
    expect(html).toContain('id="interaction-history"');
    expect(html).toContain('data-action="scenario-capture"');
    expect(html).toContain("Pause on contact");
    expect(html).toContain("Audio captions");
    expect(html).toContain("Combat flashes");
    expect(html).toContain("Status patterns");
    expect(html).toContain("Strong focus indicator");
    expect(html).not.toContain("Hear every opening.");
    expect(html).not.toContain("Sixteen actions, equipped relics");
  });

  it("removes operator-only controls from the public playtest", () => {
    const html = view(true);
    expect(html).toContain("PUBLIC PLAYTEST");
    expect(html).toContain('class="lab-shell public-play"');
    expect(html).toContain("Prime. Link. Cash out.");
    expect(html).toContain("Arsenal · Codex · System");
    expect(html).toContain('class="training-frame-console"');
    expect(html).toContain('id="move-timeline-console"');
    expect(html).not.toContain('class="frame-console"');
    expect(html).not.toContain('id="frame-inspector"');
    expect(html).not.toContain('class="geometry-controls"');
    expect(html).not.toContain('id="interaction-history"');
    expect(html).not.toContain('data-action="scenario-capture"');
    expect(html).not.toContain("Combat operating system.");
    expect(html).not.toContain('data-menu-tab="debug"');
    expect(html).not.toContain('action="/logout"');
    expect(html).not.toContain('id="debug-panel"');
    expect(html.match(/role="tabpanel"/g)).toHaveLength(13);
  });
});

function buildStateArmorCount(): number {
  return createDefaultBuildState().inventory.armor.length;
}
