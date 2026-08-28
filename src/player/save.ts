import type { ArmorInventory, ArmorSlot } from "../content/armor";
import { DEFAULT_MOVE_LOADOUT, MoveId } from "../content/test-fighter";
import type { BuildPreset, BuildState } from "../lab/build-state";

export const PLAYER_SAVE_VERSION = 2;
export const PLAYER_SAVE_CACHE_KEY = "hexframe.player-save.v2";
export const PLAYER_LOADOUT_IDS = ["loadout-01", "loadout-02", "loadout-03"] as const;
const VALID_MOVE_IDS = new Set<number>([0, ...Object.values(MoveId)]);

export type CampaignStageStatus = "locked" | "available" | "in-progress" | "complete";

export interface CampaignStageProgress {
  unlocked: boolean;
  status: CampaignStageStatus;
  checkpointId: number;
  completedBosses: string[];
  discovered: string[];
  rewardsClaimed: string[];
}

export interface PlayerSave {
  version: typeof PLAYER_SAVE_VERSION;
  revision: number;
  campaign: {
    tutorialComplete: boolean;
    currentStageId: string;
    stages: Record<string, CampaignStageProgress>;
  };
  unlocks: {
    moves: number[];
    recipes: string[];
    stages: string[];
  };
  inventory: ArmorInventory;
  loadouts: {
    activeId: string;
    order: [string, string, string];
    byId: Record<string, BuildPreset>;
  };
}

const EMPTY_EQUIPMENT: Record<ArmorSlot, string> = {
  head: "gravecloth-head",
  chest: "gravecloth-chest",
  arms: "",
  waist: "",
  legs: "",
};

export function createDefaultPlayerSave(): PlayerSave {
  const inventory: ArmorInventory = {
    armor: ["gravecloth-head", "gravecloth-chest"],
    materials: {
      "iron-scrap": 2,
      "grave-thread": 3,
      "briar-hide": 0,
      "venom-gland": 0,
      stormglass: 0,
      "frost-core": 0,
      "umbral-cloth": 0,
      "cinder-heart": 0,
      "warden-core": 0,
    },
  };
  const starter = DEFAULT_MOVE_LOADOUT.slice();
  const loadout = (name: string): BuildPreset => ({
    name,
    loadout: starter.slice(),
    equipment: { ...EMPTY_EQUIPMENT },
  });
  return {
    version: PLAYER_SAVE_VERSION,
    revision: 0,
    campaign: {
      tutorialComplete: false,
      currentStageId: "black-belfry",
      stages: {
        "black-belfry": {
          unlocked: true,
          status: "in-progress",
          checkpointId: 0,
          completedBosses: [],
          discovered: [],
          rewardsClaimed: [],
        },
        "stage-02": lockedStage(),
        "stage-03": lockedStage(),
      },
    },
    unlocks: {
      moves: [...new Set(DEFAULT_MOVE_LOADOUT)],
      recipes: ["gravecloth-head", "gravecloth-chest", "gravecloth-arms", "gravecloth-waist", "gravecloth-legs"],
      stages: ["black-belfry"],
    },
    inventory,
    loadouts: {
      activeId: "loadout-01",
      order: [...PLAYER_LOADOUT_IDS],
      byId: {
        "loadout-01": loadout("Belfry Initiate"),
        "loadout-02": loadout("Unforged Route"),
        "loadout-03": loadout("New Build"),
      },
    },
  };
}

function lockedStage(): CampaignStageProgress {
  return {
    unlocked: false,
    status: "locked",
    checkpointId: 0,
    completedBosses: [],
    discovered: [],
    rewardsClaimed: [],
  };
}

export function buildStateFromPlayerSave(save: PlayerSave): BuildState {
  const presets = save.loadouts.order.map((id) => save.loadouts.byId[id]) as BuildState["presets"];
  const index = Math.max(0, save.loadouts.order.indexOf(save.loadouts.activeId));
  return { activePreset: index, presets, inventory: save.inventory };
}

export function syncBuildStateToPlayerSave(save: PlayerSave, builds: BuildState): void {
  save.inventory = builds.inventory;
  save.loadouts.activeId = save.loadouts.order[builds.activePreset] ?? save.loadouts.order[0];
  for (let index = 0; index < save.loadouts.order.length; index++) {
    save.loadouts.byId[save.loadouts.order[index]] = builds.presets[index];
  }
}

export function normalizePlayerSave(value: unknown): PlayerSave {
  const fallback = createDefaultPlayerSave();
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fallback;
  const raw = value as Partial<PlayerSave>;
  if (raw.version !== PLAYER_SAVE_VERSION) return fallback;
  const next = structuredClone(fallback);
  next.revision = Number.isSafeInteger(raw.revision) && Number(raw.revision) >= 0 ? Number(raw.revision) : 0;

  if (raw.campaign && typeof raw.campaign === "object") {
    next.campaign.tutorialComplete = raw.campaign.tutorialComplete === true;
    if (typeof raw.campaign.currentStageId === "string") next.campaign.currentStageId = raw.campaign.currentStageId;
    if (raw.campaign.stages && typeof raw.campaign.stages === "object") {
      for (const [id, stage] of Object.entries(raw.campaign.stages)) {
        if (!stage || typeof stage !== "object") continue;
        const source = stage as Partial<CampaignStageProgress>;
        next.campaign.stages[id] = {
          unlocked: source.unlocked === true,
          status: isStageStatus(source.status) ? source.status : source.unlocked ? "available" : "locked",
          checkpointId: Number.isSafeInteger(source.checkpointId) && Number(source.checkpointId) >= 0 ? Number(source.checkpointId) : 0,
          completedBosses: stringList(source.completedBosses),
          discovered: stringList(source.discovered),
          rewardsClaimed: stringList(source.rewardsClaimed),
        };
      }
    }
  }
  if (raw.unlocks && typeof raw.unlocks === "object") {
    next.unlocks.moves = numberList(raw.unlocks.moves, fallback.unlocks.moves);
    next.unlocks.recipes = stringList(raw.unlocks.recipes, fallback.unlocks.recipes);
    next.unlocks.stages = stringList(raw.unlocks.stages, fallback.unlocks.stages);
  }
  if (raw.inventory && typeof raw.inventory === "object") {
    next.inventory.armor = stringList(raw.inventory.armor, fallback.inventory.armor);
    if (raw.inventory.materials && typeof raw.inventory.materials === "object") {
      for (const key of Object.keys(next.inventory.materials)) {
        const count = raw.inventory.materials[key];
        if (Number.isSafeInteger(count) && Number(count) >= 0) next.inventory.materials[key] = Number(count);
      }
    }
  }
  if (raw.loadouts && typeof raw.loadouts === "object") {
    const order = Array.isArray(raw.loadouts.order) && raw.loadouts.order.length === PLAYER_LOADOUT_IDS.length
      ? raw.loadouts.order.filter((id): id is string => typeof id === "string")
      : [];
    if (order.length === PLAYER_LOADOUT_IDS.length && PLAYER_LOADOUT_IDS.every((id) => order.includes(id))) {
      next.loadouts.order = order as PlayerSave["loadouts"]["order"];
    }
    const source = raw.loadouts.byId;
    if (source && typeof source === "object") {
      for (const id of next.loadouts.order) {
        const preset = source[id];
        if (!preset || typeof preset !== "object") continue;
        next.loadouts.byId[id] = normalizePreset(preset, next.loadouts.byId[id]);
      }
    }
    if (typeof raw.loadouts.activeId === "string" && next.loadouts.order.includes(raw.loadouts.activeId)) {
      next.loadouts.activeId = raw.loadouts.activeId;
    }
  }
  return next;
}

function normalizePreset(value: Partial<BuildPreset>, fallback: BuildPreset): BuildPreset {
  const loadout = Array.isArray(value.loadout) && value.loadout.length === 16
    ? value.loadout.map((id, index) => Number.isSafeInteger(id) && VALID_MOVE_IDS.has(Number(id)) ? Number(id) : fallback.loadout[index])
    : fallback.loadout.slice();
  const equipment = { ...fallback.equipment };
  if (value.equipment && typeof value.equipment === "object") {
    for (const slot of Object.keys(equipment) as ArmorSlot[]) {
      const id = value.equipment[slot];
      if (typeof id === "string") equipment[slot] = id;
    }
  }
  return {
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim().slice(0, 32) : fallback.name,
    loadout,
    equipment,
  };
}

function isStageStatus(value: unknown): value is CampaignStageStatus {
  return value === "locked" || value === "available" || value === "in-progress" || value === "complete";
}

function stringList(value: unknown, fallback: readonly string[] = []): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

function numberList(value: unknown, fallback: readonly number[] = []): number[] {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((item): item is number => Number.isSafeInteger(item) && item >= 0))];
}
