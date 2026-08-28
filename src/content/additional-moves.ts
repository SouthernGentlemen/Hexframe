import type { RawHitLevel, RawMove } from "./raw-types";
import { validateMove } from "./validate";

interface MoveBlueprint {
  id: number;
  key: string;
  tags: string[];
  description: string;
  level: RawHitLevel;
  damage: number;
  startup: number;
  active: number;
  recovery: number;
  box: { x: number; y: number; w: number; h: number };
  hitstun: number;
  blockstun: number;
  pushback: number;
  lunge?: number;
  requiresCrouch?: boolean;
  invulnerable?: boolean;
  routeRole: "starter" | "link" | "cashout" | "reversal";
  /** Status family used to keep authored primer/link/cashout routes distinct. */
  routeFamily?: "burn" | "poison" | "freeze" | "shock" | "bleed" | "void";
}

const BLUEPRINTS: MoveBlueprint[] = [
  { id: 3, key: "ember_palm", tags: ["fire", "burn", "strike"], routeRole: "starter", description: "Fast palm that primes burning routes.", level: "mid", damage: 38, startup: 6, active: 3, recovery: 13, box: { x: 24, y: 46, w: 50, h: 26 }, hitstun: 16, blockstun: 10, pushback: 3.1, lunge: 1.2 },
  { id: 4, key: "venom_fang", tags: ["chaos", "poison", "strike"], routeRole: "starter", description: "Short poison starter with generous advantage.", level: "mid", damage: 26, startup: 5, active: 4, recovery: 10, box: { x: 20, y: 52, w: 42, h: 18 }, hitstun: 17, blockstun: 9, pushback: 2.2 },
  { id: 5, key: "frost_heel", tags: ["cold", "freeze", "kick"], routeRole: "starter", description: "Long cold heel for freezing combo branches.", level: "overhead", damage: 44, startup: 9, active: 3, recovery: 16, box: { x: 28, y: 70, w: 62, h: 24 }, hitstun: 19, blockstun: 12, pushback: 3.8 },
  { id: 6, key: "storm_knuckle", tags: ["lightning", "shock", "strike"], routeRole: "starter", description: "Advancing knuckle that applies shock pressure.", level: "mid", damage: 34, startup: 7, active: 3, recovery: 12, box: { x: 30, y: 56, w: 55, h: 22 }, hitstun: 17, blockstun: 11, pushback: 3.4, lunge: 1.8 },
  { id: 7, key: "crimson_arc", tags: ["physical", "bleed", "slash"], routeRole: "starter", description: "Wide slash built to open bleed sequences.", level: "mid", damage: 46, startup: 8, active: 4, recovery: 15, box: { x: 18, y: 38, w: 78, h: 46 }, hitstun: 20, blockstun: 12, pushback: 4.2 },
  { id: 8, key: "rift_uppercut", tags: ["void", "launch", "anti_air"], routeRole: "cashout", description: "Vertical launcher and anti-air combo pivot.", level: "mid", damage: 52, startup: 8, active: 5, recovery: 20, box: { x: 8, y: 48, w: 44, h: 70 }, hitstun: 23, blockstun: 13, pushback: 2.8, invulnerable: true },
  { id: 9, key: "bastion_break", tags: ["physical", "guard_break", "heavy"], routeRole: "cashout", routeFamily: "shock", description: "Slow armored blow that cracks defensive routes.", level: "overhead", damage: 66, startup: 14, active: 4, recovery: 22, box: { x: 24, y: 50, w: 70, h: 38 }, hitstun: 25, blockstun: 18, pushback: 5.2, invulnerable: true },
  { id: 10, key: "shadow_step", tags: ["void", "mobility", "strike"], routeRole: "link", description: "Fast phase-in strike for route repositioning.", level: "mid", damage: 30, startup: 6, active: 2, recovery: 12, box: { x: 30, y: 44, w: 48, h: 34 }, hitstun: 15, blockstun: 8, pushback: 2.6, lunge: 4.4 },
  { id: 11, key: "ashen_sweep", tags: ["fire", "burn", "low"], routeRole: "link", description: "Low flame sweep that punishes standing guard.", level: "low", damage: 36, startup: 8, active: 4, recovery: 14, box: { x: 18, y: 6, w: 72, h: 22 }, hitstun: 18, blockstun: 11, pushback: 3.6, requiresCrouch: true },
  { id: 12, key: "glacier_spike", tags: ["cold", "freeze", "overhead"], routeRole: "link", description: "Overhead ice spike for high-low construction.", level: "overhead", damage: 48, startup: 11, active: 3, recovery: 17, box: { x: 22, y: 64, w: 58, h: 42 }, hitstun: 21, blockstun: 13, pushback: 3.7 },
  { id: 13, key: "static_rush", tags: ["lightning", "shock", "mobility"], routeRole: "link", description: "Rapid electric shoulder that carries forward.", level: "mid", damage: 32, startup: 5, active: 5, recovery: 13, box: { x: 18, y: 34, w: 64, h: 54 }, hitstun: 16, blockstun: 10, pushback: 3.2, lunge: 3.2 },
  { id: 14, key: "toxic_bloom", tags: ["chaos", "poison", "area"], routeRole: "link", description: "Expanding toxin burst with close-range coverage.", level: "mid", damage: 40, startup: 10, active: 6, recovery: 18, box: { x: -12, y: 18, w: 92, h: 72 }, hitstun: 20, blockstun: 13, pushback: 4.0 },
  { id: 15, key: "blood_moon", tags: ["physical", "bleed", "sustain"], routeRole: "link", description: "Committed crescent slash for bleed finishers.", level: "overhead", damage: 58, startup: 12, active: 4, recovery: 20, box: { x: 10, y: 54, w: 88, h: 48 }, hitstun: 24, blockstun: 15, pushback: 4.8 },
  { id: 16, key: "void_hook", tags: ["void", "pull", "control"], routeRole: "link", description: "Hooking strike that pulls targets back into range.", level: "mid", damage: 28, startup: 9, active: 4, recovery: 15, box: { x: 26, y: 42, w: 86, h: 28 }, hitstun: 20, blockstun: 10, pushback: -1.8 },
  { id: 17, key: "iron_reversal", tags: ["physical", "counter", "armour"], routeRole: "reversal", description: "Invulnerable reversal with severe recovery.", level: "mid", damage: 62, startup: 6, active: 4, recovery: 26, box: { x: 10, y: 32, w: 58, h: 70 }, hitstun: 22, blockstun: 14, pushback: 5.0, invulnerable: true },
  { id: 18, key: "phoenix_drive", tags: ["fire", "burn", "launch"], routeRole: "cashout", description: "Blazing rising drive that ends grounded routes.", level: "mid", damage: 55, startup: 9, active: 5, recovery: 22, box: { x: 14, y: 38, w: 60, h: 78 }, hitstun: 24, blockstun: 14, pushback: 4.5, lunge: 2.2 },
  { id: 19, key: "permafrost", tags: ["cold", "freeze", "control"], routeRole: "cashout", description: "Dense cold wave designed for lock-down.", level: "low", damage: 42, startup: 12, active: 7, recovery: 17, box: { x: 20, y: 8, w: 96, h: 34 }, hitstun: 23, blockstun: 15, pushback: 3.0, requiresCrouch: true },
  { id: 20, key: "plague_touch", tags: ["chaos", "poison", "sustain"], routeRole: "cashout", description: "Lingering chaos touch with high hit advantage.", level: "mid", damage: 35, startup: 7, active: 5, recovery: 14, box: { x: 22, y: 40, w: 54, h: 36 }, hitstun: 22, blockstun: 12, pushback: 2.4 },
  { id: 21, key: "thunder_clap", tags: ["lightning", "shock", "stun"], routeRole: "cashout", description: "Close thunder burst with exceptional stun.", level: "mid", damage: 50, startup: 10, active: 3, recovery: 19, box: { x: -8, y: 28, w: 78, h: 62 }, hitstun: 27, blockstun: 16, pushback: 4.0 },
  { id: 22, key: "reaper_kick", tags: ["physical", "execute", "kick"], routeRole: "cashout", routeFamily: "bleed", description: "Heavy roundhouse tuned as a route finisher.", level: "overhead", damage: 72, startup: 15, active: 4, recovery: 24, box: { x: 30, y: 60, w: 82, h: 30 }, hitstun: 26, blockstun: 17, pushback: 6.0 },
  { id: 23, key: "eclipse_breaker", tags: ["void", "guard_break", "heavy"], routeRole: "cashout", description: "Void hammer that dominates blocking opponents.", level: "mid", damage: 64, startup: 13, active: 5, recovery: 23, box: { x: 18, y: 30, w: 90, h: 60 }, hitstun: 25, blockstun: 20, pushback: 5.4, lunge: 1.4 },
  { id: 24, key: "prism_burst", tags: ["elemental", "burn", "freeze", "shock"], routeRole: "cashout", description: "Prismatic capstone carrying all elemental tags.", level: "mid", damage: 60, startup: 12, active: 8, recovery: 24, box: { x: 4, y: 18, w: 108, h: 86 }, hitstun: 28, blockstun: 18, pushback: 5.0 },
];

const STARTER_IDS = [1, 2, ...BLUEPRINTS.filter((move) => move.routeRole === "starter").map((move) => move.id)];
const ROUTE_FAMILIES = ["burn", "poison", "freeze", "shock", "bleed", "void"] as const;

function routeFamilies(blueprint: MoveBlueprint): string[] {
  if (blueprint.routeFamily) return [blueprint.routeFamily];
  return blueprint.tags.filter((tag) => (ROUTE_FAMILIES as readonly string[]).includes(tag));
}

function sharesRouteFamily(source: MoveBlueprint, target: MoveBlueprint): boolean {
  const sourceFamilies = routeFamilies(source);
  return routeFamilies(target).some((family) => sourceFamilies.includes(family));
}

function cancelTargets(blueprint: MoveBlueprint): number[] {
  if (blueprint.routeRole === "starter") {
    const familyLinks = BLUEPRINTS.filter((move) => move.routeRole === "link" && sharesRouteFamily(blueprint, move)).map((move) => move.id);
    return [...STARTER_IDS, ...familyLinks].filter((id) => id !== blueprint.id);
  }
  if (blueprint.routeRole === "link") {
    return BLUEPRINTS.filter((move) =>
      (move.routeRole === "link" || move.routeRole === "cashout") && sharesRouteFamily(blueprint, move),
    ).map((move) => move.id).filter((id) => id !== blueprint.id);
  }
  return [];
}

function buildMove(blueprint: MoveBlueprint): RawMove {
  const duration = blueprint.startup + blueprint.active + blueprint.recovery;
  const activeStart = blueprint.startup;
  const activeEnd = activeStart + blueprint.active - 1;
  return {
    id: blueprint.id,
    key: blueprint.key,
    animation: blueprint.key,
    tags: [...blueprint.tags, blueprint.routeRole],
    description: blueprint.description,
    duration,
    startup: blueprint.startup,
    active: blueprint.active,
    recovery: blueprint.recovery,
    requiresCrouch: blueprint.requiresCrouch ?? false,
    airOk: false,
    hitboxes: [{
      id: 1,
      box: blueprint.box,
      startFrame: activeStart,
      endFrame: activeEnd,
      level: blueprint.level,
      damage: blueprint.damage,
      hitstun: blueprint.hitstun,
      blockstun: blueprint.blockstun,
      hitstopAttacker: Math.max(5, Math.trunc(blueprint.damage / 9)),
      hitstopDefender: Math.max(7, Math.trunc(blueprint.damage / 7)),
      pushbackHitAttacker: -Math.max(0.8, Math.abs(blueprint.pushback) * 0.35),
      pushbackHitDefender: blueprint.pushback,
      pushbackBlockAttacker: -Math.max(1, Math.abs(blueprint.pushback) * 0.45),
      pushbackBlockDefender: blueprint.pushback * 0.72,
    }],
    hurtboxWindows: [],
    invulWindows: blueprint.invulnerable
      ? [{ startFrame: 0, endFrame: Math.max(0, blueprint.startup - 1), kind: "strike" }]
      : [],
    movement: blueprint.lunge
      ? [{ frame: 0, vx: blueprint.lunge, vy: 0 }, { frame: activeStart, vx: 0, vy: 0 }]
      : [],
    cancelWindows: cancelTargets(blueprint).length === 0 ? [] : [{
      startFrame: activeEnd,
      endFrame: Math.max(activeEnd, duration - 3),
      into: cancelTargets(blueprint),
      onHitOnly: true,
    }],
  };
}

export const ADDITIONAL_MOVES: RawMove[] = BLUEPRINTS.map((blueprint) =>
  validateMove(buildMove(blueprint), `additionalMoves.${blueprint.key}`),
);
