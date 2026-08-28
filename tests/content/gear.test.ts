import { describe, expect, it } from "vitest";
import { DEFAULT_MOVE_LOADOUT, testFighterWithBuild } from "../../src/content/test-fighter";
import { DEFAULT_EQUIPMENT, GEAR_CATALOG } from "../../src/content/gear";

describe("gear builds", () => {
  it("ships two equippable items for every slot", () => {
    for (const slot of ["focus", "ward", "sigil", "mantle", "charm", "relic"] as const) {
      expect(GEAR_CATALOG.filter((item) => item.slot === slot)).toHaveLength(2);
    }
  });

  it("applies health, tagged damage, and hitstun bonuses without mutating base content", () => {
    const built = testFighterWithBuild(DEFAULT_MOVE_LOADOUT, DEFAULT_EQUIPMENT);
    expect(built.health).toBeGreaterThan(1000);
    const ember = built.moves.find((move) => move.key === "ember_palm")!;
    const base = testFighterWithBuild(DEFAULT_MOVE_LOADOUT, {}).moves.find((move) => move.key === "ember_palm")!;
    expect(ember.hitboxes[0].damage).toBeGreaterThan(base.hitboxes[0].damage);
    const frost = built.moves.find((move) => move.key === "frost_heel")!;
    const baseFrost = testFighterWithBuild(DEFAULT_MOVE_LOADOUT, {}).moves.find((move) => move.key === "frost_heel")!;
    expect(frost.hitboxes[0].hitstun).toBeGreaterThan(baseFrost.hitboxes[0].hitstun);
  });
});
