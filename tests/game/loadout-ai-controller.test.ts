import { describe, expect, it } from "vitest";

import { px } from "../../src/combat/constants";
import { Simulation } from "../../src/combat/simulation/simulation";
import { InputBit } from "../../src/combat/types";
import { TEST_FIGHTER } from "../../src/content/test-fighter";
import { LoadoutAIController, nearestEnemy } from "../../src/game/loadout-ai-controller";
import { aiProfile } from "../../src/game/session";

function partySim(): Simulation {
  return new Simulation({
    characters: [TEST_FIGHTER, TEST_FIGHTER, TEST_FIGHTER],
    startX: [px(-80), 0, px(32)],
    teams: [0, 0, 1],
    seed: 0x5eed,
  });
}

describe("loadout AI controller", () => {
  it("targets the nearest living hostile rather than a fixed player index", () => {
    const sim = partySim();
    expect(nearestEnemy(sim.getState(), 1, [0, 0, 1])).toBe(2);
    sim.getState().fighters[2].health = 0;
    expect(nearestEnemy(sim.getState(), 1, [0, 0, 1])).toBe(-1);
  });

  it("returns the same authored command for the same authoritative frame", () => {
    const sim = partySim();
    const controller = new LoadoutAIController(aiProfile("standard"), 0x1234);
    const first = controller.inputFor(sim.getState(), 1, sim.characters(), [0, 0, 1]);
    const second = controller.inputFor(sim.getState(), 1, sim.characters(), [0, 0, 1]);

    expect(first).toBe(second);
    expect(first).not.toBe(0);
    expect(TEST_FIGHTER.commands.some((command) => command.buttons === first)).toBe(true);
    expect(first & (InputBit.Left | InputBit.Right)).toBe(0);
  });

  it("changes decision quality without mutating character combat stats", () => {
    const sim = partySim();
    const before = JSON.stringify(sim.characters());
    new LoadoutAIController(aiProfile("apprentice"), 1).inputFor(sim.getState(), 1, sim.characters(), [0, 0, 1]);
    new LoadoutAIController(aiProfile("master"), 1).inputFor(sim.getState(), 1, sim.characters(), [0, 0, 1]);
    expect(JSON.stringify(sim.characters())).toBe(before);
  });
});
