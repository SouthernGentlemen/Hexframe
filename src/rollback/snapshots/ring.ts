/**
 * A fixed-size history of past states, addressed by frame number.
 *
 * Slots are chosen by `frame % capacity` rather than by a write cursor, so saving frame
 * `f` always evicts frame `f - capacity` and `has`/`load` stay a single lookup. The cost
 * is that the ring holds a window, not a set: a caller that saves frames out of order
 * gets exactly what the modular arithmetic says it gets, and asking for an evicted frame
 * answers "no" rather than answering with the wrong state.
 *
 * States are stored serialised rather than as live objects. That costs a serialise on
 * save and a deserialise on load, and buys two things worth more: a stored snapshot
 * cannot be mutated later through a reference the caller kept, and what is stored is
 * byte-for-byte what the hash was taken over, so a snapshot that restores wrong is a bug
 * in one place instead of in two.
 */

import type { SimState } from "../../combat/types";
import { deserializeState, serializeState } from "./snapshot";

/** Frame numbers are never negative, so -1 is free to mean "this slot holds nothing". */
const EMPTY = -1;

export class SnapshotRing {
  private readonly capacity: number;
  private readonly slotFrames: Int32Array;
  private readonly slotBytes: (Uint8Array | null)[];

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`SnapshotRing: capacity must be a positive integer, got ${capacity}`);
    }
    this.capacity = capacity;
    this.slotFrames = new Int32Array(capacity).fill(EMPTY);
    this.slotBytes = new Array<Uint8Array | null>(capacity).fill(null);
  }

  save(frame: number, state: SimState): void {
    if (!Number.isInteger(frame) || frame < 0) {
      throw new RangeError(`SnapshotRing: frame must be a non-negative integer, got ${frame}`);
    }
    const slot = frame % this.capacity;
    this.slotFrames[slot] = frame;
    this.slotBytes[slot] = serializeState(state);
  }

  has(frame: number): boolean {
    if (!Number.isInteger(frame) || frame < 0) return false;
    return this.slotFrames[frame % this.capacity] === frame;
  }

  load(frame: number): SimState | null {
    if (!this.has(frame)) return null;
    const bytes = this.slotBytes[frame % this.capacity];
    if (bytes === null) return null;
    // A fresh state every call, on purpose: two callers loading the same frame must not
    // end up sharing fighter objects that one of them is about to simulate forward.
    return deserializeState(bytes);
  }

  oldestFrame(): number {
    let oldest = EMPTY;
    for (let i = 0; i < this.capacity; i++) {
      const frame = this.slotFrames[i];
      if (frame === EMPTY) continue;
      if (oldest === EMPTY || frame < oldest) oldest = frame;
    }
    return oldest;
  }

  newestFrame(): number {
    let newest = EMPTY;
    for (let i = 0; i < this.capacity; i++) {
      const frame = this.slotFrames[i];
      if (frame > newest) newest = frame;
    }
    return newest;
  }

  clear(): void {
    this.slotFrames.fill(EMPTY);
    for (let i = 0; i < this.capacity; i++) {
      this.slotBytes[i] = null;
    }
  }
}
