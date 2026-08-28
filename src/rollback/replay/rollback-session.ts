/**
 * Delay-and-rollback around a `Simulation`.
 *
 * The session owns three things the simulation deliberately does not: which inputs are
 * known, which inputs were guessed, and a history of states to go back to when a guess
 * turns out wrong. The simulation stays a pure function of (state, inputs) and never
 * learns that rollback exists.
 *
 * The one invariant everything else rests on: **a re-simulated frame must produce the
 * same state as the first simulation of that frame did, given the same inputs**. That is
 * why the session records the inputs it actually applied to each frame instead of
 * recomputing them from what it knows now. Locals are replayed exactly as they were
 * applied — a local input cannot arrive late, so any difference would be an error, not a
 * correction — and the remote side is re-derived from the confirmed set, which only ever
 * grows, so the derivation is stable.
 *
 * Where the design refuses to be forgiving: rolling back further than `maxRollback`, or
 * to a frame whose snapshot has been evicted, throws. Clamping instead would let the two
 * machines quietly stop agreeing, and the symptom would surface many seconds later as an
 * unexplained divergence with nothing left to diagnose it from.
 */

import { PLAYER_COUNT } from "../../combat/constants";
import { INPUT_MASK } from "../../combat/types";
import type { FrameReport, InputFrame, SimState } from "../../combat/types";
import type { Simulation } from "../../combat/simulation/simulation";
import { hashState } from "../hashing/fnv";
import { SnapshotRing } from "../snapshots/ring";

export interface RollbackOptions {
  localPlayer: number;
  inputDelay: number;
  maxRollback: number;
}

export interface RollbackMetrics {
  currentRollback: number;
  maxRollbackSeen: number;
  predictedFrames: number;
  correctedFrames: number;
  rollbacks: number;
  desyncs: number;
  confirmedFrame: number;
}

/** Neutral input, used for a frame nobody has an input for. */
const NEUTRAL: InputFrame = 0;

const EMPTY_FRAME = -1;

/**
 * A frame-addressed input history of fixed size.
 *
 * Same trick as the snapshot ring — the slot is `frame % capacity` and the slot stores
 * the frame it belongs to, so a wrapped-around stale entry reports itself as absent
 * rather than as a wrong answer. A plain `Map` would grow for the length of the match
 * and would have to be pruned by hand; the ring cannot leak.
 */
class InputTrack {
  readonly capacity: number;
  private readonly frames: Int32Array;
  private readonly values: Int32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.frames = new Int32Array(capacity).fill(EMPTY_FRAME);
    this.values = new Int32Array(capacity);
  }

  set(frame: number, input: InputFrame): void {
    if (frame < 0) {
      throw new RangeError(`RollbackSession: frame must be non-negative, got ${frame}`);
    }
    const slot = frame % this.capacity;
    this.frames[slot] = frame;
    this.values[slot] = input;
  }

  /** `null` means "not known", which is a different thing from a neutral input of 0. */
  get(frame: number): InputFrame | null {
    if (frame < 0) return null;
    const slot = frame % this.capacity;
    return this.frames[slot] === frame ? this.values[slot] : null;
  }
}

export class RollbackSession {
  readonly metrics: RollbackMetrics;

  private readonly sim: Simulation;
  private readonly opts: RollbackOptions;
  private readonly remotePlayer: number;
  private readonly ring: SnapshotRing;

  /** What is known: our own queued inputs, and the peer's confirmed ones. */
  private readonly localInputs: InputTrack;
  private readonly remoteInputs: InputTrack;

  /** What was used: the inputs each simulated frame actually ran with. */
  private readonly appliedLocal: InputTrack;
  private readonly appliedRemote: InputTrack;

  constructor(sim: Simulation, opts: RollbackOptions) {
    if (!Number.isInteger(opts.localPlayer) || opts.localPlayer < 0 || opts.localPlayer >= PLAYER_COUNT) {
      throw new RangeError(`RollbackSession: localPlayer must be 0..${PLAYER_COUNT - 1}`);
    }
    if (!Number.isInteger(opts.inputDelay) || opts.inputDelay < 0) {
      throw new RangeError("RollbackSession: inputDelay must be a non-negative integer");
    }
    if (!Number.isInteger(opts.maxRollback) || opts.maxRollback < 0) {
      throw new RangeError("RollbackSession: maxRollback must be a non-negative integer");
    }

    this.sim = sim;
    this.opts = opts;
    this.remotePlayer = PLAYER_COUNT - 1 - opts.localPlayer;

    // One slot per frame that may still be rolled back to, plus the frame currently being
    // stepped, plus one so the newest save never evicts the oldest legal target.
    this.ring = new SnapshotRing(opts.maxRollback + 2);

    // Input history has to outlive the rollback window by enough to answer "what was the
    // last input we heard" during a re-simulation, so it is sized generously; at 60 Hz
    // this is several seconds and costs a few kilobytes.
    const trackCapacity = Math.max(256, (opts.maxRollback + opts.inputDelay + 2) * 2);
    this.localInputs = new InputTrack(trackCapacity);
    this.remoteInputs = new InputTrack(trackCapacity);
    this.appliedLocal = new InputTrack(trackCapacity);
    this.appliedRemote = new InputTrack(trackCapacity);

    const start = sim.getState().frame;
    this.metrics = {
      currentRollback: 0,
      maxRollbackSeen: 0,
      predictedFrames: 0,
      correctedFrames: 0,
      rollbacks: 0,
      desyncs: 0,
      confirmedFrame: start - 1,
    };

    // The first `inputDelay` frames run before either player's first input can apply to
    // anything, and both machines know that in advance. Seeding them as neutral makes
    // them confirmed rather than predicted, which is what they are: nothing either player
    // does can change them. This assumes the peer applies the same delay — the single
    // `inputDelay` option says it does — and if a peer does send an input for one of
    // these frames anyway, the normal correction path handles it.
    for (let f = start; f < start + opts.inputDelay; f++) {
      this.localInputs.set(f, NEUTRAL);
      this.remoteInputs.set(f, NEUTRAL);
    }
    this.advanceConfirmedFrame();
  }

  currentFrame(): number {
    // The simulation's own frame counter is the single source of truth. It is restored
    // along with everything else by `setState`, so the session cannot drift away from it
    // during a rollback the way a separately maintained counter could.
    return this.sim.getState().frame;
  }

  addLocalInput(input: InputFrame): number {
    const frame = this.currentFrame() + this.opts.inputDelay;
    this.localInputs.set(frame, input & INPUT_MASK);
    this.advanceConfirmedFrame();
    return frame;
  }

  addRemoteInput(frame: number, input: InputFrame): void {
    if (!Number.isInteger(frame) || frame < 0) {
      throw new RangeError(`RollbackSession: remote input frame must be non-negative, got ${frame}`);
    }
    const value = input & INPUT_MASK;

    const known = this.remoteInputs.get(frame);
    if (known === value) {
      // A duplicate packet. Confirming the same thing twice is not a correction, and
      // treating it as one would charge a rollback for a retransmission.
      return;
    }

    this.remoteInputs.set(frame, value);
    this.advanceConfirmedFrame();

    const now = this.currentFrame();
    if (frame >= now) {
      // Not simulated yet; it will simply be used when the session reaches that frame.
      return;
    }

    const applied = this.appliedRemote.get(frame);
    if (applied === value) {
      // The prediction was right, which is the common case and costs nothing.
      return;
    }

    const distance = now - frame;
    if (distance > this.opts.maxRollback) {
      throw new RangeError(
        `RollbackSession: input for frame ${frame} arrived ${distance} frames late, ` +
          `beyond maxRollback ${this.opts.maxRollback}`,
      );
    }
    if (applied === null) {
      throw new RangeError(
        `RollbackSession: frame ${frame} was simulated but its applied inputs are no longer known`,
      );
    }
    const snapshot = this.ring.load(frame);
    if (snapshot === null) {
      throw new RangeError(`RollbackSession: no snapshot for frame ${frame}, cannot roll back`);
    }

    this.rollback(frame, now, snapshot);
  }

  advance(): FrameReport {
    const frame = this.currentFrame();
    const local = this.localInputs.get(frame) ?? NEUTRAL;

    const confirmed = this.remoteInputs.get(frame);
    if (confirmed === null) {
      this.metrics.predictedFrames++;
    }
    const remote = confirmed ?? this.predictRemote(frame);

    // Every frame is snapshotted, not only the predicted ones. A predicted frame is the
    // only thing that becomes a rollback *target*, but hashing an already-simulated frame
    // for a desync check needs the state as it was at the start of that frame too, and a
    // ring with holes in it would answer that question only sometimes.
    this.ring.save(frame, this.sim.getState());
    return this.stepFrame(frame, local, remote);
  }

  hashAt(frame: number): number | null {
    if (frame === this.currentFrame()) {
      return hashState(this.sim.getState());
    }
    const stored = this.ring.load(frame);
    return stored === null ? null : hashState(stored);
  }

  confirmedHash(frame: number, hash: number): boolean {
    const local = this.hashAt(frame);
    if (local === null) {
      // The frame has aged out of the ring. Not knowing is not evidence of a desync, and
      // `false` here would mean "desynced" to every caller.
      return true;
    }
    if (local === (hash >>> 0)) return true;
    this.metrics.desyncs++;
    return false;
  }

  /**
   * Restore `target` and replay up to `now` with everything currently known.
   *
   * The replayed frames are re-snapshotted as they go, so a second correction landing
   * inside the window rolls back to the corrected states rather than to the mispredicted
   * ones it has already replaced.
   */
  private rollback(target: number, now: number, snapshot: SimState): void {
    this.sim.setState(snapshot);

    this.metrics.rollbacks++;
    this.metrics.currentRollback = now - target;
    if (this.metrics.currentRollback > this.metrics.maxRollbackSeen) {
      this.metrics.maxRollbackSeen = this.metrics.currentRollback;
    }

    for (let f = target; f < now; f++) {
      // Locals replay exactly as they were applied. A local input is known before its
      // frame is ever simulated, so anything else here would be rewriting history.
      const local = this.appliedLocal.get(f) ?? this.localInputs.get(f) ?? NEUTRAL;
      const remote = this.remoteInputs.get(f) ?? this.predictRemote(f);
      this.ring.save(f, this.sim.getState());
      this.stepFrame(f, local, remote);
      // Counted as corrected, not as predicted: a frame is predicted once, when it is
      // first simulated, however many times it is later replayed.
      this.metrics.correctedFrames++;
    }
  }

  private stepFrame(frame: number, local: InputFrame, remote: InputFrame): FrameReport {
    const inputs: InputFrame[] = new Array<InputFrame>(PLAYER_COUNT).fill(NEUTRAL);
    inputs[this.opts.localPlayer] = local;
    inputs[this.remotePlayer] = remote;

    this.appliedLocal.set(frame, local);
    this.appliedRemote.set(frame, remote);

    return this.sim.step(inputs);
  }

  /**
   * Guess the remote input for a frame by repeating the newest confirmed input from
   * before it — the standard assumption that a player who was holding something is still
   * holding it, which is right far more often than neutral would be.
   *
   * It looks backwards from the frame in question rather than at a single "latest known"
   * field so that a replay produces the same guess it produced the first time: the result
   * depends only on the confirmed set, and the confirmed set only ever grows.
   */
  private predictRemote(frame: number): InputFrame {
    const limit = Math.max(0, frame - this.remoteInputs.capacity);
    for (let f = frame - 1; f >= limit; f--) {
      const known = this.remoteInputs.get(f);
      if (known !== null) return known;
    }
    return NEUTRAL;
  }

  /** Walks the confirmed frontier forward; it never moves backwards, so this is cheap. */
  private advanceConfirmedFrame(): void {
    let frame = this.metrics.confirmedFrame + 1;
    while (this.localInputs.get(frame) !== null && this.remoteInputs.get(frame) !== null) {
      frame++;
    }
    this.metrics.confirmedFrame = frame - 1;
  }
}
