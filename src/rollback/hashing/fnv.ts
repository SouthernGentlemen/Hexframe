/**
 * The determinism hash.
 *
 * FNV-1a over the serialised state, and nothing else. Hashing the snapshot bytes rather
 * than walking the object means there is one definition of "the state" in the project:
 * anything that changes the hash also changes what a snapshot restores, and anything a
 * snapshot does not carry cannot make two machines disagree about the hash.
 *
 * FNV-1a is not a cryptographic hash and is not asked to be one. It has to be fast, have
 * no dependencies, and produce the same 32 bits from the same bytes on every engine —
 * which `Math.imul` guarantees by doing the multiply as exact 32-bit integer arithmetic
 * instead of through a double.
 */

import { FNV_OFFSET_BASIS, FNV_PRIME } from "../../combat/constants";
import type { SimState } from "../../combat/types";
import { serializeState } from "../snapshots/snapshot";

export function fnv1a32(bytes: Uint8Array): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function hashState(state: SimState): number {
  return fnv1a32(serializeState(state));
}

/** Fixed width, so hashes line up in a log and a leading zero is never lost. */
export function hashToHex(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, "0");
}
