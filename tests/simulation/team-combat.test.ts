import { describe, expect, it } from "vitest";

import { px } from "../../src/combat/constants";
import { resolveContacts } from "../../src/combat/hit-resolution/resolve";
import { Simulation } from "../../src/combat/simulation/simulation";
import type { FrameReport } from "../../src/combat/types";
import { ContactKind, InputBit, StateId } from "../../src/combat/types";
import { BELL_WARDEN, BellWardenMoveId } from "../../src/content/bell-warden";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { Timeline } from "../../src/lab/timeline/timeline";

function report(): FrameReport {
  return { frame: 0, contacts: [], debuffs: [], moveStarts: [], stateChanges: [], entityEvents: [] };
}

function teamSim(friendlyFire = false): Simulation {
  return new Simulation({
    characters: [TEST_FIGHTER, TEST_FIGHTER, TEST_FIGHTER],
    startX: [px(-30), 0, px(20)],
    teams: [0, 0, 1],
    friendlyFire,
    seed: 7,
  });
}

describe("multi-fighter team combat", () => {
  it("allocates state and timeline input history for every configured fighter", () => {
    const sim = teamSim();
    const timeline = new Timeline(sim, 16);
    timeline.inputProvider = () => [0, 0, InputBit.Light];
    timeline.stepFrames(1);

    expect(sim.getState().fighters).toHaveLength(3);
    expect(sim.getState().inputHistory).toHaveLength(3);
    expect(timeline.recordedInputs()).toEqual([{ frame: 0, inputs: [0, 0, InputBit.Light] }]);
  });

  it("skips teammates and resolves the same hitbox against a hostile", () => {
    const sim = teamSim();
    const state = sim.getState();
    Object.assign(state.fighters[0], { state: StateId.Attack, moveId: MoveId.StandingLight, moveFrame: 4, facing: 1 });
    const events = report();

    resolveContacts(state, sim.characters(), [0, 0, 0], events, [0, 0, 1], false);

    expect(state.fighters[1].health).toBe(TEST_FIGHTER.health);
    expect(state.fighters[2].health).toBe(TEST_FIGHTER.health - 30);
    expect(events.contacts.map((contact) => contact.defender)).toEqual([2]);
  });

  it("can opt into friendly fire without changing authored damage", () => {
    const sim = teamSim(true);
    const state = sim.getState();
    Object.assign(state.fighters[0], { state: StateId.Attack, moveId: MoveId.StandingLight, moveFrame: 4, facing: 1 });
    resolveContacts(state, sim.characters(), [0, 0, 0], report(), [0, 0, 1], true);

    expect(state.fighters[1].health).toBe(TEST_FIGHTER.health - 30);
    expect(state.fighters[2].health).toBe(TEST_FIGHTER.health);
  });

  it("preserves held-away blocking when a boss attacks a three-fighter party", () => {
    const sim = new Simulation({
      characters: [TEST_FIGHTER, TEST_FIGHTER, BELL_WARDEN],
      startX: [px(-20), px(-160), px(20)],
      teams: [0, 0, 1],
      seed: 7,
    });
    const state = sim.getState();
    const hook = BELL_WARDEN.moves.find((move) => move.id === BellWardenMoveId.ChainHook)!;
    Object.assign(state.fighters[2], {
      state: StateId.Attack,
      moveId: hook.id,
      moveFrame: hook.hitboxes[0].startFrame,
      facing: -1,
    });
    const events = report();

    resolveContacts(state, sim.characters(), [InputBit.Left, 0, 0], events, [0, 0, 1], false);

    expect(events.contacts).toContainEqual(expect.objectContaining({ defender: 0, kind: ContactKind.Block }));
    expect(state.fighters[0].health).toBe(TEST_FIGHTER.health);
    expect(state.fighters[0].state).toBe(StateId.BlockstunStand);
  });
});
