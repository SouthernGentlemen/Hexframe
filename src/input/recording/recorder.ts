import type { InputFrame } from "../../combat/types";
import { INPUT_MASK } from "../../combat/types";

export interface RecordedInputs {
  version: number;
  startFrame: number;
  frames: number[][];
}

const RECORDING_VERSION = 1;

/** Frame-addressed input capture used by the lab's dummy recorder. */
export class InputRecorder {
  private active = false;
  private startAt = 0;
  private rows: number[][] = [];

  get recording(): boolean {
    return this.active;
  }

  start(frame: number): void {
    this.active = true;
    this.startAt = Math.max(0, Math.trunc(frame));
    this.rows = [];
  }

  record(frame: number, inputs: readonly InputFrame[]): void {
    if (!this.active || frame < this.startAt) return;
    const index = Math.trunc(frame) - this.startAt;
    while (this.rows.length <= index) this.rows.push([]);
    this.rows[index] = inputs.map((input) => input & INPUT_MASK);
  }

  stop(): RecordedInputs {
    const result = {
      version: RECORDING_VERSION,
      startFrame: this.startAt,
      frames: this.rows.map((row) => row.slice()),
    };
    this.active = false;
    return result;
  }
}

/** Read-only replay of a captured sequence, optionally looped. */
export class InputPlayback {
  private readonly data: RecordedInputs;
  private readonly loop: boolean;

  constructor(data: RecordedInputs, loop: boolean) {
    if (data.version !== RECORDING_VERSION) {
      throw new RangeError(`InputPlayback: unsupported recording version ${data.version}`);
    }
    this.data = {
      version: data.version,
      startFrame: data.startFrame,
      frames: data.frames.map((row) => row.slice()),
    };
    this.loop = loop;
  }

  get length(): number {
    return this.data.frames.length;
  }

  at(frame: number, player: number): InputFrame | null {
    if (this.length === 0 || player < 0) return null;
    let index = Math.trunc(frame) - this.data.startFrame;
    if (this.loop) {
      index = ((index % this.length) + this.length) % this.length;
    } else if (index < 0 || index >= this.length) {
      return null;
    }
    return (this.data.frames[index]?.[player] ?? 0) & INPUT_MASK;
  }
}
