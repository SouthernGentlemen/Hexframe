import { PLAYER_COUNT, Simulation } from "../../combat";
import type { FrameReport, InputFrame } from "../../combat";
import { SnapshotRing } from "../../rollback/snapshots/ring";
import { deserializeState, serializeState } from "../../rollback/snapshots/snapshot";

/** How fast the laboratory drives the simulation, as a percentage of real time. */
export type LabSpeed = 25 | 50 | 100 | 200;

/**
 * `speed` is a percentage, so the accumulator counts hundredths of a simulation frame and
 * a whole frame is worth 100 of them. Keeping the ratio in integers means 25% is exactly
 * one frame every four rather than 0.25 frames a frame, which would drift.
 */
const SPEED_UNIT = 100;

/** Inputs handed to `step()` before anything has supplied a provider: everyone neutral. */
const NEUTRAL_INPUTS: readonly InputFrame[] = new Array<number>(PLAYER_COUNT).fill(0);

/**
 * The laboratory's clock and its rewind buffer.
 *
 * Two decisions are worth stating because they could have gone otherwise.
 *
 * The timeline never receives a delta. `tick` is told how many whole *real* 60 Hz frames
 * have gone by and converts that to a whole number of simulation frames, so the
 * simulation only ever advances in fixed steps no matter what the display is doing. A
 * speed multiplier changes how many simulation frames one real second produces; it never
 * changes what a frame is.
 *
 * Stepping backwards restores a snapshot. The simulation is not reversible — hitstop,
 * pushbox separation and the input buffer all consume information — so the only honest
 * way back is a copy of where we were. Every frame is snapshotted before it runs, which
 * is what makes `-1` exact, and when the wanted frame has aged out of the ring the
 * timeline says so in `lastMessage` rather than landing on the nearest frame it still
 * has.
 */
export class Timeline {
  paused = false;
  speed: LabSpeed = 100;

  /**
   * The report from the most recently *simulated* frame, or `null` when the current state
   * did not come from running a frame — after a rewind, a load or a reset there is no
   * frame that produced this state, and pretending otherwise would show the laboratory a
   * report belonging to a frame it has since left.
   */
  lastReport: FrameReport | null = null;

  /** Set when a request could not be honoured, for the laboratory to show. */
  lastMessage: string | null = null;

  /** Where the inputs for each simulated frame come from. Set by the laboratory. */
  inputProvider: (frame: number) => readonly InputFrame[] = () => NEUTRAL_INPUTS;

  private readonly sim: Simulation;
  private readonly ring: SnapshotRing;
  private readonly slots = new Map<number, Uint8Array>();
  private accumulator = 0;

  constructor(sim: Simulation, ringCapacity: number) {
    this.sim = sim;
    this.ring = new SnapshotRing(ringCapacity);
  }

  /**
   * Advance by whole simulation frames derived from whole real frames. The remainder is
   * kept, so at 25% four real frames produce exactly one simulation frame and nothing is
   * lost to repeated rounding. While paused the accumulator is emptied instead of
   * carried, so resuming does not fire off a burst of frames that piled up unseen.
   */
  tick(realFramesElapsed: number): FrameReport[] {
    if (this.paused) {
      this.accumulator = 0;
      return [];
    }
    if (realFramesElapsed <= 0) return [];

    this.accumulator += realFramesElapsed * this.speed;
    // The accumulator is never negative, so truncation is a floor here.
    const frames = Math.trunc(this.accumulator / SPEED_UNIT);
    this.accumulator -= frames * SPEED_UNIT;

    const reports: FrameReport[] = [];
    for (let i = 0; i < frames; i++) reports.push(this.stepOnce());
    return reports;
  }

  /** Forward by `n` frames, or back to a snapshot `n` frames ago when `n` is negative. */
  stepFrames(n: number): void {
    this.lastMessage = null;
    if (n === 0) return;

    if (n > 0) {
      for (let i = 0; i < n; i++) this.stepOnce();
      return;
    }

    const target = this.sim.getState().frame + n;
    if (target < 0) {
      this.lastMessage = `Frame ${target} is before the start of the match.`;
      return;
    }

    const restored = this.ring.load(target);
    if (restored === null) {
      const oldest = this.ring.oldestFrame();
      this.lastMessage =
        oldest < 0
          ? `Frame ${target} is not in the snapshot ring — no frames have been recorded yet.`
          : `Frame ${target} has fallen out of the snapshot ring; the oldest frame still held is ${oldest}.`;
      return;
    }

    this.sim.setState(restored);
    this.lastReport = null;
    this.accumulator = 0;
  }

  /**
   * Save-state uses `serializeState` — the same bytes rollback stores and the same bytes
   * the determinism hash is taken over. A second, laboratory-only copy of the state would
   * be a second definition of what the state is, and the first time the two disagreed the
   * laboratory would be lying about the engine it exists to inspect.
   */
  saveState(slot: number): void {
    this.slots.set(slot, serializeState(this.sim.getState()));
  }

  loadState(slot: number): boolean {
    const bytes = this.slots.get(slot);
    if (bytes === undefined) return false;
    this.sim.setState(deserializeState(bytes));
    // The ring holds frames from the timeline we just abandoned. Frame numbers alone
    // would make some of them look valid again, so they go rather than risk a rewind
    // landing on a same-numbered frame from a different run.
    this.ring.clear();
    this.lastReport = null;
    this.lastMessage = null;
    this.accumulator = 0;
    return true;
  }

  /** Whether a slot currently holds anything, for enabling the load control. */
  hasSlot(slot: number): boolean {
    return this.slots.has(slot);
  }

  /** The span of frames a backward step can still reach; both `-1` when the ring is empty. */
  bufferedRange(): { oldest: number; newest: number } {
    return { oldest: this.ring.oldestFrame(), newest: this.ring.newestFrame() };
  }

  /** Back to frame zero. Save-state slots survive: they are the user's, not the run's. */
  reset(): void {
    this.sim.setState(Simulation.initialState(this.sim.config));
    this.ring.clear();
    this.lastReport = null;
    this.lastMessage = null;
    this.accumulator = 0;
  }

  /**
   * The snapshot is taken *before* the frame runs, so the ring is keyed by the frame the
   * state is at rather than the frame it produced. That is what makes stepping back one
   * frame land exactly where the previous step began.
   */
  private stepOnce(): FrameReport {
    const state = this.sim.getState();
    this.ring.save(state.frame, state);
    const report = this.sim.step(this.inputProvider(state.frame));
    this.lastReport = report;
    return report;
  }
}
