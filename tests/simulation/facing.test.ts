import { describe, expect, it } from "vitest";
import { createSim, placeFighters, runFrames } from "../helpers/harness";
import { InputBit, StateId } from "../../src/combat/types";
import { MoveId } from "../../src/content/test-fighter";

describe("facing", () => {
  const basics = [MoveId.StandingLight, ...Array.from({ length: 15 }, () => MoveId.StandingLight)];
  it("starts with the fighters looking at each other", () => {
    const sim = createSim(undefined, basics);
    expect(sim.getState().fighters[0].facing).toBe(1);
    expect(sim.getState().fighters[1].facing).toBe(-1);
  });

  it("turns a grounded, actionable fighter to face the opponent", () => {
    const sim = createSim(undefined, basics);
    placeFighters(sim, 100, -100);
    runFrames(sim, 1);
    expect(sim.getState().fighters[0].facing).toBe(-1);
    expect(sim.getState().fighters[1].facing).toBe(1);
  });

  it("does not turn mid-move", () => {
    const sim = createSim(undefined, basics);
    runFrames(sim, 1, (frame, player) => (player === 0 && frame === 0 ? InputBit.Light : 0));
    expect(sim.getState().fighters[0].state).toBe(StateId.Attack);

    placeFighters(sim, 100, -100);
    runFrames(sim, 1);
    // Still committed to the move, so still looking the way it was when it started.
    expect(sim.getState().fighters[0].facing).toBe(1);
  });

  it("does not turn while in hitstun", () => {
    const sim = createSim(undefined, basics);
    placeFighters(sim, -30, 30);
    runFrames(sim, 6, (frame, player) => (player === 0 && frame === 0 ? InputBit.Light : 0));
    expect(sim.getState().fighters[1].state).toBe(StateId.HitstunStand);

    placeFighters(sim, 100, -100);
    runFrames(sim, 1);
    expect(sim.getState().fighters[1].facing).toBe(-1);
  });
});
