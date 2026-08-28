import type { MoveDef } from "../../combat/types";
import { fmt, SVG_NS } from "./stage";

export type MoveEffectKind = "fire" | "poison" | "freeze" | "shock" | "bleed" | "void" | "physical" | "prism";

export interface MoveEffectProfile {
  kind: MoveEffectKind;
  primary: string;
  secondary: string;
  count: number;
  radius: number;
  spin: number;
  rotation: number;
  shape: number;
}

const COLORS: Record<MoveEffectKind, readonly [string, string]> = {
  fire: ["#ff9a4d", "#ffd36a"],
  poison: ["#b8ea63", "#65e6b1"],
  freeze: ["#78dcff", "#e0f8ff"],
  shock: ["#c68cff", "#fff06a"],
  bleed: ["#ff627f", "#ffb0bc"],
  void: ["#9478ff", "#67e4da"],
  physical: ["#f1d29a", "#ffffff"],
  prism: ["#ffffff", "#8fffe0"],
};

/** A stable visual signature. Presentation may vary by id; combat never reads it. */
export function moveEffectProfile(moveId: number, tags: readonly string[]): MoveEffectProfile {
  const kind = effectKind(tags);
  const colors = COLORS[kind];
  return {
    kind,
    primary: colors[0],
    secondary: colors[1],
    count: 4 + (moveId % 6),
    radius: 18 + ((moveId * 7) % 19),
    spin: (moveId % 2 === 0 ? 1 : -1) * (3 + (moveId % 5)),
    rotation: (moveId * 17) % 360,
    shape: moveId % 4,
  };
}

export function drawMoveParticles(
  layer: SVGGElement,
  move: MoveDef,
  x: number,
  y: number,
  facing: number,
  frame: number,
  scale = 1,
): void {
  const profile = moveEffectProfile(move.id, move.tags);
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", `move-particles effect-${profile.kind} move-effect-${move.id}`);
  group.setAttribute("data-move-id", String(move.id));
  group.setAttribute("transform", `translate(${fmt(x + facing * (28 + move.id % 11))} ${fmt(y - 48 - move.id % 17)}) scale(${fmt(scale)})`);

  const core = document.createElementNS(SVG_NS, "circle");
  core.setAttribute("class", "move-particle move-particle-core");
  core.setAttribute("r", fmt(5 + ((move.id + frame) % 5)));
  core.setAttribute("fill", "none");
  core.setAttribute("stroke", profile.secondary);
  core.setAttribute("stroke-width", "1.5");
  group.appendChild(core);

  const pulse = (frame % 8) * 0.7;
  for (let index = 0; index < profile.count; index++) {
    const degrees = profile.rotation + (360 / profile.count) * index + frame * profile.spin;
    const radians = degrees * Math.PI / 180;
    const orbit = profile.radius + pulse + (index % 3) * 4;
    const px = Math.cos(radians) * orbit;
    const py = Math.sin(radians) * orbit * 0.72;
    group.appendChild(particleShape(profile, move.id, index, px, py, degrees));
  }
  layer.appendChild(group);
}

export function styleImpact(group: SVGGElement, move: MoveDef): MoveEffectProfile {
  const profile = moveEffectProfile(move.id, move.tags);
  group.setAttribute("class", `contact-burst effect-${profile.kind} move-effect-${move.id}`);
  group.setAttribute("data-move-id", String(move.id));
  group.style.color = profile.primary;
  return profile;
}

function effectKind(tags: readonly string[]): MoveEffectKind {
  if (tags.includes("elemental")) return "prism";
  if (tags.includes("fire") || tags.includes("burn")) return "fire";
  if (tags.includes("chaos") || tags.includes("poison")) return "poison";
  if (tags.includes("cold") || tags.includes("freeze")) return "freeze";
  if (tags.includes("lightning") || tags.includes("shock")) return "shock";
  if (tags.includes("bleed")) return "bleed";
  if (tags.includes("void")) return "void";
  return "physical";
}

function particleShape(
  profile: MoveEffectProfile,
  moveId: number,
  index: number,
  x: number,
  y: number,
  degrees: number,
): SVGElement {
  const shape = (profile.shape + index) % 4;
  const color = index % 2 === 0 ? profile.primary : profile.secondary;
  if (shape === 0) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", "move-particle particle-orb");
    circle.setAttribute("cx", fmt(x));
    circle.setAttribute("cy", fmt(y));
    circle.setAttribute("r", fmt(2 + ((moveId + index) % 4)));
    circle.setAttribute("fill", color);
    return circle;
  }
  if (shape === 1) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("class", "move-particle particle-streak");
    line.setAttribute("x1", fmt(x * 0.55));
    line.setAttribute("y1", fmt(y * 0.55));
    line.setAttribute("x2", fmt(x));
    line.setAttribute("y2", fmt(y));
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", fmt(1 + (moveId % 3)));
    return line;
  }
  const polygon = document.createElementNS(SVG_NS, "polygon");
  polygon.setAttribute("class", `move-particle ${shape === 2 ? "particle-shard" : "particle-rune"}`);
  polygon.setAttribute("points", shape === 2 ? "0,-6 3,0 0,6 -3,0" : "0,-5 5,4 -5,4");
  polygon.setAttribute("fill", shape === 2 ? color : "none");
  polygon.setAttribute("stroke", color);
  polygon.setAttribute("stroke-width", "1");
  polygon.setAttribute("transform", `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(degrees)})`);
  return polygon;
}
