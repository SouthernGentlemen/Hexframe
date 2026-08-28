import { describe, expect, it } from "vitest";

import { buildStateFromPlayerSave, createDefaultPlayerSave, normalizePlayerSave, syncBuildStateToPlayerSave } from "../../src/player/save";

describe("unified player save", () => {
  it("contains per-stage progression, unlocks, inventory, and three authored loadouts", () => {
    const save = createDefaultPlayerSave();
    expect(save.version).toBe(2);
    expect(save.campaign.stages["black-belfry"]?.status).toBe("in-progress");
    expect(save.campaign.stages["stage-02"]?.status).toBe("locked");
    expect(save.loadouts.order).toEqual(["loadout-01", "loadout-02", "loadout-03"]);
    expect(save.loadouts.byId["loadout-01"]?.loadout).toHaveLength(16);
    expect(save.loadouts.byId["loadout-01"]?.loadout).not.toContain(0);
    expect(save.inventory).toBe(buildStateFromPlayerSave(save).inventory);
  });

  it("maps the existing build editor onto loadouts without a second persistence model", () => {
    const save = createDefaultPlayerSave();
    const builds = buildStateFromPlayerSave(save);
    builds.activePreset = 1;
    builds.presets[1].name = "Poison Bell";
    syncBuildStateToPlayerSave(save, builds);
    expect(save.loadouts.activeId).toBe("loadout-02");
    expect(save.loadouts.byId["loadout-02"]?.name).toBe("Poison Bell");
  });

  it("normalizes malformed saves back to safe defaults", () => {
    const normalized = normalizePlayerSave({
      version: 2,
      revision: -4,
      loadouts: { order: ["custom-01", "custom-02", "custom-03"], byId: {} },
    });
    expect(normalized.revision).toBe(0);
    expect(normalized.loadouts.order).toEqual(["loadout-01", "loadout-02", "loadout-03"]);

    const malformedMove = createDefaultPlayerSave();
    malformedMove.loadouts.byId["loadout-01"].loadout[0] = 999;
    expect(normalizePlayerSave(malformedMove).loadouts.byId["loadout-01"].loadout[0]).not.toBe(999);
  });
});
