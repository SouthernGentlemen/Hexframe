import { describe, expect, it } from "vitest";
import { InputBit } from "../../src/combat/types";
import { hashState } from "../../src/rollback/hashing/fnv";
import { RollbackSession } from "../../src/rollback/replay/rollback-session";
import { createSim, runFrames } from "../helpers/harness";

describe("rollback session", () => {
  it("corrects a wrong prediction to the authoritative result", () => {
    const predicted = createSim();
    const session = new RollbackSession(predicted, {
      localPlayer: 0,
      inputDelay: 0,
      maxRollback: 8,
    });

    for (let frame = 0; frame < 6; frame++) {
      session.addLocalInput(InputBit.Right);
      session.advance();
    }
    session.addRemoteInput(0, InputBit.Left);
    for (let frame = 1; frame < 6; frame++) session.addRemoteInput(frame, InputBit.Left);

    const authoritative = createSim();
    runFrames(authoritative, 6, (_frame, player) =>
      player === 0 ? InputBit.Right : InputBit.Left,
    );

    expect(hashState(predicted.getState())).toBe(hashState(authoritative.getState()));
    expect(session.metrics.rollbacks).toBe(1);
    expect(session.metrics.correctedFrames).toBe(6);
  });
});
