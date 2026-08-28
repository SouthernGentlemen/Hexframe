import type { ArmorInventory, ArmorSlot } from "../content/armor";
import {
  DEFAULT_ARMOR_INVENTORY,
  DEFAULT_EQUIPMENT,
  equipmentForSet,
} from "../content/armor";
import { DEFAULT_MOVE_LOADOUT } from "../content/test-fighter";

/** The editor-facing view of one authored loadout in the unified PlayerSave. */
export interface BuildPreset {
  name: string;
  loadout: number[];
  equipment: Record<ArmorSlot, string>;
}

/**
 * A compact adapter used by the existing Armory UI. Persistence lives exclusively in
 * PlayerSave; this type is not stored under its own browser key.
 */
export interface BuildState {
  activePreset: number;
  presets: [BuildPreset, BuildPreset, BuildPreset];
  inventory: ArmorInventory;
}

export function createDefaultBuildState(): BuildState {
  return {
    activePreset: 0,
    presets: [
      { name: "The Unbound", loadout: DEFAULT_MOVE_LOADOUT.slice(), equipment: { ...DEFAULT_EQUIPMENT } },
      { name: "Venom Engine", loadout: [...DEFAULT_MOVE_LOADOUT.slice(0, 12), 26, 15, 16, 22], equipment: equipmentForSet("briarbone") },
      { name: "Prism Lock", loadout: [...DEFAULT_MOVE_LOADOUT.slice(0, 12), 24, 8, 23, 9], equipment: equipmentForSet("stormglass") },
    ],
    inventory: {
      armor: DEFAULT_ARMOR_INVENTORY.armor.slice(),
      materials: { ...DEFAULT_ARMOR_INVENTORY.materials },
    },
  };
}
