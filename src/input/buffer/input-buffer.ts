/**
 * A client-side ring of input frames.
 *
 * This is collection, not simulation state: the local controller and the network both
 * deposit frames here before anything decides which frame the simulation is on. It is
 * deliberately not `SimState.inputHistory` — nothing in this file is hashed, snapshotted
 * or rolled back, and the simulation never reads it.
 */

import type { InputFrame } from "../../combat/types";
import { INPUT_MASK } from "../../combat/types";
import { COMMAND_HISTORY_FRAMES } from "../../combat/constants";

/** Marks a slot no frame has been written to. Real frame numbers are never negative. */
const EMPTY = -1;

export class InputBuffer {
  private readonly capacity: number;
  private readonly slotFrames: Int32Array;
  private readonly slotInputs: Int32Array;
  private newest = EMPTY;

  /**
   * The default depth matches the simulation's own input history, which is as far back as
   * anything can meaningfully ask about. A rollback session that delays local inputs and
   * holds predictions wants more and passes its own.
   */
  constructor(capacity: number = COMMAND_HISTORY_FRAMES) {
    this.capacity = Math.max(1, Math.trunc(capacity));
    this.slotFrames = new Int32Array(this.capacity).fill(EMPTY);
    this.slotInputs = new Int32Array(this.capacity);
  }

  /**
   * Stores one frame, overwriting whatever the slot held. Frames may arrive out of order —
   * a corrected remote input lands behind the newest frame — so `newest` only ever moves
   * forward and a late arrival does not rewind it.
   */
  push(frame: number, input: InputFrame): void {
    if (frame < 0) return;
    const slot = frame % this.capacity;
    this.slotFrames[slot] = frame;
    this.slotInputs[slot] = input & INPUT_MASK;
    if (frame > this.newest) this.newest = frame;
  }

  /** The input stored for `frame`, or `0` when the buffer does not hold it. */
  at(frame: number): InputFrame {
    if (!this.has(frame)) return 0;
    return this.slotInputs[frame % this.capacity];
  }

  /**
   * Whether this exact frame is in the buffer. The stored frame number is compared rather
   * than the slot being tested for occupancy, which is what distinguishes a frame from the
   * one a full lap of the ring older that shares its slot.
   */
  has(frame: number): boolean {
    if (frame < 0) return false;
    return this.slotFrames[frame % this.capacity] === frame;
  }

  /** The highest frame ever pushed, or `-1` when nothing has been. */
  newestFrame(): number {
    return this.newest;
  }

  clear(): void {
    this.slotFrames.fill(EMPTY);
    this.slotInputs.fill(0);
    this.newest = EMPTY;
  }
}
