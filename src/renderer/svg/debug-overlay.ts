import type { Aabb, DebugBoxes, SimState } from "../../combat/types";
import { SCALE } from "../../combat/constants";
import { SVG_NS, fmt, worldToScreen } from "./stage";

export interface DebugToggles {
  hitboxes: boolean;
  hurtboxes: boolean;
  pushboxes: boolean;
  origins: boolean;
  skeleton: boolean;
  boneNames: boolean;
  velocity: boolean;
}

function box(layer: SVGGElement, aabb: Aabb, className: string): void {
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", fmt(aabb.x0 / SCALE));
  rect.setAttribute("y", fmt(-aabb.y1 / SCALE));
  rect.setAttribute("width", fmt((aabb.x1 - aabb.x0) / SCALE));
  rect.setAttribute("height", fmt((aabb.y1 - aabb.y0) / SCALE));
  rect.setAttribute("class", className);
  layer.appendChild(rect);
}

function line(
  layer: SVGGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  className: string,
): void {
  const el = document.createElementNS(SVG_NS, "line");
  el.setAttribute("x1", fmt(x1));
  el.setAttribute("y1", fmt(y1));
  el.setAttribute("x2", fmt(x2));
  el.setAttribute("y2", fmt(y2));
  el.setAttribute("class", className);
  layer.appendChild(el);
}

/** Rebuilds the intentionally small debug layer from authoritative simulation boxes. */
export function drawDebug(
  layer: SVGGElement,
  boxes: DebugBoxes,
  state: SimState,
  toggles: DebugToggles,
): void {
  layer.replaceChildren();

  if (toggles.pushboxes) {
    for (const value of boxes.pushboxes) box(layer, value, "debug-box debug-pushbox");
  }
  if (toggles.hurtboxes) {
    for (const values of boxes.hurtboxes) {
      for (const value of values) box(layer, value, "debug-box debug-hurtbox");
    }
  }
  if (toggles.hitboxes) {
    for (const values of boxes.hitboxes) {
      for (const value of values) box(layer, value, "debug-box debug-hitbox");
    }
  }

  for (let player = 0; player < boxes.origins.length; player++) {
    const origin = boxes.origins[player];
    const screen = worldToScreen(origin.x, origin.y);
    if (toggles.origins) {
      line(layer, screen.x - 6, screen.y, screen.x + 6, screen.y, "debug-origin");
      line(layer, screen.x, screen.y - 6, screen.x, screen.y + 6, "debug-origin");
    }
    if (toggles.velocity) {
      const fighter = state.fighters[player];
      const end = worldToScreen(origin.x + fighter.vx * 5, origin.y + fighter.vy * 5);
      line(layer, screen.x, screen.y, end.x, end.y, "debug-velocity");
    }
  }
}
