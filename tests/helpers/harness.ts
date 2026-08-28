import { Simulation } from "../../src/combat/simulation/simulation";
import { px } from "../../src/combat/constants";
import type { FrameReport, InputFrame } from "../../src/combat/types";
import { testFighterSimConfig } from "../../src/content/test-fighter";

/**
 * A scripted input source for a run of frames.
 *
 * Two shapes because the suites want two different things: a function is the natural way
 * to say "player 0 holds right forever, player 1 does nothing", and a list is the natural
 * way to write a short, exact sequence out longhand where every frame matters. Both are
 * pure functions of the frame index, which is the only thing that keeps a replayed run
 * bit-identical to the original.
 */
export type InputScript =
  | ((frame: number, player: number) => InputFrame)
  | readonly (readonly InputFrame[])[];

export function createSim(seed?: number): Simulation {
  return new Simulation(testFighterSimConfig(seed));
}

/** Both players' inputs for one frame. Anything the script does not cover is neutral. */
export function inputsFor(script: InputScript | undefined, frame: number): InputFrame[] {
  if (script === undefined) return [0, 0];
  if (typeof script === "function") return [script(frame, 0), script(frame, 1)];
  const row: readonly InputFrame[] | undefined = script[frame];
  if (row === undefined) return [0, 0];
  return [row[0] ?? 0, row[1] ?? 0];
}

/**
 * Step the simulation `count` times and hand back every report.
 *
 * The frame handed to the script is the frame about to be simulated, read from the
 * simulation rather than from a local counter, so a harness run that starts from a
 * restored snapshot scripts the same inputs it would have had the first time through.
 */
export function runFrames(sim: Simulation, count: number, script?: InputScript): FrameReport[] {
  const reports: FrameReport[] = [];
  for (let i = 0; i < count; i++) {
    reports.push(sim.step(inputsFor(script, sim.getState().frame)));
  }
  return reports;
}

export function runSim(
  count: number,
  script?: InputScript,
  seed?: number,
): { sim: Simulation; reports: FrameReport[] } {
  const sim = createSim(seed);
  return { sim, reports: runFrames(sim, count, script) };
}

/**
 * Move both fighters to an exact separation, in world pixels, before a run starts.
 *
 * Facing is deliberately left alone: the match starts with player 0 on the left and the
 * tests keep it there, so the facings the simulation set up are already the right ones and
 * overwriting them would hide a bug in the facing rules rather than expose one.
 */
export function placeFighters(sim: Simulation, p0PixelX: number, p1PixelX: number): void {
  const fighters = sim.getState().fighters;
  fighters[0].x = px(p0PixelX);
  fighters[0].vx = 0;
  fighters[1].x = px(p1PixelX);
  fighters[1].vx = 0;
}
