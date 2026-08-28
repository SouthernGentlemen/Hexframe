/**
 * Hits, blocks, and everything that follows from one box touching another.
 *
 * This is the only place health, stun, hitstop and pushback are written, so "what does
 * this attack do" has exactly one answer and it is spelled out here rather than spread
 * across the states it affects.
 */

import type {
  CharacterDef,
  ContactEvent,
  FighterState,
  FrameReport,
  HitLevelValue,
  InputFrame,
  SimState,
} from "../types";
import { ContactKind, HitLevel, InputBit, InvulKind, StateId } from "../types";
import { NO_MOVE } from "../constants";
import { centerOf, intersection, overlaps } from "../collision/aabb";
import { activeHitboxesOf, hurtboxesOf, isInvulnerable } from "../collision/boxes";
import {
  blockstunStateFor,
  enterState,
  hitstunStateFor,
  isCrouching,
  isInHitstun,
} from "../state/machine";
import { applyTaggedDebuffs, consumeDebuffBonuses } from "../status/debuffs";

/**
 * Whether the defender is guarding this attack.
 *
 * Guarding is holding away from the attacker while free to do so. A fighter who is
 * attacking, in hitstun, in the air, in jump squat, landing, dashing or knocked down is
 * committed and cannot guard — blockstun itself is allowed, which is what makes a
 * blockstring hold together.
 *
 * The stance has to suit the level, and a stance that does not suit it is a hit rather
 * than a failed block: holding back against a low while standing is precisely the mistake
 * lows exist to punish. Left and right held together cancel, matching the numpad
 * conversion, so a mashed stick guards nothing.
 *
 * On exactly equal x — two fighters somehow sharing an origin — "away" resolves to the
 * right. It is arbitrary and it is fixed, which is all determinism asks.
 */
export function isBlocking(
  defender: FighterState,
  defenderChar: CharacterDef,
  attacker: FighterState,
  input: InputFrame,
  level: HitLevelValue,
): boolean {
  if (defender.airborne === 1) return false;
  if (defender.state === StateId.Attack) return false;
  if (isInHitstun(defender)) return false;
  if (
    defender.state === StateId.JumpSquat ||
    defender.state === StateId.Landing ||
    defender.state === StateId.Dash ||
    defender.state === StateId.Knockdown
  ) {
    return false;
  }

  const left = (input & InputBit.Left) !== 0;
  const right = (input & InputBit.Right) !== 0;
  if (left === right) return false;
  const away = attacker.x > defender.x ? left : right;
  if (!away) return false;

  const crouching = isCrouching(defender);
  if (level === HitLevel.Low) return crouching;
  if (level === HitLevel.Overhead) return !crouching;
  return true;
}

/**
 * Test every live attack box against every opponent hurtbox, and apply what connects.
 *
 * A hitbox connects at most once per move. `hitFlags` records which of the move's boxes
 * have already landed, which is why an attack whose active frames overlap a hurtbox for
 * six frames deals its damage once rather than six times — and why hitstop can freeze the
 * attacker on the frame of contact without the box connecting again on the way out.
 */
export function resolveContacts(
  state: SimState,
  chars: readonly CharacterDef[],
  inputs: readonly InputFrame[],
  report: FrameReport,
): void {
  for (let a = 0; a < state.fighters.length; a++) {
    const attacker = state.fighters[a];
    const attackerChar = chars[a];
    const attacks = activeHitboxesOf(attacker, attackerChar);
    if (attacks.length === 0) continue;

    for (let d = 0; d < state.fighters.length; d++) {
      if (d === a) continue;
      const defender = state.fighters[d];
      const defenderChar = chars[d];

      for (const { spec, aabb } of attacks) {
        // Ids are small integers assigned per move, so one bit each. Anything outside a
        // 31-bit mask is content that has outgrown this gate, and silently wrapping to
        // bit 0 would make two hitboxes share a "already hit" flag.
        if (spec.id < 0 || spec.id > 30) continue;
        const bit = 1 << spec.id;
        if ((attacker.hitFlags & bit) !== 0) continue;
        if (isInvulnerable(defender, defenderChar, InvulKind.Strike)) continue;

        let touched = null;
        let hurtboxId = -1;
        const hurtboxes = hurtboxesOf(defender, defenderChar);
        for (let hurtIndex = 0; hurtIndex < hurtboxes.length; hurtIndex++) {
          const hurt = hurtboxes[hurtIndex];
          if (overlaps(aabb, hurt)) {
            touched = hurt;
            hurtboxId = hurtIndex;
            break;
          }
        }
        if (touched === null) continue;

        attacker.hitFlags |= bit;
        const blocked = isBlocking(defender, defenderChar, attacker, inputs[d] ?? 0, spec.level);
        const overlap = intersection(aabb, touched) ?? aabb;
        const where = centerOf(overlap);
        const dir = attacker.facing;
        let dealtDamage = 0;
        let rawDamage = spec.damage;
        const counterHit = defender.state === StateId.Attack;

        attacker.hitstop = spec.hitstopAttacker;
        defender.hitstop = spec.hitstopDefender;

        if (blocked) {
          defender.stun = spec.blockstun;
          enterState(defender, blockstunStateFor(defender));
          attacker.vx = spec.pushbackBlockAttacker * dir;
          defender.vx = spec.pushbackBlockDefender * dir;
        } else {
          // The stun state is chosen from the stance the defender was in when the attack
          // arrived, before anything below has had a chance to change it.
          const stunState = hitstunStateFor(defender);
          const move = attackerChar.moves.find((candidate) => candidate.id === attacker.moveId);
          const tags = move?.tags ?? [];
          rawDamage = spec.damage + consumeDebuffBonuses(defender, tags, spec.damage, defenderChar.resistances, a, d, report);
          dealtDamage = armorMitigatedDamage(rawDamage, defenderChar.armor);
          defender.health = Math.max(0, defender.health - dealtDamage);
          defender.comboCount++;
          defender.stun = spec.hitstun;
          // Being hit ends whatever the defender was doing, including their own attack.
          defender.moveId = NO_MOVE;
          defender.moveFrame = 0;
          defender.hitFlags = 0;
          enterState(defender, stunState);
          attacker.vx = spec.pushbackHitAttacker * dir;
          defender.vx = spec.pushbackHitDefender * dir;
          applyTaggedDebuffs(defender, tags, defenderChar.resistances, a, d, report);
          if (defender.health === 0) state.roundOver = 1;
        }

        const event: ContactEvent = {
          attacker: a,
          defender: d,
          moveId: attacker.moveId,
          hitboxId: spec.id,
          hurtboxId,
          kind: blocked ? ContactKind.Block : ContactKind.Hit,
          level: spec.level,
          damage: dealtDamage,
          rawDamage,
          hitstun: spec.hitstun,
          blockstun: spec.blockstun,
          hitstopAttacker: spec.hitstopAttacker,
          hitstopDefender: spec.hitstopDefender,
          pushbackAttacker: blocked
            ? spec.pushbackBlockAttacker * dir
            : spec.pushbackHitAttacker * dir,
          pushbackDefender: blocked
            ? spec.pushbackBlockDefender * dir
            : spec.pushbackHitDefender * dir,
          overlapWidth: overlap.x1 - overlap.x0,
          overlapHeight: overlap.y1 - overlap.y0,
          counterHit,
          x: where.x,
          y: where.y,
        };
        report.contacts.push(event);
      }
    }
  }
}

/**
 * Flat armor is authored as an integer and resolved through one deterministic curve.
 * Four hundred armor halves direct damage; every connecting hit still deals at least 1.
 */
export function armorMitigatedDamage(damage: number, armor: number): number {
  if (damage <= 0) return 0;
  const rating = Math.max(0, Math.trunc(armor));
  return Math.max(1, Math.trunc((damage * 400) / (400 + rating)));
}
