import { describe, expect, it } from "vitest";
import { createSim, placeFighters, runFrames } from "../helpers/harness";
import { pushboxOf } from "../../src/combat/collision/boxes";
import { overlaps } from "../../src/combat/collision/aabb";
import { resolvePushboxes } from "../../src/combat/collision/pushbox";
import { InputBit } from "../../src/combat/types";
import { px, STAGE_HALF_WIDTH, toPixels } from "../../src/combat/constants";

describe("pushbox separation", () => {
  it("pushes overlapping fighters apart symmetrically", () => {
    const sim = createSim();
    placeFighters(sim, -10, 10);
    const s = sim.getState();
    resolvePushboxes(s, sim.characters());

    // Pushboxes are 36 px wide, so 20 px apart is a 16 px overlap; each gives up half.
    expect(s.fighters[0].x).toBe(px(-18));
    expect(s.fighters[1].x).toBe(px(18));
    expect(overlaps(pushboxOf(s.fighters[0], sim.characters()[0]), pushboxOf(s.fighters[1], sim.characters()[1]))).toBe(false);
  });

  it("separates fighters standing on exactly the same spot, by player index", () => {
    const sim = createSim();
    placeFighters(sim, 0, 0);
    const s = sim.getState();
    resolvePushboxes(s, sim.characters());
    expect(s.fighters[0].x).toBeLessThan(s.fighters[1].x);
  });

  it("does not push a cornered fighter through the wall", () => {
    const sim = createSim();
    // placeFighters accepts authored world pixels, while the stage constant is in sim
    // units. Keep the unit boundary explicit so this test actually reaches the wall.
    const wall = toPixels(STAGE_HALF_WIDTH) - 18;
    placeFighters(sim, wall - 4, wall);
    const s = sim.getState();
    resolvePushboxes(s, sim.characters());

    expect(pushboxOf(s.fighters[1], sim.characters()[1]).x1).toBeLessThanOrEqual(STAGE_HALF_WIDTH);
    expect(overlaps(pushboxOf(s.fighters[0], sim.characters()[0]), pushboxOf(s.fighters[1], sim.characters()[1]))).toBe(false);
  });

  it("holds a fighter walking into the wall at the stage edge", () => {
    const sim = createSim();
    placeFighters(sim, 0, 300);
    // Player 1 walks forward — toward player 0 — is the wrong way; hold Right to reach
    // the right-hand wall, which for a left-facing fighter is backwards.
    runFrames(sim, 600, (_frame, player) => (player === 1 ? InputBit.Right : 0));
    const box = pushboxOf(sim.getState().fighters[1], sim.characters()[1]);
    expect(box.x1).toBeLessThanOrEqual(STAGE_HALF_WIDTH);
    expect(box.x1).toBe(STAGE_HALF_WIDTH);
  });
});
