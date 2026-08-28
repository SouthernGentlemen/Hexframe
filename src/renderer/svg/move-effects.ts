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
  effect: string;
  trail: string;
  impact: string;
}

export interface MoveVisualDefinition {
  effect: string;
  trail: string;
  impact: string;
  offsetX: number;
  offsetY: number;
}

/** Presentation vocabulary keyed by technique, kept entirely outside combat MoveDef. */
export const MOVE_VISUALS: Readonly<Record<string, MoveVisualDefinition>> = {
  standing_light: { effect: "knuckle_flash", trail: "short_speed_lines", impact: "white_cross", offsetX: 46, offsetY: -62 },
  crouching_light: { effect: "low_streak", trail: "floor_dust", impact: "low_cross", offsetX: 42, offsetY: -30 },
  ember_palm: { effect: "palm_burst", trail: "embers", impact: "fire_disc", offsetX: 58, offsetY: -61 },
  venom_fang: { effect: "fang_streak", trail: "venom_thread", impact: "needle_burst", offsetX: 56, offsetY: -60 },
  frost_heel: { effect: "heel_comet", trail: "ice_dust", impact: "ice_star", offsetX: 72, offsetY: -73 },
  storm_knuckle: { effect: "lightning_bolt", trail: "charge_sparks", impact: "electric_cross", offsetX: 62, offsetY: -62 },
  crimson_arc: { effect: "slash_arc", trail: "blood_ribbon", impact: "red_crescent", offsetX: 57, offsetY: -59 },
  rift_uppercut: { effect: "rising_rift", trail: "void_column", impact: "vertical_tear", offsetX: 30, offsetY: -78 },
  bastion_break: { effect: "ground_break", trail: "stone_chips", impact: "stone_crack", offsetX: 64, offsetY: -32 },
  shadow_step: { effect: "afterimages", trail: "shadow_echoes", impact: "void_displacement", offsetX: 34, offsetY: -53 },
  ashen_sweep: { effect: "ground_arc", trail: "flame_floor", impact: "ember_spray", offsetX: 62, offsetY: -18 },
  glacier_spike: { effect: "vertical_shards", trail: "frost_mist", impact: "ice_pillars", offsetX: 52, offsetY: -50 },
  static_rush: { effect: "electric_afterimages", trail: "ion_wake", impact: "voltage_burst", offsetX: 48, offsetY: -53 },
  toxic_bloom: { effect: "poison_bloom", trail: "spore_ring", impact: "toxin_flower", offsetX: 27, offsetY: -53 },
  blood_moon: { effect: "blood_crescent", trail: "red_droplets", impact: "moon_slash", offsetX: 55, offsetY: -66 },
  void_hook: { effect: "void_tether", trail: "tether_motes", impact: "hook_snap", offsetX: 72, offsetY: -58 },
  iron_reversal: { effect: "reversal_flare", trail: "iron_sparks", impact: "iron_cross", offsetX: 30, offsetY: -68 },
  phoenix_drive: { effect: "rising_spiral", trail: "phoenix_feathers", impact: "fire_spiral", offsetX: 38, offsetY: -72 },
  permafrost: { effect: "frost_wave", trail: "ground_rime", impact: "frozen_surge", offsetX: 70, offsetY: -20 },
  plague_touch: { effect: "hand_aura", trail: "lingering_cloud", impact: "plague_mark", offsetX: 57, offsetY: -58 },
  thunder_clap: { effect: "shock_ring", trail: "radial_arcs", impact: "thunder_ring", offsetX: 37, offsetY: -58 },
  reaper_kick: { effect: "scythe_impact", trail: "heel_crescent", impact: "reaper_arc", offsetX: 74, offsetY: -73 },
  eclipse_breaker: { effect: "dark_crescent", trail: "umbral_fall", impact: "eclipse_wave", offsetX: 62, offsetY: -50 },
  prism_burst: { effect: "prism_star", trail: "spectrum_rays", impact: "prismatic_burst", offsetX: 37, offsetY: -58 },
  astral_jab: { effect: "astral_streak", trail: "star_motes", impact: "astral_point", offsetX: 57, offsetY: -61 },
  witch_knee: { effect: "knee_miasma", trail: "witch_smoke", impact: "poison_knot", offsetX: 47, offsetY: -47 },
  meteor_heel: { effect: "heel_descent", trail: "falling_embers", impact: "meteor_splash", offsetX: 47, offsetY: -25 },
  void_dive: { effect: "dive_wake", trail: "split_afterimage", impact: "void_crater", offsetX: 52, offsetY: -38 },
};

const DEFAULT_VISUAL: MoveVisualDefinition = {
  effect: "impact_orbit",
  trail: "dust",
  impact: "physical_burst",
  offsetX: 44,
  offsetY: -52,
};

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
export function moveEffectProfile(
  moveId: number,
  tags: readonly string[],
  moveKey = "",
): MoveEffectProfile {
  const kind = effectKind(tags);
  const colors = COLORS[kind];
  const visual = MOVE_VISUALS[moveKey] ?? DEFAULT_VISUAL;
  return {
    kind,
    primary: colors[0],
    secondary: colors[1],
    count: 4 + (moveId % 6),
    radius: 18 + ((moveId * 7) % 19),
    spin: (moveId % 2 === 0 ? 1 : -1) * (3 + (moveId % 5)),
    rotation: (moveId * 17) % 360,
    shape: moveId % 4,
    effect: visual.effect,
    trail: visual.trail,
    impact: visual.impact,
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
  const profile = moveEffectProfile(move.id, move.tags, move.key);
  const visual = MOVE_VISUALS[move.key] ?? DEFAULT_VISUAL;
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", `move-particles effect-${profile.kind} move-effect-${move.id}`);
  group.setAttribute("data-move-id", String(move.id));
  group.setAttribute("data-effect", visual.effect);
  group.setAttribute("data-trail", visual.trail);
  group.setAttribute("data-impact", visual.impact);
  group.setAttribute("transform", `translate(${fmt(x + facing * visual.offsetX)} ${fmt(y + visual.offsetY)}) scale(${fmt(scale)})`);

  drawTechniqueMotif(group, visual.effect, profile, facing, frame);

  const core = document.createElementNS(SVG_NS, "circle");
  core.setAttribute("class", "move-particle move-particle-core");
  core.setAttribute("r", fmt(5 + ((move.id + frame) % 5)));
  core.setAttribute("fill", "none");
  core.setAttribute("stroke", profile.secondary);
  core.setAttribute("stroke-width", "1.5");
  group.appendChild(core);

  const pulse = (frame % 8) * 0.45;
  const ambientCount = Math.max(2, Math.floor(profile.count / 2));
  for (let index = 0; index < ambientCount; index++) {
    const degrees = profile.rotation + (360 / ambientCount) * index + frame * profile.spin;
    const radians = degrees * Math.PI / 180;
    const orbit = profile.radius + pulse + (index % 3) * 4;
    const px = Math.cos(radians) * orbit;
    const py = Math.sin(radians) * orbit * 0.72;
    group.appendChild(particleShape(profile, move.id, index, px, py, degrees));
  }
  layer.appendChild(group);
}

export function styleImpact(group: SVGGElement, move: MoveDef): MoveEffectProfile {
  const profile = moveEffectProfile(move.id, move.tags, move.key);
  group.setAttribute("class", `contact-burst effect-${profile.kind} move-effect-${move.id}`);
  group.setAttribute("data-move-id", String(move.id));
  group.setAttribute("data-impact", profile.impact);
  group.style.color = profile.primary;
  return profile;
}

function drawTechniqueMotif(
  group: SVGGElement,
  effect: string,
  profile: MoveEffectProfile,
  facing: number,
  frame: number,
): void {
  const motif = document.createElementNS(SVG_NS, "g");
  motif.setAttribute("class", `technique-motif motif-${effect}`);
  motif.setAttribute("transform", `scale(${facing} 1)`);
  motif.style.color = profile.primary;

  const pulse = 1 + (frame % 6) * 0.05;
  if (["palm_burst", "shock_ring", "poison_bloom", "prism_star", "reversal_flare"].includes(effect)) {
    motif.appendChild(ring(0, 0, (effect === "poison_bloom" ? 21 : 14) * pulse, profile.secondary));
    const rays = effect === "prism_star" ? 8 : effect === "poison_bloom" ? 6 : 4;
    for (let i = 0; i < rays; i++) motif.appendChild(ray(0, 0, 8, 25 + (i % 2) * 7, i * (360 / rays), i % 2 ? profile.secondary : profile.primary));
  } else if (["slash_arc", "blood_crescent", "scythe_impact", "dark_crescent", "ground_arc", "frost_wave"].includes(effect)) {
    const low = effect === "ground_arc" || effect === "frost_wave";
    motif.appendChild(curve(low ? "M -28 7 Q 8 -4 48 4" : "M -28 18 Q 8 -34 48 -5", profile.primary, effect === "dark_crescent" ? 8 : 4));
    motif.appendChild(curve(low ? "M -20 12 Q 12 2 40 9" : "M -20 22 Q 10 -24 42 1", profile.secondary, 2));
  } else if (["vertical_shards", "heel_comet", "heel_descent"].includes(effect)) {
    const offsets = effect === "vertical_shards" ? [-18, 0, 18] : [0, 13, 25];
    for (const [i, offset] of offsets.entries()) motif.appendChild(shard(offset, effect === "vertical_shards" ? 7 - i * 8 : offset * 0.7, 7 + i * 2, 22 + i * 6, i % 2 ? profile.secondary : profile.primary, effect === "heel_descent" ? 32 : -8));
  } else if (["lightning_bolt", "electric_afterimages", "astral_streak"].includes(effect)) {
    motif.appendChild(polyline("-28,8 -12,-7 -2,3 12,-14 7,2 34,-9", profile.primary, effect === "lightning_bolt" ? 4 : 2));
    motif.appendChild(polyline("-22,15 -5,6 8,12 27,1", profile.secondary, 1.5));
  } else if (["rising_rift", "rising_spiral"].includes(effect)) {
    motif.appendChild(curve("M -12 28 C 25 12 -24 -10 12 -34", profile.primary, 5));
    motif.appendChild(curve("M 10 29 C -20 10 22 -12 -7 -40", profile.secondary, 2));
  } else if (["void_tether", "hand_aura"].includes(effect)) {
    motif.appendChild(curve(effect === "void_tether" ? "M -22 7 C 0 -20 27 22 54 -5" : "M -20 8 C -5 -20 18 -18 28 4", profile.primary, 3));
    motif.appendChild(ring(effect === "void_tether" ? 50 : 6, effect === "void_tether" ? -5 : 0, effect === "hand_aura" ? 20 * pulse : 8, profile.secondary));
  } else if (["afterimages", "dive_wake", "static_rush"].includes(effect)) {
    for (let i = 0; i < 3; i++) {
      const echo = document.createElementNS(SVG_NS, "ellipse");
      echo.setAttribute("cx", fmt(-i * 18)); echo.setAttribute("cy", fmt(i * 3));
      echo.setAttribute("rx", fmt(14 - i * 2)); echo.setAttribute("ry", fmt(29 - i * 4));
      echo.setAttribute("fill", "none"); echo.setAttribute("stroke", i % 2 ? profile.secondary : profile.primary);
      echo.setAttribute("opacity", fmt(0.7 - i * 0.2)); motif.appendChild(echo);
    }
  } else if (["fang_streak", "knuckle_flash", "low_streak"].includes(effect)) {
    const count = effect === "fang_streak" ? 3 : 2;
    for (let i = 0; i < count; i++) motif.appendChild(polyline(`${-26 - i * 4},${-7 + i * 7} ${32 + i * 5},${-2 + i * 4}`, i % 2 ? profile.secondary : profile.primary, effect === "fang_streak" ? 2 : 3));
  } else if (["ground_break", "knee_miasma"].includes(effect)) {
    if (effect === "ground_break") {
      motif.appendChild(polyline("-25,5 -10,-4 -2,8 12,-8 20,7 38,-2", profile.primary, 3));
      motif.appendChild(polyline("-2,8 2,25 12,10 24,22", profile.secondary, 2));
    } else {
      motif.appendChild(ring(-8, 4, 14 * pulse, profile.primary));
      motif.appendChild(ring(8, -5, 20 * pulse, profile.secondary));
    }
  } else {
    motif.appendChild(ring(0, 0, 16 * pulse, profile.primary));
    motif.appendChild(ray(0, 0, 7, 28, profile.rotation + frame * profile.spin, profile.secondary));
  }
  group.appendChild(motif);
}

function ring(cx: number, cy: number, radius: number, color: string): SVGCircleElement {
  const value = document.createElementNS(SVG_NS, "circle");
  value.setAttribute("cx", fmt(cx)); value.setAttribute("cy", fmt(cy)); value.setAttribute("r", fmt(radius));
  value.setAttribute("fill", "none"); value.setAttribute("stroke", color); value.setAttribute("stroke-width", "2");
  return value;
}

function ray(x: number, y: number, inner: number, outer: number, degrees: number, color: string): SVGLineElement {
  const value = document.createElementNS(SVG_NS, "line");
  value.setAttribute("x1", fmt(x + inner)); value.setAttribute("y1", fmt(y));
  value.setAttribute("x2", fmt(x + outer)); value.setAttribute("y2", fmt(y));
  value.setAttribute("stroke", color); value.setAttribute("stroke-width", "2");
  value.setAttribute("transform", `rotate(${fmt(degrees)} ${fmt(x)} ${fmt(y)})`);
  return value;
}

function curve(path: string, color: string, width: number): SVGPathElement {
  const value = document.createElementNS(SVG_NS, "path");
  value.setAttribute("d", path); value.setAttribute("fill", "none"); value.setAttribute("stroke", color);
  value.setAttribute("stroke-width", fmt(width)); value.setAttribute("stroke-linecap", "round");
  return value;
}

function polyline(points: string, color: string, width: number): SVGPolylineElement {
  const value = document.createElementNS(SVG_NS, "polyline");
  value.setAttribute("points", points); value.setAttribute("fill", "none"); value.setAttribute("stroke", color);
  value.setAttribute("stroke-width", fmt(width)); value.setAttribute("stroke-linecap", "round"); value.setAttribute("stroke-linejoin", "round");
  return value;
}

function shard(x: number, y: number, width: number, height: number, color: string, rotation: number): SVGPolygonElement {
  const value = document.createElementNS(SVG_NS, "polygon");
  value.setAttribute("points", `0,${fmt(-height / 2)} ${fmt(width / 2)},0 0,${fmt(height / 2)} ${fmt(-width / 2)},0`);
  value.setAttribute("fill", color); value.setAttribute("transform", `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(rotation)})`);
  return value;
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
