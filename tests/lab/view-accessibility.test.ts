import { describe, expect, it } from "vitest";

import { GEAR_CATALOG, DEFAULT_EQUIPMENT } from "../../src/content/gear";
import { DEFAULT_MOVE_LOADOUT, TEST_FIGHTER } from "../../src/content/test-fighter";
import type { BuildState } from "../../src/lab/build-state";
import { DEFAULT_PREFERENCES } from "../../src/lab/preferences";
import { buildLabView } from "../../src/lab/view";

function view(): string {
  const presets: BuildState["presets"] = ["The Unbound", "Venom Engine", "Prism Lock"].map((name) => ({
    name,
    loadout: DEFAULT_MOVE_LOADOUT.slice(),
    equipment: { ...DEFAULT_EQUIPMENT },
  })) as BuildState["presets"];
  return buildLabView({
    character: TEST_FIGHTER,
    buildState: { activePreset: 0, presets },
    preferences: DEFAULT_PREFERENCES,
    dummyOptions: [[0, "Stand"]],
  });
}

describe("lab accessibility contract", () => {
  it("renders one labeled control for every action and inventory item", () => {
    const html = view();
    expect(html.match(/data-loadout-slot=/g)).toHaveLength(16);
    expect(html.match(/data-select-action=/g)).toHaveLength(16);
    expect(html.match(/data-gear-item=/g)).toHaveLength(GEAR_CATALOG.length);
    expect(html).toContain('aria-label="Move for action 16"');
    expect(html).toContain('aria-label="Action 16: Shift+Space+↓, LT+RT+A"');
  });

  it("keeps modal, tabs, live regions, and reduced-effect settings semantic", () => {
    const html = view();
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html.match(/role="tablist"/g)).toHaveLength(2);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(9);
    expect(html).toContain('id="combat-announcer" role="status" aria-live="polite"');
    expect(html).toContain("Audio captions");
    expect(html).toContain("Combat flashes");
    expect(html).toContain("Status patterns");
    expect(html).toContain("Strong focus indicator");
  });
});
