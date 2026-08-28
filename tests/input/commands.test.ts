import { describe, expect, it } from "vitest";
import { InputBit } from "../../src/combat/types";
import { MoveId } from "../../src/content/test-fighter";
import { createSim, runFrames } from "../helpers/harness";

describe("command parsing", () => {
  it("starts the standing normal from a light press", () => {
    const sim = createSim();
    const reports = runFrames(sim, 1, (_frame, player) =>
      player === 0 ? InputBit.Light : 0,
    );
    expect(reports[0].moveStarts).toEqual([{ player: 0, moveId: MoveId.StandingLight }]);
  });

  it("selects the higher-priority crouching normal while down is held", () => {
    const sim = createSim();
    const reports = runFrames(sim, 1, (_frame, player) =>
      player === 0 ? InputBit.Down | InputBit.Light : 0,
    );
    expect(reports[0].moveStarts).toEqual([{ player: 0, moveId: MoveId.CrouchingLight }]);
  });

  it("does not turn one held button into repeated moves", () => {
    const sim = createSim();
    const reports = runFrames(sim, 40, (_frame, player) =>
      player === 0 ? InputBit.Light : 0,
    );
    expect(reports.flatMap((report) => report.moveStarts)).toHaveLength(1);
  });
});
