import { describe, expect, it } from "vitest";
import { ACTION_SLOT_COUNT, actionBit } from "../../src/combat/types";
import {
  commandsForLoadout,
  DEFAULT_MOVE_LOADOUT,
  TEST_FIGHTER,
} from "../../src/content/test-fighter";
import { ADDITIONAL_ANIMATIONS } from "../../src/content/additional-animations";

describe("move catalog and loadout", () => {
  it("ships 24 uniquely named and tagged moves", () => {
    expect(TEST_FIGHTER.moves).toHaveLength(24);
    expect(new Set(TEST_FIGHTER.moves.map((move) => move.id)).size).toBe(24);
    expect(new Set(TEST_FIGHTER.moves.map((move) => move.key)).size).toBe(24);
    expect(TEST_FIGHTER.moves.every((move) => move.tags.length >= 3)).toBe(true);
    expect(TEST_FIGHTER.moves.every((move) => move.description.trim().length >= 20)).toBe(true);
    expect(TEST_FIGHTER.moves.every((move) => move.startup > 0 && move.active > 0 && move.recovery > 0 && move.hitboxes[0]?.damage > 0)).toBe(true);
    expect(TEST_FIGHTER.moves.flatMap((move) => move.tags)).toEqual(
      expect.arrayContaining(["burn", "poison", "freeze", "shock", "bleed"]),
    );
  });

  it("has a distinct presentation clip for every added move", () => {
    expect(Object.keys(ADDITIONAL_ANIMATIONS)).toHaveLength(22);
    for (const move of TEST_FIGHTER.moves.slice(2)) {
      expect(ADDITIONAL_ANIMATIONS[move.animation]?.name).toBe(move.animation);
    }
  });

  it("maps a configurable 16-move loadout to 16 independent action bits", () => {
    expect(DEFAULT_MOVE_LOADOUT).toHaveLength(ACTION_SLOT_COUNT);
    const reversed = DEFAULT_MOVE_LOADOUT.slice().reverse();
    const commands = commandsForLoadout(TEST_FIGHTER, reversed);
    expect(commands).toHaveLength(ACTION_SLOT_COUNT);
    for (let slot = 0; slot < ACTION_SLOT_COUNT; slot++) {
      expect(commands[slot].moveId).toBe(reversed[slot]);
      expect(commands[slot].buttons).toBe(actionBit(slot));
    }
  });

  it("offers on-hit combo routes into other moves", () => {
    const validIds = new Set(TEST_FIGHTER.moves.map((move) => move.id));
    for (const move of TEST_FIGHTER.moves) {
      expect(move.cancelWindows.length).toBeGreaterThan(0);
      expect(move.cancelWindows[0].onHitOnly).toBe(true);
      expect(move.cancelWindows[0].into.every((id) => validIds.has(id))).toBe(true);
    }
  });
});
