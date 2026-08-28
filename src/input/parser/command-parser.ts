/**
 * The command parser: which move, if any, a player has just asked for.
 *
 * Everything here is pure. It reads `SimState.inputHistory` and the fighter, and writes
 * nothing at all — not the fighter, not the history, not a cache. That is what lets the
 * frame loop call it during a rollback re-simulation and get the same answer it got the
 * first time, and it is why consuming the buffer is the caller's job rather than a side
 * effect hidden in here.
 */

import type { CharacterDef, CommandDef, FighterState, SimState } from "../../combat/types";
import { INPUT_BUFFER_FRAMES, NO_MOVE } from "../../combat/constants";
import { isCrouching } from "../../combat/state/machine";
import { pressedOn, readInput } from "../buffer/history";
import { numpadOf } from "./numpad";

/** The numpad digit for no direction held; see `numpadOf`. */
const NEUTRAL = 5;

/**
 * The move id the player has asked for on `state.frame`, or `NO_MOVE`.
 *
 * Commands are considered in descending `priority` and the first one that matches wins,
 * so a character can offer the crouching version of a button at a higher priority than
 * the standing one and let the stance decide. Equal priorities are settled by declaration
 * order, which is deterministic without sorting a copy of the array on every frame.
 *
 * The returned move is a request, not a promise: the caller still asks `canStartMove`
 * whether the fighter may have it. A request the fighter cannot honour yet is left
 * unconsumed on purpose, so a button pressed during recovery still comes out on the first
 * actionable frame — that is the whole point of the buffer.
 */
export function resolveCommand(
  state: SimState,
  player: number,
  c: CharacterDef,
  f: FighterState,
): number {
  let best: CommandDef | null = null;
  for (const cmd of c.commands) {
    if (best !== null && cmd.priority <= best.priority) continue;
    if (matchedPressFrame(state, player, f, cmd) < 0) continue;
    best = cmd;
  }
  return best === null ? NO_MOVE : best.moveId;
}

/**
 * The frame of the press `resolveCommand` matched for `moveId`, or `-1` if nothing
 * matches. This exists because the parser cannot tell the caller anything by mutating it:
 * the caller needs the press frame to write into `FighterState.bufferConsumedFrame`, and
 * that is what stops one press from starting the same move on every frame of its buffer
 * window. Call it with the id `resolveCommand` just returned.
 *
 * Restricting the scan to commands carrying `moveId` reaches the same command
 * `resolveCommand` chose: the winner has that move id and was the highest-priority match
 * overall, so it is also the highest-priority match among the commands sharing it.
 */
export function commandPressFrame(
  state: SimState,
  player: number,
  c: CharacterDef,
  f: FighterState,
  moveId: number,
): number {
  let best: CommandDef | null = null;
  let bestFrame = -1;
  for (const cmd of c.commands) {
    if (cmd.moveId !== moveId) continue;
    if (best !== null && cmd.priority <= best.priority) continue;
    const frame = matchedPressFrame(state, player, f, cmd);
    if (frame < 0) continue;
    best = cmd;
    bestFrame = frame;
  }
  return bestFrame;
}

/**
 * The newest frame in the buffer window on which this command was asked for, or `-1`.
 *
 * The window is `INPUT_BUFFER_FRAMES` frames ending at the frame being simulated — four
 * frames counting the current one — and it starts after `bufferConsumedFrame`, so a press
 * that has already produced a move is invisible however much of its window is left.
 * Newest first rather than oldest first: the buffer holds what the player most recently
 * asked for, and if two presses are still live the fresher one is the one they meant.
 *
 * A command whose `buttons` mask is empty can never match, since there is no press edge to
 * find. That is the contract's definition of eligibility, not an oversight here.
 */
function matchedPressFrame(
  state: SimState,
  player: number,
  f: FighterState,
  cmd: CommandDef,
): number {
  if (cmd.requiresCrouch && !isCrouching(f)) return -1;
  if (cmd.requiresAir && f.airborne !== 1) return -1;

  const oldest = Math.max(
    state.frame - INPUT_BUFFER_FRAMES + 1,
    f.bufferConsumedFrame + 1,
    0,
  );
  for (let frame = state.frame; frame >= oldest; frame--) {
    if (!pressedOn(state, player, frame, cmd.buttons)) continue;
    if (cmd.motion.length > 0) {
      if (!motionSatisfied(state, player, f, cmd.motion, cmd.motionWindow, frame)) continue;
    }
    return frame;
  }
  return -1;
}

/**
 * True when `motion`'s numpad digits were entered, in order, in the `window` frames ending
 * at `frame` — `frame` being the button press the motion belongs to.
 *
 * The walk runs backwards from the press and looks for the digits in reverse, because that
 * is the direction in which the answer is usually decided in the first few frames and it
 * needs no scan for a starting point. Between two digits it tolerates neutral frames and
 * repeats of the digit it has just taken, which is what a player holding down-forward for
 * six frames actually produces. Any other direction ends the walk: a motion interrupted by
 * a direction that is not part of it was not that motion, and being lenient there is how a
 * parser starts giving people specials they did not ask for.
 *
 * Frames outside the ring read as neutral, so a `window` longer than the history cannot
 * match on invented data — it simply runs out of digits and fails. A `window` of zero
 * leaves no frames to search and so fails for any non-empty motion.
 *
 * Every frame in the walk is converted with the fighter's *current* facing. Historical
 * facings are not part of the state, and re-deriving them would make the parse depend on
 * something a rollback cannot restore.
 */
export function motionSatisfied(
  state: SimState,
  player: number,
  f: FighterState,
  motion: number[],
  window: number,
  frame: number,
): boolean {
  if (motion.length === 0) return true;

  const oldest = Math.max(frame - window + 1, 0);
  let need = motion.length - 1;
  for (let at = frame; at >= oldest; at--) {
    const digit = numpadOf(readInput(state, player, at), f.facing);
    if (digit === motion[need]) {
      need--;
      if (need < 0) return true;
      continue;
    }
    if (digit === NEUTRAL) continue;
    if (need < motion.length - 1 && digit === motion[need + 1]) continue;
    return false;
  }
  return false;
}
