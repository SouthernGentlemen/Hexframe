import type { InputFrame } from "../../combat/types";
import { actionBit, INPUT_MASK, InputBit } from "../../combat/types";

export interface GamepadSource {
  getGamepads(): (Gamepad | null)[];
}

export interface GamepadUiState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
  menu: boolean;
  start: boolean;
  leftBumper: boolean;
  rightBumper: boolean;
}

const AXIS_THRESHOLD = 0.45;
const PRESSED_THRESHOLD = 0.5;

function pressed(pad: Gamepad, index: number): boolean {
  const button = pad.buttons[index];
  return button?.pressed === true || (button?.value ?? 0) >= PRESSED_THRESHOLD;
}

/** Polls one standard-layout gamepad into the same deterministic frame as the keyboard. */
export class GamepadController {
  private readonly index: number;
  private readonly source: GamepadSource;

  constructor(index = 0, source: GamepadSource = navigator) {
    this.index = index;
    this.source = source;
  }

  get connected(): boolean {
    return this.pad() !== null;
  }

  get name(): string {
    return this.pad()?.id ?? "No gamepad";
  }

  sample(): InputFrame {
    const pad = this.pad();
    if (!pad) return 0;
    let bits = 0;

    const horizontal = pad.axes[0] ?? 0;
    const vertical = pad.axes[1] ?? 0;
    if (pressed(pad, 12) || vertical <= -AXIS_THRESHOLD) bits |= InputBit.Up;
    if (pressed(pad, 13) || vertical >= AXIS_THRESHOLD) bits |= InputBit.Down;
    if (pressed(pad, 14) || horizontal <= -AXIS_THRESHOLD) bits |= InputBit.Left;
    if (pressed(pad, 15) || horizontal >= AXIS_THRESHOLD) bits |= InputBit.Right;

    const leftTrigger = pressed(pad, 6);
    const rightTrigger = pressed(pad, 7);
    const bank = (leftTrigger ? 1 : 0) + (rightTrigger ? 2 : 0);
    // Spatial diamond: Y/X/B/A maps to ↑/←/→/↓, matching the keyboard arrow cluster.
    const faceToPosition: readonly [number, number][] = [
      [3, 0],
      [2, 1],
      [1, 2],
      [0, 3],
    ];
    for (const [button, position] of faceToPosition) {
      if (pressed(pad, button)) bits |= actionBit(bank * 4 + position);
    }
    return bits & INPUT_MASK;
  }

  sampleUi(): GamepadUiState {
    const pad = this.pad();
    if (!pad) return {
      up: false, down: false, left: false, right: false,
      confirm: false, back: false, menu: false, start: false,
      leftBumper: false, rightBumper: false,
    };
    const horizontal = pad.axes[0] ?? 0;
    const vertical = pad.axes[1] ?? 0;
    return {
      up: pressed(pad, 12) || vertical <= -AXIS_THRESHOLD,
      down: pressed(pad, 13) || vertical >= AXIS_THRESHOLD,
      left: pressed(pad, 14) || horizontal <= -AXIS_THRESHOLD,
      right: pressed(pad, 15) || horizontal >= AXIS_THRESHOLD,
      confirm: pressed(pad, 0),
      back: pressed(pad, 1),
      menu: pressed(pad, 8),
      start: pressed(pad, 9),
      leftBumper: pressed(pad, 4),
      rightBumper: pressed(pad, 5),
    };
  }

  private pad(): Gamepad | null {
    const pads = this.source.getGamepads();
    const preferred = pads[this.index];
    if (preferred?.connected && preferred.mapping === "standard") return preferred;
    for (const pad of pads) {
      if (pad?.connected && pad.mapping === "standard") return pad;
    }
    return null;
  }
}
