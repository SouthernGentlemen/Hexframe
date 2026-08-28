/**
 * Reads and writes of `SimState.inputHistory`.
 *
 * The history lives in simulation state rather than in a client-side object because the
 * command parser runs inside `Simulation.step()`. A rollback that replays the same frames
 * therefore re-derives the same moves from the same presses, instead of trusting the
 * caller to replay a parser it cannot see.
 */

import type { InputFrame, SimState } from "../../combat/types";
import { INPUT_MASK } from "../../combat/types";
import { COMMAND_HISTORY_FRAMES } from "../../combat/constants";

/**
 * Records one player's input for `frame`.
 *
 * `INPUT_MASK` is applied here because this is the single door into simulation state for
 * input: a bit the engine does not define never reaches the history, and so never reaches
 * a snapshot or a hash. Frames before zero and players outside the match are dropped
 * rather than allowed to create a stray array index.
 */
export function writeInput(
  state: SimState,
  player: number,
  frame: number,
  input: InputFrame,
): void {
  if (frame < 0 || player < 0 || player >= state.inputHistory.length) return;
  state.inputHistory[player][frame % COMMAND_HISTORY_FRAMES] = input & INPUT_MASK;
}

/**
 * One player's input on `frame`, or `0` when the ring cannot honestly answer.
 *
 * The ring keeps one slot per frame modulo `COMMAND_HISTORY_FRAMES`, so the slot holding
 * frame `n` is the same slot that will hold `n + COMMAND_HISTORY_FRAMES` and that held
 * `n - COMMAND_HISTORY_FRAMES`. The newest frame ever written is `state.frame`, because
 * step 1 of the frame loop writes both inputs for the frame being simulated before
 * anything reads them and `state.frame` is not incremented until step 15. The ring
 * therefore holds exactly `state.frame - COMMAND_HISTORY_FRAMES + 1 .. state.frame`.
 *
 * A frame at or below `state.frame - COMMAND_HISTORY_FRAMES` has had its slot overwritten
 * a lap later; a frame above `state.frame` has not been written since the previous lap.
 * Both still contain a perfectly plausible-looking input from exactly one ring lap away,
 * and handing that back would make one press look like a press that repeats every
 * `COMMAND_HISTORY_FRAMES` frames for as long as the match lasts. Neutral with no buttons
 * is the only answer that cannot invent an event that never happened.
 *
 * The mask on the way out costs nothing and keeps a half-initialised history — a row
 * shorter than the ring — reading as neutral instead of leaking `undefined` into the
 * simulation's arithmetic.
 */
export function readInput(state: SimState, player: number, frame: number): InputFrame {
  if (frame < 0 || frame > state.frame) return 0;
  if (frame <= state.frame - COMMAND_HISTORY_FRAMES) return 0;
  if (player < 0 || player >= state.inputHistory.length) return 0;
  return state.inputHistory[player][frame % COMMAND_HISTORY_FRAMES] & INPUT_MASK;
}

/**
 * True when any bit in `bits` went from released to pressed on `frame`.
 *
 * The edge is tested per bit rather than on the group as a whole: with `bits` covering
 * several buttons, pressing medium while light is already held is a new press, and
 * `(now & bits) !== 0 && (before & bits) === 0` would miss it.
 *
 * At the oldest frame the ring can answer, the frame before it reads as neutral, so a
 * button held across that boundary reads as freshly pressed. The command parser never
 * sees this: it looks back `INPUT_BUFFER_FRAMES` frames, far inside the ring.
 */
export function pressedOn(
  state: SimState,
  player: number,
  frame: number,
  bits: number,
): boolean {
  const now = readInput(state, player, frame);
  const before = readInput(state, player, frame - 1);
  return (now & ~before & bits) !== 0;
}

/** True when any bit in `bits` is held on `frame`. */
export function heldOn(
  state: SimState,
  player: number,
  frame: number,
  bits: number,
): boolean {
  return (readInput(state, player, frame) & bits) !== 0;
}
