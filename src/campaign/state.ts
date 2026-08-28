import type { ArmorInventory, ArmorSlot } from "../content/armor";
import type { BuildState } from "../lab/build-state";
import { DEFAULT_MOVE_LOADOUT, MoveId } from "../content/test-fighter";

export interface CampaignState {
  tutorialComplete: boolean;
  currentStage: string;
  checkpoint: number;
  completedBosses: string[];
  unlockedMoveIds: number[];
  unlockedRecipeIds: string[];
  inventory: ArmorInventory;
  builds: BuildState;
}

const STORAGE_KEY = "hexframe.campaign.v1";
const EMPTY_EQUIPMENT: Record<ArmorSlot, string> = {
  head: "gravecloth-head",
  chest: "gravecloth-chest",
  arms: "",
  waist: "",
  legs: "",
};

export function createDefaultCampaignState(): CampaignState {
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
  const starter = [...DEFAULT_MOVE_LOADOUT.slice(0, 12), MoveId.RiftUppercut, 0, MoveId.IronReversal, 0];
  const builds: BuildState = {
    activePreset: 0,
    presets: [
      { name: "Belfry Initiate", loadout: starter, equipment: { ...EMPTY_EQUIPMENT } },
      { name: "Unforged Route", loadout: starter.slice(), equipment: { ...EMPTY_EQUIPMENT } },
      { name: "New Build", loadout: starter.slice(), equipment: { ...EMPTY_EQUIPMENT } },
    ],
    inventory,
  };
  return {
    tutorialComplete: false,
    currentStage: "black-belfry",
    checkpoint: 0,
    completedBosses: [],
    unlockedMoveIds: [...new Set([...DEFAULT_MOVE_LOADOUT.slice(0, 12), MoveId.RiftUppercut, MoveId.IronReversal])],
    unlockedRecipeIds: ["gravecloth-head", "gravecloth-chest", "gravecloth-arms", "gravecloth-waist", "gravecloth-legs"],
    inventory,
    builds,
  };
}

export function loadCampaignState(): CampaignState {
  const fallback = createDefaultCampaignState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<CampaignState> | null;
    if (!saved) return fallback;
    const inventory = saved.inventory ?? fallback.inventory;
    const builds = saved.builds ?? fallback.builds;
    builds.inventory = inventory;
    return {
      ...fallback,
      ...saved,
      completedBosses: Array.isArray(saved.completedBosses) ? [...new Set(saved.completedBosses.filter((id): id is string => typeof id === "string"))] : [],
      unlockedMoveIds: Array.isArray(saved.unlockedMoveIds) ? [...new Set(saved.unlockedMoveIds.filter(Number.isInteger))] : fallback.unlockedMoveIds,
      unlockedRecipeIds: Array.isArray(saved.unlockedRecipeIds) ? [...new Set(saved.unlockedRecipeIds.filter((id): id is string => typeof id === "string"))] : fallback.unlockedRecipeIds,
      inventory,
      builds,
    };
  } catch {
    return fallback;
  }
}

export function persistCampaignState(state: CampaignState): void {
  state.inventory = state.builds.inventory;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Campaign progress remains active for this session if storage is unavailable.
  }
}
