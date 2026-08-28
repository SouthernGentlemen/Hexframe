import { describe, expect, it } from "vitest";
import { cancelAllowed } from "../../src/combat/commands/resolve";
import { ACTION_SLOT_COUNT, actionBit } from "../../src/combat/types";
import {
  commandsForLoadout,
  DEFAULT_MOVE_LOADOUT,
  MoveId,
  TEST_FIGHTER,
} from "../../src/content/test-fighter";
import { ADDITIONAL_ANIMATIONS } from "../../src/content/additional-animations";
import { createSim } from "../helpers/harness";

describe("move catalog and loadout", () => {
  it("ships 29 uniquely named and tagged moves", () => {
    expect(TEST_FIGHTER.moves).toHaveLength(29);
    expect(new Set(TEST_FIGHTER.moves.map((move) => move.id)).size).toBe(29);
    expect(new Set(TEST_FIGHTER.moves.map((move) => move.key)).size).toBe(29);
    expect(TEST_FIGHTER.moves.every((move) => move.tags.length >= 3)).toBe(true);
    expect(TEST_FIGHTER.moves.every((move) => move.description.trim().length >= 20)).toBe(true);
    expect(TEST_FIGHTER.moves.every((move) => move.startup > 0 && move.active > 0 && move.recovery > 0 && move.hitboxes[0]?.damage > 0)).toBe(true);
    expect(TEST_FIGHTER.moves.flatMap((move) => move.tags)).toEqual(
      expect.arrayContaining(["burn", "poison", "freeze", "shock", "bleed"]),
    );
  });

  it("has a distinct presentation clip for every added move", () => {
    expect(Object.keys(ADDITIONAL_ANIMATIONS)).toHaveLength(26);
    const contactSilhouettes = new Set<string>();
    for (const move of TEST_FIGHTER.moves.slice(2).filter((candidate) => candidate.id !== MoveId.GraveToll)) {
      const animation = ADDITIONAL_ANIMATIONS[move.animation];
      expect(animation?.name).toBe(move.animation);
      expect(animation?.keyframes).toHaveLength(5);
      contactSilhouettes.add(JSON.stringify(animation?.keyframes[2]?.bones));
    }
    expect(contactSilhouettes.size).toBe(26);
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

  it("ships direction-first starter, link, and cashout columns", () => {
    expect(DEFAULT_MOVE_LOADOUT.slice(0, 12)).toEqual([
      MoveId.EmberPalm, MoveId.VenomFang, MoveId.FrostHeel, MoveId.StormKnuckle,
      MoveId.AshenSweep, MoveId.ToxicBloom, MoveId.GlacierSpike, MoveId.StaticRush,
      MoveId.PhoenixDrive, MoveId.PlagueTouch, MoveId.Permafrost, MoveId.ThunderClap,
    ]);
  });

  it("enforces starter to link to cashout route grammar", () => {
    const validIds = new Set(TEST_FIGHTER.moves.map((move) => move.id));
    for (const move of TEST_FIGHTER.moves) {
      const role = move.tags.find((tag) => ["starter", "link", "cashout", "reversal"].includes(tag));
      expect(role).toBeDefined();
      for (const window of move.cancelWindows) {
        expect(window.onHitOnly).toBe(true);
        expect(window.into.every((id) => validIds.has(id))).toBe(true);
        const targetRoles = window.into.map((id) => TEST_FIGHTER.moves.find((candidate) => candidate.id === id)?.tags ?? []);
        if (role === "starter") expect(targetRoles.every((tags) => tags.includes("starter") || tags.includes("link"))).toBe(true);
        if (role === "link") expect(targetRoles.every((tags) => tags.includes("link") || tags.includes("cashout"))).toBe(true);
      }
      if (role === "cashout" || role === "reversal") expect(move.cancelWindows).toHaveLength(0);
    }

    const route = (keys: string[]): void => {
      for (let index = 0; index < keys.length - 1; index++) {
        const move = TEST_FIGHTER.moves.find((candidate) => candidate.key === keys[index])!;
        const into = TEST_FIGHTER.moves.find((candidate) => candidate.key === keys[index + 1])!;
        expect(move.cancelWindows.some((window) => window.into.includes(into.id))).toBe(true);
      }
    };
    route(["ember_palm", "ashen_sweep", "phoenix_drive"]);
    route(["venom_fang", "toxic_bloom", "plague_touch"]);
    route(["frost_heel", "glacier_spike", "permafrost"]);
    route(["storm_knuckle", "static_rush", "bastion_break"]);
    route(["crimson_arc", "blood_moon", "reaper_kick"]);

    const ember = TEST_FIGHTER.moves.find((move) => move.key === "ember_palm")!;
    const toxic = TEST_FIGHTER.moves.find((move) => move.key === "toxic_bloom")!;
    const reaper = TEST_FIGHTER.moves.find((move) => move.key === "reaper_kick")!;
    expect(ember.cancelWindows.some((window) => window.into.includes(toxic.id))).toBe(false);
    expect(toxic.cancelWindows.some((window) => window.into.includes(reaper.id))).toBe(false);
  });

  it("applies the route grammar at the combat command gate", () => {
    const fighter = createSim().getState().fighters[0];
    fighter.moveId = MoveId.EmberPalm;
    fighter.moveFrame = 8;
    fighter.hitFlags = 1;
    expect(cancelAllowed(fighter, TEST_FIGHTER, MoveId.AshenSweep)).toBe(true);
    expect(cancelAllowed(fighter, TEST_FIGHTER, MoveId.ToxicBloom)).toBe(false);

    fighter.moveId = MoveId.ToxicBloom;
    fighter.moveFrame = 15;
    expect(cancelAllowed(fighter, TEST_FIGHTER, MoveId.PlagueTouch)).toBe(true);
    expect(cancelAllowed(fighter, TEST_FIGHTER, MoveId.ReaperKick)).toBe(false);
  });
});
