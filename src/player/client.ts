import { createDefaultPlayerSave, normalizePlayerSave, PLAYER_SAVE_CACHE_KEY } from "./save";
import type { PlayerSave } from "./save";

const LEGACY_CAMPAIGN_KEY = "hexframe.campaign.v1";
const LEGACY_BUILD_KEY = "hexframe.builds.v4";
let mutationTail: Promise<void> = Promise.resolve();

export async function loadPlayerSave(): Promise<PlayerSave> {
  const cached = loadCachedPlayerSave();
  try {
    const response = await fetch("/api/save", { headers: { accept: "application/json" } });
    if (!response.ok) return cached;
    const remote = normalizePlayerSave(await response.json());
    cachePlayerSave(remote);
    return remote;
  } catch {
    return cached;
  }
}

export function loadCachedPlayerSave(): PlayerSave {
  try {
    const current = localStorage.getItem(PLAYER_SAVE_CACHE_KEY);
    if (current) return normalizePlayerSave(JSON.parse(current) as unknown);
  } catch {
    // Fall through to the legacy migration/default save.
  }
  return migrateLegacySave();
}

export function cachePlayerSave(save: PlayerSave): void {
  try {
    localStorage.setItem(PLAYER_SAVE_CACHE_KEY, JSON.stringify(save));
  } catch {
    // The active in-memory save remains usable when device cache is unavailable.
  }
}

export function persistPlayerSave(save: PlayerSave): Promise<PlayerSave> {
  return withSaveLock(async () => {
    cachePlayerSave(save);
    try {
      const response = await fetch("/api/save", {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(save),
      });
      if (response.status === 409) {
        const conflict = await response.json() as { save?: unknown };
        if (conflict.save) mergePlayerSave(save, normalizePlayerSave(conflict.save));
      } else if (response.ok) {
        const body = await response.json() as { save?: unknown };
        if (body.save) mergePlayerSave(save, normalizePlayerSave(body.save));
      }
      cachePlayerSave(save);
    } catch {
      // The cache remains a working offline copy and will be reconciled on the next load.
    }
    return save;
  });
}

export function claimBossReward(save: PlayerSave, stageId: string, bossId: string): Promise<PlayerSave> {
  return withSaveLock(async () => {
    try {
      const response = await fetch("/api/save/progression/boss", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ stageId, bossId, revision: save.revision }),
      });
      const body = await response.json() as { save?: unknown };
      if (!body.save) return save;
      const remote = normalizePlayerSave(body.save);
      mergePlayerSave(save, remote);
      cachePlayerSave(save);
    } catch {
      // Rewards remain unclaimed locally when the authority cannot be reached.
    }
    return save;
  });
}

export function resetPlayerCampaign(save: PlayerSave): Promise<PlayerSave> {
  return withSaveLock(async () => {
    try {
      const response = await fetch("/api/save/campaign/reset", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ revision: save.revision }),
      });
      const body = await response.json() as { save?: unknown };
      if (!body.save) return save;
      const remote = normalizePlayerSave(body.save);
      mergePlayerSave(save, remote);
      cachePlayerSave(save);
    } catch {
      // Keep the existing campaign intact if the server cannot confirm the reset.
    }
    return save;
  });
}

export async function applyStageEvent(save: PlayerSave, stageId: string, entityId: number): Promise<PlayerSave> {
  return postSaveOperation(save, "/api/save/progression/stage-event", { stageId, entityId });
}

export async function craftPlayerArmor(save: PlayerSave, armorId: string): Promise<PlayerSave> {
  return postSaveOperation(save, "/api/save/armory/craft", { armorId });
}

function postSaveOperation(save: PlayerSave, path: string, payload: Record<string, unknown>): Promise<PlayerSave> {
  return withSaveLock(async () => {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ...payload, revision: save.revision }),
      });
      const body = await response.json() as { save?: unknown };
      if (!body.save) return save;
      const remote = normalizePlayerSave(body.save);
      mergePlayerSave(save, remote);
      cachePlayerSave(save);
    } catch {
      // Keep the last confirmed state; the action can be retried from the game.
    }
    return save;
  });
}

async function withSaveLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = mutationTail;
  let release = (): void => undefined;
  mutationTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function mergePlayerSave(target: PlayerSave, source: PlayerSave): void {
  target.revision = source.revision;
  target.campaign.tutorialComplete = source.campaign.tutorialComplete;
  target.campaign.currentStageId = source.campaign.currentStageId;
  for (const [stageId, progress] of Object.entries(source.campaign.stages)) {
    if (target.campaign.stages[stageId]) Object.assign(target.campaign.stages[stageId], progress);
    else target.campaign.stages[stageId] = progress;
  }
  target.unlocks.moves.splice(0, target.unlocks.moves.length, ...source.unlocks.moves);
  target.unlocks.recipes.splice(0, target.unlocks.recipes.length, ...source.unlocks.recipes);
  target.unlocks.stages.splice(0, target.unlocks.stages.length, ...source.unlocks.stages);
  target.inventory.armor.splice(0, target.inventory.armor.length, ...source.inventory.armor);
  for (const key of Object.keys(target.inventory.materials)) delete target.inventory.materials[key];
  Object.assign(target.inventory.materials, source.inventory.materials);
  target.loadouts.activeId = source.loadouts.activeId;
  target.loadouts.order = source.loadouts.order;
  for (const id of source.loadouts.order) {
    if (target.loadouts.byId[id]) Object.assign(target.loadouts.byId[id], source.loadouts.byId[id]);
    else target.loadouts.byId[id] = source.loadouts.byId[id];
  }
}

function migrateLegacySave(): PlayerSave {
  const next = createDefaultPlayerSave();
  try {
    const campaign = JSON.parse(localStorage.getItem(LEGACY_CAMPAIGN_KEY) ?? "null") as Record<string, unknown> | null;
    const builds = campaign?.builds && typeof campaign.builds === "object"
      ? campaign.builds as Record<string, unknown>
      : JSON.parse(localStorage.getItem(LEGACY_BUILD_KEY) ?? "null") as Record<string, unknown> | null;
    if (campaign) {
      next.campaign.tutorialComplete = campaign.tutorialComplete === true;
      const stage = next.campaign.stages["black-belfry"];
      if (stage) {
        stage.checkpointId = Number.isSafeInteger(campaign.checkpoint) ? Number(campaign.checkpoint) : 0;
        stage.completedBosses = Array.isArray(campaign.completedBosses)
          ? campaign.completedBosses.filter((id): id is string => typeof id === "string")
          : [];
        stage.rewardsClaimed = stage.completedBosses.slice();
        stage.status = stage.completedBosses.includes("bell-warden") ? "complete" : "in-progress";
      }
      if (Array.isArray(campaign.unlockedMoveIds)) next.unlocks.moves = campaign.unlockedMoveIds.filter((id): id is number => Number.isSafeInteger(id));
      if (Array.isArray(campaign.unlockedRecipeIds)) next.unlocks.recipes = campaign.unlockedRecipeIds.filter((id): id is string => typeof id === "string");
      if (campaign.inventory && typeof campaign.inventory === "object") next.inventory = campaign.inventory as PlayerSave["inventory"];
    }
    if (builds && Array.isArray(builds.presets)) {
      for (let index = 0; index < 3; index++) {
        const preset = builds.presets[index];
        const id = next.loadouts.order[index];
        if (id && preset && typeof preset === "object") next.loadouts.byId[id] = preset as PlayerSave["loadouts"]["byId"][string];
      }
      if (Number.isInteger(builds.activePreset)) next.loadouts.activeId = next.loadouts.order[Number(builds.activePreset)] ?? next.loadouts.activeId;
      if (builds.inventory && typeof builds.inventory === "object") next.inventory = builds.inventory as PlayerSave["inventory"];
    }
    const migrated = normalizePlayerSave(next);
    cachePlayerSave(migrated);
    return migrated;
  } catch {
    return next;
  }
}
