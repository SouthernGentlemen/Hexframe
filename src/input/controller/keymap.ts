/**
 * Physical keys to input bits.
 *
 * Keys are identified by `KeyboardEvent.code`, the physical position, and never by `key`.
 * `code` does not change with the layout or with a modifier, so an AZERTY player's left
 * hand lands on the same four keys as a QWERTY player's and shift does not silently
 * rebind anything.
 */

import { InputBit } from "../../combat/types";

/** `KeyboardEvent.code` → `InputBit`. Several codes may map to the same bit. */
export interface KeyMap {
  [code: string]: number;
}

/** Left hand on WASD, right hand on the attack row. */
export const DEFAULT_KEYMAP_P1: KeyMap = {
  KeyW: InputBit.Up,
  KeyA: InputBit.Left,
  KeyS: InputBit.Down,
  KeyD: InputBit.Right,
  KeyJ: InputBit.Light,
  KeyK: InputBit.Medium,
  KeyL: InputBit.Heavy,
  KeyU: InputBit.Throw,
};

/**
 * The arrow cluster and the numeric keypad, so two players can share one keyboard in the
 * lab without either hand crossing the other.
 */
export const DEFAULT_KEYMAP_P2: KeyMap = {
  ArrowUp: InputBit.Up,
  ArrowLeft: InputBit.Left,
  ArrowDown: InputBit.Down,
  ArrowRight: InputBit.Right,
  Numpad1: InputBit.Light,
  Numpad2: InputBit.Medium,
  Numpad3: InputBit.Heavy,
  Numpad0: InputBit.Throw,
};
