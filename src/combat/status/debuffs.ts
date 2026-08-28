import type { DebuffEvent, ElementalResistances, FighterState, FrameReport, SimState } from "../types";
import { DebuffEventKind, DebuffKind } from "../types";
import { StateId } from "../types";
import { enterState } from "../state/machine";

const BURN_DURATION = 90;
const POISON_DURATION = 180;
const CHILL_DURATION = 150;
const FREEZE_DURATION = 24;
const SHOCK_DURATION = 180;
const BLEED_DURATION = 120;

export function isFrozen(fighter: FighterState): boolean {
  return fighter.freezeStacks >= 3 && fighter.freezeFrames > 0;
}

/** Apply deterministic DOT, expire stacks, and emit presentation-only status events. */
export function tickDebuffs(state: SimState, report: FrameReport, teams?: readonly number[]): void {
  for (let player = 0; player < state.fighters.length; player++) {
    const fighter = state.fighters[player];
    const source = firstHostileIndex(state, player, teams);

    if (fighter.burnFrames > 0) {
      if (fighter.burnFrames % 15 === 0) damageTick(state, fighter, source, player, DebuffKind.Burn, fighter.burnStacks * 2, report, teams);
      fighter.burnFrames--;
      if (fighter.burnFrames === 0) fighter.burnStacks = 0;
    }
    if (fighter.poisonFrames > 0) {
      if (fighter.poisonFrames % 15 === 0) damageTick(state, fighter, source, player, DebuffKind.Poison, fighter.poisonStacks, report, teams);
      fighter.poisonFrames--;
      if (fighter.poisonFrames === 0) fighter.poisonStacks = 0;
    }
    if (fighter.freezeFrames > 0) {
      fighter.freezeFrames--;
      if (fighter.freezeFrames === 0) fighter.freezeStacks = 0;
    }
    if (fighter.shockFrames > 0) {
      fighter.shockFrames--;
      if (fighter.shockFrames === 0) fighter.shockStacks = 0;
    }
    if (fighter.bleedFrames > 0) {
      const moving = fighter.vx !== 0 || fighter.vy !== 0;
      if (moving && fighter.bleedFrames % 10 === 0) damageTick(state, fighter, source, player, DebuffKind.Bleed, fighter.bleedStacks * 2, report, teams);
      fighter.bleedFrames--;
      if (fighter.bleedFrames === 0) fighter.bleedStacks = 0;
    }
  }
}

/** Consume existing setup statuses and return bonus damage for the direct hit. */
export function consumeDebuffBonuses(
  defender: FighterState,
  tags: readonly string[],
  baseDamage: number,
  resistances: Readonly<ElementalResistances>,
  source: number,
  target: number,
  report: FrameReport,
): number {
  let bonus = 0;
  if (defender.shockStacks > 0) {
    const damage = resistDamage(Math.trunc((baseDamage * defender.shockStacks * 8) / 100), resistances.shock);
    bonus += damage;
    report.debuffs.push(event(source, target, DebuffKind.Shock, DebuffEventKind.Triggered, defender.shockStacks, defender.shockFrames, damage));
    defender.shockStacks = 0;
    defender.shockFrames = 0;
  }
  if (tags.includes("burn") && defender.burnStacks > 0) {
    const damage = defender.burnStacks * 4;
    bonus += damage;
    report.debuffs.push(event(source, target, DebuffKind.Burn, DebuffEventKind.Triggered, defender.burnStacks, defender.burnFrames, damage));
  }
  if (tags.includes("freeze") && defender.freezeStacks > 0) {
    const damage = defender.freezeStacks * 3;
    bonus += damage;
    report.debuffs.push(event(source, target, DebuffKind.Freeze, DebuffEventKind.Triggered, defender.freezeStacks, defender.freezeFrames, damage));
  }
  if (tags.includes("execute") && defender.bleedStacks > 0) {
    const damage = defender.bleedStacks * 8;
    bonus += damage;
    report.debuffs.push(event(source, target, DebuffKind.Bleed, DebuffEventKind.Triggered, defender.bleedStacks, defender.bleedFrames, damage));
    defender.bleedStacks = 0;
    defender.bleedFrames = 0;
  }
  return bonus;
}

/** Translate authored move tags into concrete status stacks after an unblocked hit. */
export function applyTaggedDebuffs(
  defender: FighterState,
  tags: readonly string[],
  resistances: Readonly<ElementalResistances>,
  source: number,
  target: number,
  report: FrameReport,
  shockStackLimit = 3,
): void {
  if (tags.includes("burn")) {
    defender.burnStacks = Math.min(3, defender.burnStacks + 1);
    defender.burnFrames = resistDuration(BURN_DURATION, resistances.fire);
    report.debuffs.push(event(source, target, DebuffKind.Burn, DebuffEventKind.Applied, defender.burnStacks, defender.burnFrames, 0));
  }
  if (tags.includes("poison")) {
    defender.poisonStacks = Math.min(5, defender.poisonStacks + 1);
    defender.poisonFrames = resistDuration(POISON_DURATION, resistances.poison);
    report.debuffs.push(event(source, target, DebuffKind.Poison, DebuffEventKind.Applied, defender.poisonStacks, defender.poisonFrames, 0));
  }
  if (tags.includes("freeze")) {
    defender.freezeStacks = Math.min(3, defender.freezeStacks + 1);
    defender.freezeFrames = resistDuration(defender.freezeStacks >= 3 ? FREEZE_DURATION : CHILL_DURATION, resistances.frost);
    report.debuffs.push(event(source, target, DebuffKind.Freeze, defender.freezeStacks >= 3 ? DebuffEventKind.Triggered : DebuffEventKind.Applied, defender.freezeStacks, defender.freezeFrames, 0));
  }
  if (tags.includes("shock")) {
    defender.shockStacks = Math.min(shockStackLimit, defender.shockStacks + 1);
    defender.shockFrames = resistDuration(SHOCK_DURATION, resistances.shock);
    report.debuffs.push(event(source, target, DebuffKind.Shock, DebuffEventKind.Applied, defender.shockStacks, defender.shockFrames, 0));
  }
  if (tags.includes("bleed")) {
    defender.bleedStacks = Math.min(3, defender.bleedStacks + 1);
    defender.bleedFrames = BLEED_DURATION;
    report.debuffs.push(event(source, target, DebuffKind.Bleed, DebuffEventKind.Applied, defender.bleedStacks, defender.bleedFrames, 0));
  }
}

function resistDuration(duration: number, resistance: number): number {
  return Math.max(1, Math.trunc((duration * (100 - Math.min(80, Math.max(0, resistance)))) / 100));
}

function resistDamage(damage: number, resistance: number): number {
  return Math.max(0, Math.trunc((damage * (100 - Math.min(80, Math.max(0, resistance)))) / 100));
}

function damageTick(
  state: SimState,
  fighter: FighterState,
  source: number,
  target: number,
  debuff: DebuffEvent["debuff"],
  damage: number,
  report: FrameReport,
  teams?: readonly number[],
): void {
  if (damage <= 0 || fighter.health <= 0) return;
  fighter.health = Math.max(0, fighter.health - damage);
  if (fighter.health === 0) {
    enterState(fighter, StateId.Defeat);
    if (oneTeamRemains(state, teams)) state.roundOver = 1;
  }
  const [stacks, frames] = valuesOf(fighter, debuff);
  report.debuffs.push(event(source, target, debuff, DebuffEventKind.Tick, stacks, frames, damage));
}

function firstHostileIndex(state: SimState, fighterIndex: number, teams?: readonly number[]): number {
  const ownTeam = teams?.[fighterIndex] ?? fighterIndex;
  return state.fighters.findIndex((fighter, index) =>
    index !== fighterIndex && fighter.health > 0 && (teams?.[index] ?? index) !== ownTeam,
  );
}

function oneTeamRemains(state: SimState, teams?: readonly number[]): boolean {
  const livingTeams = new Set<number>();
  for (let index = 0; index < state.fighters.length; index++) {
    if (state.fighters[index].health > 0) livingTeams.add(teams?.[index] ?? index);
  }
  return livingTeams.size <= 1;
}

function valuesOf(fighter: FighterState, debuff: DebuffEvent["debuff"]): [number, number] {
  if (debuff === DebuffKind.Burn) return [fighter.burnStacks, fighter.burnFrames];
  if (debuff === DebuffKind.Poison) return [fighter.poisonStacks, fighter.poisonFrames];
  if (debuff === DebuffKind.Freeze) return [fighter.freezeStacks, fighter.freezeFrames];
  if (debuff === DebuffKind.Shock) return [fighter.shockStacks, fighter.shockFrames];
  return [fighter.bleedStacks, fighter.bleedFrames];
}

function event(
  source: number,
  target: number,
  debuff: DebuffEvent["debuff"],
  kind: DebuffEvent["kind"],
  stacks: number,
  frames: number,
  damage: number,
): DebuffEvent {
  return { source, target, debuff, kind, stacks, frames, damage };
}
