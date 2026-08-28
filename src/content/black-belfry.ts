import { px } from "../combat/constants";
import { EntityKind, InteractableKind } from "../combat/types";
import type { StageDef, StageEntityDef } from "../combat/types";

export const CampaignMaterial = {
  IronScrap: 0,
  GraveThread: 1,
  Stormglass: 2,
  WardenCore: 3,
} as const;

function object(
  id: number,
  kind: number,
  owner: number,
  x: number,
  w: number,
  h: number,
  value = 1,
): StageEntityDef {
  return { id, kind, owner, x: px(x), y: 0, w: px(w), h: px(h), value };
}

export const BLACK_BELFRY: StageDef = {
  id: "black-belfry",
  width: px(2800),
  spawnX: px(-1260),
  cameraBounds: { minX: px(-1400), maxX: px(1400) },
  bossArena: { gateX: px(710), minX: px(690), maxX: px(1360) },
  checkpoints: [px(-260)],
  backdrop: "black-belfry",
  breakables: [
    object(101, EntityKind.Breakable, CampaignMaterial.IronScrap, -1040, 24, 58),
    object(102, EntityKind.Breakable, CampaignMaterial.GraveThread, -850, 38, 46, 2),
    object(103, EntityKind.Breakable, CampaignMaterial.IronScrap, -620, 30, 66),
    object(104, EntityKind.Breakable, CampaignMaterial.GraveThread, -390, 42, 38, 2),
    object(105, EntityKind.Breakable, CampaignMaterial.IronScrap, 70, 24, 58),
    object(106, EntityKind.Breakable, CampaignMaterial.GraveThread, 270, 38, 46, 2),
    object(107, EntityKind.Breakable, CampaignMaterial.IronScrap, 510, 34, 62),
  ],
  interactables: [
    object(201, EntityKind.Interactable, InteractableKind.ArsenalShrine, -1160, 52, 118),
    object(202, EntityKind.Interactable, InteractableKind.Checkpoint, -250, 62, 102),
    object(203, EntityKind.Interactable, InteractableKind.Forge, 420, 76, 92),
    object(204, EntityKind.Interactable, InteractableKind.BossGate, 710, 38, 180),
    object(205, EntityKind.Interactable, InteractableKind.Chest, 570, 54, 40),
  ],
  hazards: [object(301, EntityKind.Hazard, 0, 155, 34, 24, 42)],
  bossReward: object(900, EntityKind.Interactable, InteractableKind.BossReward, 1060, 86, 94),
};
