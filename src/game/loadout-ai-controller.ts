import { SCALE } from "../combat/constants";
import { isActionable } from "../combat/state/machine";
import type { CharacterDef, FrameReport, InputFrame, MoveDef, SimState } from "../combat/types";
import { InputBit, StateId } from "../combat/types";
import type { AiProfile } from "./session";

/**
 * A rollback-safe controller that reads authored moves instead of device buttons.
 *
 * It owns no evolving decision state and never samples ambient randomness. Given the same
 * frame, fighters, teams, character data, seed, and last report, it returns the same input.
 */
export class LoadoutAIController {
  constructor(
    private readonly profile: AiProfile,
    private readonly seed: number,
  ) {}

  inputFor(
    state: SimState,
    fighterIndex: number,
    characters: readonly CharacterDef[],
    teams: readonly number[],
    lastReport: FrameReport | null = null,
  ): InputFrame {
    if (state.roundOver === 1) return 0;
    const fighter = state.fighters[fighterIndex];
    const character = characters[fighterIndex];
    if (!fighter || !character || fighter.health === 0) return 0;
    const targetIndex = nearestEnemy(state, fighterIndex, teams);
    if (targetIndex < 0) return 0;
    const target = state.fighters[targetIndex];
    const targetCharacter = characters[targetIndex];
    const distance = Math.abs(target.x - fighter.x);

    if (fighter.state === StateId.Attack) {
      return this.followCancel(fighterIndex, targetIndex, fighter.moveId, fighter.moveFrame, character, lastReport);
    }

    if (this.isThreatened(target, targetCharacter, distance)) {
      const roll = deterministicPercent(state.frame, fighterIndex, this.seed, 11);
      if (roll < this.profile.defensiveConsistency) {
        const away = target.x > fighter.x ? InputBit.Left : InputBit.Right;
        const low = target.state === StateId.Attack && activeMove(target, targetCharacter)?.hitboxes.some((hitbox) => hitbox.level === 2);
        return low ? away | InputBit.Down : away;
      }
      const reversal = bestMove(character, (move) => move.tags.includes("reversal"), fighter.stamina);
      if (reversal) return commandFor(character, reversal.id);
    }

    if (!isActionable(fighter)) return 0;
    const attackRange = preferredRange(character, fighter.stamina);
    const spacingError = Math.trunc(((100 - this.profile.spacingAccuracy) * SCALE) / 2);
    if (distance > attackRange + spacingError) {
      return target.x > fighter.x ? InputBit.Right : InputBit.Left;
    }
    if (distance < Math.max(18 * SCALE, Math.trunc(attackRange / 3)) && this.profile.aggression < 60) {
      return target.x > fighter.x ? InputBit.Left : InputBit.Right;
    }
    if (state.frame % Math.max(1, this.profile.reactionDelay) !== 0) return 0;

    const primed = statusStacks(target) > 0;
    const desiredRole = primed && this.profile.routeDepth >= 3 ? "cashout" : primed ? "link" : "starter";
    const authoredMoves = usableMoves(character);
    const candidates = authoredMoves.filter((move) =>
      move.tags.includes(desiredRole) &&
      move.staminaCost <= fighter.stamina &&
      move.airOk === (fighter.airborne === 1),
    );
    const usable = candidates.length > 0
      ? candidates
      : authoredMoves.filter((move) => move.staminaCost <= fighter.stamina && move.airOk === (fighter.airborne === 1));
    if (usable.length === 0) return 0;
    usable.sort((a, b) => moveScore(b, target, distance) - moveScore(a, target, distance) || a.id - b.id);

    const mistake = deterministicPercent(state.frame, fighterIndex, this.seed, 23) < this.profile.mistakeFrequency;
    const breadth = mistake ? this.profile.choiceBreadth + 3 : this.profile.choiceBreadth;
    const choiceCount = Math.max(1, Math.min(usable.length, breadth));
    const pick = deterministicPercent(state.frame, fighterIndex, this.seed, 37) % choiceCount;
    return commandFor(character, usable[pick]?.id ?? usable[0].id);
  }

  private followCancel(
    fighterIndex: number,
    targetIndex: number,
    moveId: number,
    moveFrame: number,
    character: CharacterDef,
    lastReport: FrameReport | null,
  ): InputFrame {
    const connected = lastReport?.contacts.some((contact) => contact.attacker === fighterIndex && contact.defender === targetIndex) ?? false;
    const current = character.moves.find((move) => move.id === moveId);
    if (!current) return 0;
    const into = current.cancelWindows
      .filter((window) => moveFrame >= window.startFrame && moveFrame <= window.endFrame && (!window.onHitOnly || connected))
      .flatMap((window) => window.into)
      .map((id) => character.moves.find((move) => move.id === id))
      .filter((move): move is MoveDef => move !== undefined && character.commands.some((command) => command.moveId === move.id))
      .sort((a, b) => roleRank(b) - roleRank(a) || a.id - b.id);
    return into.length > 0 && this.profile.routeDepth > 1 ? commandFor(character, into[0].id) : 0;
  }

  private isThreatened(target: SimState["fighters"][number], character: CharacterDef, distance: number): boolean {
    const move = activeMove(target, character);
    if (!move) return false;
    const framesUntilActive = Math.max(0, move.startup - target.moveFrame);
    return framesUntilActive <= this.profile.predictionHorizon && distance <= moveReach(move) + 36 * SCALE;
  }
}

export function nearestEnemy(state: SimState, fighterIndex: number, teams: readonly number[]): number {
  const fighter = state.fighters[fighterIndex];
  if (!fighter) return -1;
  const ownTeam = teams[fighterIndex] ?? fighterIndex;
  let best = -1;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  for (let index = 0; index < state.fighters.length; index++) {
    const candidate = state.fighters[index];
    if (index === fighterIndex || candidate.health === 0 || (teams[index] ?? index) === ownTeam) continue;
    const distance = Math.abs(candidate.x - fighter.x);
    if (distance < bestDistance || (distance === bestDistance && index < best)) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

function activeMove(fighter: SimState["fighters"][number], character: CharacterDef): MoveDef | null {
  if (fighter.state !== StateId.Attack) return null;
  return character.moves.find((move) => move.id === fighter.moveId) ?? null;
}

function commandFor(character: CharacterDef, moveId: number): InputFrame {
  return character.commands.find((command) => command.moveId === moveId)?.buttons ?? 0;
}

function preferredRange(character: CharacterDef, stamina: number): number {
  return Math.max(42 * SCALE, ...usableMoves(character)
    .filter((move) => move.staminaCost <= stamina && !move.airOk && !move.tags.includes("cashout"))
    .map(moveReach));
}

function moveReach(move: MoveDef): number {
  return Math.max(0, ...move.hitboxes.map((hitbox) => hitbox.box.x + hitbox.box.w));
}

function bestMove(character: CharacterDef, predicate: (move: MoveDef) => boolean, stamina: number): MoveDef | null {
  return usableMoves(character)
    .filter((move) => predicate(move) && move.staminaCost <= stamina)
    .sort((a, b) => a.startup - b.startup || (b.hitboxes[0]?.damage ?? 0) - (a.hitboxes[0]?.damage ?? 0) || a.id - b.id)[0] ?? null;
}

function usableMoves(character: CharacterDef): MoveDef[] {
  const authoredIds = new Set(character.commands.map((command) => command.moveId));
  return character.moves.filter((move) => authoredIds.has(move.id));
}

function moveScore(move: MoveDef, target: SimState["fighters"][number], distance: number): number {
  const reachFit = Math.max(0, 220 - Math.abs(moveReach(move) - distance) / SCALE);
  const statusFit = move.tags.some((tag) => activeStatusTags(target).includes(tag)) ? 80 : 0;
  const damage = move.hitboxes[0]?.damage ?? 0;
  return Math.trunc(reachFit) + statusFit + damage - move.startup * 2 - move.staminaCost;
}

function roleRank(move: MoveDef): number {
  if (move.tags.includes("cashout")) return 3;
  if (move.tags.includes("link")) return 2;
  if (move.tags.includes("starter")) return 1;
  return 0;
}

function statusStacks(fighter: SimState["fighters"][number]): number {
  return fighter.burnStacks + fighter.poisonStacks + fighter.freezeStacks + fighter.shockStacks + fighter.bleedStacks;
}

function activeStatusTags(fighter: SimState["fighters"][number]): string[] {
  const tags: string[] = [];
  if (fighter.burnStacks > 0) tags.push("burn", "fire");
  if (fighter.poisonStacks > 0) tags.push("poison", "chaos");
  if (fighter.freezeStacks > 0) tags.push("freeze", "cold");
  if (fighter.shockStacks > 0) tags.push("shock", "lightning");
  if (fighter.bleedStacks > 0) tags.push("bleed", "execute");
  return tags;
}

function deterministicPercent(frame: number, fighter: number, seed: number, salt: number): number {
  let value = (seed ^ Math.imul(frame + 1, 0x9e3779b1) ^ Math.imul(fighter + 1, 0x85ebca6b) ^ salt) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) % 100;
}
