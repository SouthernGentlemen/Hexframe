/**
 * The simulation's only source of randomness.
 *
 * A 32-bit xorshift, seeded from the match configuration and carried in `SimState`. It is
 * part of the state rather than a module-level variable precisely so that a rollback
 * restores it: replaying frame 401 has to make the same rolls it made the first time, and
 * a generator living outside the snapshot would quietly desynchronise the moment anything
 * used it.
 *
 * Nothing in 0.1 rolls anything. It is here now because retrofitting determinism onto a
 * generator that has already been used in a dozen places is not a thing anyone does
 * successfully.
 */

import type { SimState } from "../types";

/**
 * Xorshift is a fixed point at zero — it would return zero forever. A seed of zero is a
 * perfectly reasonable thing for a caller to pass, so it is substituted here rather than
 * rejected. The constant is arbitrary and only has to be non-zero.
 */
const ZERO_SEED_SUBSTITUTE = 0x9e3779b9 | 0;

/** Advance the generator and return a non-negative 31-bit integer. */
export function nextRandom(state: SimState): number {
  let x = state.rng | 0;
  if (x === 0) x = ZERO_SEED_SUBSTITUTE;
  x ^= x << 13;
  x |= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x |= 0;
  state.rng = x | 0;
  // The sign bit is dropped rather than the value being coerced with `>>> 0`, because a
  // caller asking for a number wants one it can do integer arithmetic on without meeting
  // a value above 2^31 that turns negative the moment it meets a bitwise operator.
  return x & 0x7fffffff;
}

/**
 * A uniform integer in `[lo, hi]`, inclusive.
 *
 * The modulo introduces a bias of about one part in 2^31 across the range, which is far
 * below anything a game can express and identical on every machine — which is the only
 * property that matters for a value that has to be reproduced exactly during a rollback.
 */
export function randomRange(state: SimState, lo: number, hi: number): number {
  if (hi <= lo) return lo;
  const span = hi - lo + 1;
  return lo + (nextRandom(state) % span);
}
