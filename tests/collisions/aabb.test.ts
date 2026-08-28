import { describe, expect, it } from "vitest";
import { boxToWorld, centerOf, intersection, overlaps } from "../../src/combat/collision/aabb";
import type { Box } from "../../src/combat/types";

const box: Box = { x: 10, y: 20, w: 30, h: 40 };

describe("overlaps", () => {
  it("is true when two boxes share area", () => {
    expect(overlaps({ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 5, y0: 5, x1: 15, y1: 15 })).toBe(true);
  });

  it("is false when edges merely touch", () => {
    // Two fighters pushed exactly flush are not still colliding. If this were true the
    // pushbox resolver would have no resting position and would jitter every frame.
    expect(overlaps({ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 10, y0: 0, x1: 20, y1: 10 })).toBe(false);
    expect(overlaps({ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 0, y0: 10, x1: 10, y1: 20 })).toBe(false);
  });

  it("is false when boxes are separated on either axis", () => {
    expect(overlaps({ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 11, y0: 0, x1: 20, y1: 10 })).toBe(false);
    expect(overlaps({ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 0, y0: 11, x1: 10, y1: 20 })).toBe(false);
  });
});

describe("boxToWorld", () => {
  it("places a forward-relative box ahead of a right-facing origin", () => {
    expect(boxToWorld(box, 100, 0, 1)).toEqual({ x0: 110, y0: 20, x1: 140, y1: 60 });
  });

  it("reflects the whole span for a left-facing origin", () => {
    // The far edge becomes the near one: -x - w, not -x. Getting this wrong makes every
    // left-facing attack reach from the wrong end of its own box.
    expect(boxToWorld(box, 100, 0, -1)).toEqual({ x0: 60, y0: 20, x1: 90, y1: 60 });
  });

  it("never mirrors y", () => {
    const right = boxToWorld(box, 0, 7, 1);
    const left = boxToWorld(box, 0, 7, -1);
    expect(right.y0).toBe(left.y0);
    expect(right.y1).toBe(left.y1);
  });

  it("keeps a symmetric box symmetric under mirroring", () => {
    const symmetric: Box = { x: -18, y: 0, w: 36, h: 96 };
    expect(boxToWorld(symmetric, 500, 0, 1)).toEqual(boxToWorld(symmetric, 500, 0, -1));
  });
});

describe("intersection", () => {
  it("returns the shared area", () => {
    expect(intersection({ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 5, y0: 4, x1: 20, y1: 8 })).toEqual({
      x0: 5,
      y0: 4,
      x1: 10,
      y1: 8,
    });
  });

  it("returns null when the boxes only touch", () => {
    expect(intersection({ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 10, y0: 0, x1: 20, y1: 10 })).toBeNull();
  });
});

describe("centerOf", () => {
  it("is an integer, truncated toward the low edge on an odd span", () => {
    const c = centerOf({ x0: 0, y0: 0, x1: 5, y1: 5 });
    expect(c).toEqual({ x: 2, y: 2 });
    expect(Number.isInteger(c.x)).toBe(true);
  });
});
