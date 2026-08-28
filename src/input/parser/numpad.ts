/**
 * Absolute directions to facing-relative numpad notation.
 *
 *     7 8 9        9 is up-forward, 6 is forward, 3 is down-forward,
 *     4 5 6        4 is backward, 5 is neutral.
 *     1 2 3
 *
 * Inputs are stored and networked as absolute left and right, because that is what the
 * player physically did and it stays true when a rollback changes which way the fighter
 * was facing. The conversion to forward and back happens here, at the moment a command is
 * matched, and nowhere else.
 */

import type { Facing, InputFrame } from "../../combat/types";
import { InputBit } from "../../combat/types";

/** The numpad digit for a fighter with no direction held. */
const NEUTRAL = 5;

/**
 * `1` forward, `-1` backward, `0` neither.
 *
 * Left and right held together cancel. A stuck keyboard or a player rolling their thumb
 * across a stick gate should read as neutral rather than as whichever bit the engine
 * happens to test first, and the same rule applied to both axes is one rule to remember.
 */
function horizontalOf(input: InputFrame, facing: Facing): number {
  const left = (input & InputBit.Left) !== 0;
  const right = (input & InputBit.Right) !== 0;
  if (left === right) return 0;
  const towardIncreasingX = right ? 1 : -1;
  return facing === 1 ? towardIncreasingX : -towardIncreasingX;
}

/** `1` up, `-1` down, `0` neither. Up and down held together cancel. */
function verticalOf(input: InputFrame): number {
  const up = (input & InputBit.Up) !== 0;
  const down = (input & InputBit.Down) !== 0;
  if (up === down) return 0;
  return up ? 1 : -1;
}

/** The facing-relative numpad digit, `1` to `9`, for one input frame. `5` is neutral. */
export function numpadOf(input: InputFrame, facing: Facing): number {
  return NEUTRAL + horizontalOf(input, facing) + verticalOf(input) * 3;
}

/** True when the fighter is holding toward the direction it faces. */
export function isForward(input: InputFrame, facing: Facing): boolean {
  return horizontalOf(input, facing) === 1;
}

/** True when the fighter is holding away from the direction it faces — the block direction. */
export function isBackward(input: InputFrame, facing: Facing): boolean {
  return horizontalOf(input, facing) === -1;
}
