import { px } from "../constants";
import type { FrameReport, SimState, StageDef } from "../types";
import { EntityEventKind, EntityKind, InputBit, InteractableKind } from "../types";
import { overlaps } from "../collision/aabb";
import { activeHitboxesOf } from "../collision/boxes";
import type { CharacterDef, EntityState, InputFrame } from "../types";
import { pressedOn } from "../../input/buffer/history";
import { randomRange } from "../simulation/rng";

const PICKUP_RANGE = px(24);
const INTERACT_RANGE = px(58);

function entityBox(entity: EntityState) {
  return {
    x0: entity.x - Math.trunc(entity.w / 2),
    y0: entity.y,
    x1: entity.x + Math.trunc(entity.w / 2),
    y1: entity.y + entity.h,
  };
}

function emit(report: FrameReport, entity: EntityState, kind: number, player = 0): void {
  report.entityEvents.push({
    entityId: entity.id,
    kind,
    entityKind: entity.kind,
    owner: entity.owner,
    value: entity.value,
    player,
  });
}

function breakableDrop(state: SimState, broken: EntityState): EntityState {
  const roll = randomRange(state, 0, 5);
  const kind = roll === 2
    ? EntityKind.HealthPickup
    : roll === 3
      ? EntityKind.StaminaPickup
      : EntityKind.MaterialPickup;
  return {
    id: 10_000 + state.frame * 16 + (broken.id & 15),
    kind,
    owner: kind === EntityKind.MaterialPickup ? broken.owner : 0,
    x: broken.x,
    y: broken.y + px(8),
    vx: 0,
    vy: 0,
    life: 600,
    hitFlags: 0,
    w: px(18),
    h: px(18),
    value: kind === EntityKind.HealthPickup ? 55 : kind === EntityKind.StaminaPickup ? 24 : Math.max(1, broken.value),
  };
}

/** Resolve stage objects from authoritative positions and input history. */
export function resolveEntities(
  state: SimState,
  chars: readonly CharacterDef[],
  inputs: readonly InputFrame[],
  report: FrameReport,
  stage: StageDef | undefined,
): void {
  const player = state.fighters[0];
  const spawned: EntityState[] = [];

  const boss = state.fighters[1];
  if (
    stage?.id === "black-belfry" &&
    state.stage.bossActive === 1 &&
    state.roundOver === 0 &&
    boss &&
    boss.health * 100 <= chars[1].health * 58 &&
    state.frame % 150 === 30
  ) {
    const offset = randomRange(state, -120, 120);
    const x = Math.max(state.stage.arenaMinX + px(30), Math.min(state.stage.arenaMaxX - px(30), player.x + px(offset)));
    const hazard: EntityState = {
      id: 20_000 + state.frame,
      kind: EntityKind.Hazard,
      owner: -1,
      x,
      y: 0,
      vx: 0,
      vy: 0,
      life: 70,
      hitFlags: 0,
      w: px(46),
      h: px(24),
      value: 52,
    };
    spawned.push(hazard);
    emit(report, hazard, EntityEventKind.Spawned, 1);
  }

  for (const entity of state.entities) {
    if (entity.life === 0) continue;

    if (entity.kind === EntityKind.Breakable) {
      let broken = false;
      for (let fighter = 0; fighter < state.fighters.length && !broken; fighter++) {
        for (const attack of activeHitboxesOf(state.fighters[fighter], chars[fighter])) {
          if (overlaps(attack.aabb, entityBox(entity))) {
            broken = true;
            break;
          }
        }
      }
      if (broken) {
        entity.life = 0;
        emit(report, entity, EntityEventKind.Broken);
        const drop = breakableDrop(state, entity);
        spawned.push(drop);
        emit(report, drop, EntityEventKind.Spawned);
      }
      continue;
    }

    const close = Math.abs(player.x - entity.x) <= Math.trunc(entity.w / 2) + PICKUP_RANGE;
    if (
      close &&
      (entity.kind === EntityKind.HealthPickup ||
        entity.kind === EntityKind.StaminaPickup ||
        entity.kind === EntityKind.MaterialPickup)
    ) {
      if (entity.kind === EntityKind.HealthPickup) {
        player.health = Math.min(chars[0].health, player.health + entity.value);
      } else if (entity.kind === EntityKind.StaminaPickup) {
        player.stamina = Math.min(chars[0].stamina, player.stamina + entity.value);
      }
      entity.life = 0;
      emit(report, entity, EntityEventKind.PickedUp);
      continue;
    }

    if (entity.kind === EntityKind.Interactable) {
      const inRange = Math.abs(player.x - entity.x) <= Math.trunc(entity.w / 2) + INTERACT_RANGE;
      if (!inRange || !pressedOn(state, 0, state.frame, InputBit.Interact)) continue;
      if (entity.owner === InteractableKind.BossGate && entity.hitFlags === 0) {
        state.stage.arenaLocked = 1;
        state.stage.bossActive = 1;
        state.stage.bossActivatedFrame = state.frame;
        entity.hitFlags = 1;
      } else if (entity.owner === InteractableKind.Checkpoint) {
        state.stage.checkpoint = entity.id;
        player.health = chars[0].health;
        player.stamina = chars[0].stamina;
        entity.hitFlags = 1;
      } else if (entity.owner === InteractableKind.ArsenalShrine) {
        entity.hitFlags = 1;
      } else if (entity.owner === InteractableKind.Chest || entity.owner === InteractableKind.BossReward) {
        if (entity.hitFlags !== 0) continue;
        entity.hitFlags = 1;
        entity.life = 0;
      }
      emit(report, entity, EntityEventKind.Interacted);
      continue;
    }

    if ((entity.kind === EntityKind.Hazard || entity.kind === EntityKind.Projectile) && entity.hitFlags === 0) {
      if (entity.kind === EntityKind.Hazard && entity.owner < 0) {
        if (entity.life <= 30) {
          entity.owner = 1;
          entity.h = px(86);
        } else {
          continue;
        }
      }
      const hurt = {
        x0: player.x - Math.trunc(chars[0].pushboxStand.w / 2),
        y0: player.y,
        x1: player.x + Math.trunc(chars[0].pushboxStand.w / 2),
        y1: player.y + chars[0].pushboxStand.h,
      };
      if (overlaps(hurt, entityBox(entity))) {
        player.health = Math.max(0, player.health - entity.value);
        entity.hitFlags = 1;
        emit(report, entity, EntityEventKind.Damaged);
      }
    }
  }

  state.entities.push(...spawned);

  if (state.fighters[1]?.health === 0 && stage?.bossReward && state.stage.rewardSpawned === 0) {
    const reward = stage.bossReward;
    const entity: EntityState = {
      ...reward,
      vx: 0,
      vy: 0,
      life: reward.life ?? -1,
      hitFlags: 0,
    };
    state.entities.push(entity);
    state.stage.rewardSpawned = 1;
    emit(report, entity, EntityEventKind.Spawned);
  }
}
