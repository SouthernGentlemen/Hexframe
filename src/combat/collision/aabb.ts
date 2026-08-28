/**
 * Axis-aligned box arithmetic, and the one place a fighter-local box becomes a world one.
 */

import type { Aabb, Box, Facing } from "../types";

/**
 * True when two boxes share area.
 *
 * Touching edges do **not** overlap. Two fighters pushed apart until their pushboxes are
 * exactly flush are not still colliding, and a hitbox whose leading edge has just reached
 * a hurtbox's trailing edge has not connected. Strict comparison is what makes the
 * separation the pushbox resolver computes a stable resting position rather than a state
 * it oscillates around.
 */
export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** The shared area of two boxes, or `null` when they do not overlap. */
export function intersection(a: Aabb, b: Aabb): Aabb | null {
  if (!overlaps(a, b)) return null;
  return {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  };
}

/**
 * Place a fighter-local box into the world.
 *
 * This is the only mirroring in the project, which is why a move is authored once instead
 * of as a left-facing and a right-facing pair. A local `x` measures *forward* from the
 * fighter's ground origin, so facing left reflects the whole span about the origin: the
 * far edge becomes the near one, hence `-x - w` rather than `-x`. `y` never mirrors,
 * because gravity does not care which way anyone is looking.
 */
export function boxToWorld(box: Box, originX: number, originY: number, facing: Facing): Aabb {
  const x0 = facing === 1 ? originX + box.x : originX - box.x - box.w;
  const y0 = originY + box.y;
  return { x0, y0, x1: x0 + box.w, y1: y0 + box.h };
}

/**
 * The integer centre of a box.
 *
 * `Math.trunc` on a non-negative width is a floor, so the centre of an odd-width box sits
 * one unit below true centre — a hundredth of a pixel, and always in the same direction on
 * every machine, which is the property that actually matters here.
 */
export function centerOf(a: Aabb): { x: number; y: number } {
  return {
    x: a.x0 + Math.trunc((a.x1 - a.x0) / 2),
    y: a.y0 + Math.trunc((a.y1 - a.y0) / 2),
  };
}
