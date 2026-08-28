import { describe, expect, it } from "vitest";
import { DEFAULT_MOVE_LOADOUT, testFighterWithBuild } from "../../src/content/test-fighter";
import {
  ARMOR_CATALOG,
  ARMOR_GRADES,
  ARMOR_SKILLS,
  ARMOR_SLOTS,
  DEFAULT_ARMOR_INVENTORY,
  DEFAULT_EQUIPMENT,
  canCraftArmor,
} from "../../src/content/armor";

describe("armor builds", () => {
  it("ships a complete five-piece set at every color grade", () => {
    for (const slot of ARMOR_SLOTS) {
      expect(ARMOR_CATALOG.filter((item) => item.slot === slot)).toHaveLength(5);
    }
    for (const grade of ARMOR_GRADES) expect(ARMOR_CATALOG.filter((item) => item.grade === grade)).toHaveLength(5);
    expect(new Set(ARMOR_CATALOG.map((item) => item.description)).size).toBe(25);
    expect(new Set(ARMOR_CATALOG.map((item) => item.setDescription)).size).toBe(5);
  });

  it("uses only the requested 1/3/5 and 1/3 skill thresholds", () => {
    for (const skill of ARMOR_SKILLS) {
      expect(skill.thresholds.map((threshold) => threshold.points)).toEqual(
        ["vitality-up", "stamina-up"].includes(skill.id) ? [1, 3, 5] : [1, 3],
      );
    }
  });

  it("resolves vitality, stamina, flat armor, and resistances without changing moves", () => {
    const built = testFighterWithBuild(DEFAULT_MOVE_LOADOUT, DEFAULT_EQUIPMENT);
    const base = testFighterWithBuild(DEFAULT_MOVE_LOADOUT, {});
    expect(built.health).toBe(1050);
    expect(built.stamina).toBe(110);
    expect(built.armor).toBe(50);
    expect(built.resistances).toEqual({ poison: 10, fire: 10, frost: 10, shock: 0 });
    expect(built.moves).toEqual(base.moves);
  });

  it("makes recipes depend on the shared material inventory", () => {
    const unowned = ARMOR_CATALOG.find((item) => item.grade === "purple")!;
    expect(canCraftArmor(unowned, DEFAULT_ARMOR_INVENTORY)).toBe(true);
    expect(canCraftArmor(unowned, { armor: DEFAULT_ARMOR_INVENTORY.armor, materials: {} })).toBe(false);
  });
});
