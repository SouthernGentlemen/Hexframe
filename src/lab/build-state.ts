import { ACTION_SLOT_COUNT } from "../combat/types";
import type { ArmorInventory, ArmorSlot } from "../content/armor";
import {
  ARMOR_SLOTS,
  DEFAULT_ARMOR_INVENTORY,
  DEFAULT_EQUIPMENT,
  MATERIAL_CATALOG,
  armorById,
  equipmentForSet,
} from "../content/armor";
import { DEFAULT_MOVE_LOADOUT } from "../content/test-fighter";

export interface BuildPreset {
  name: string;
  loadout: number[];
  equipment: Record<ArmorSlot, string>;
}

export interface BuildState {
  activePreset: number;
  presets: [BuildPreset, BuildPreset, BuildPreset];
  inventory: ArmorInventory;
}

const STORAGE_KEY = "hexframe.builds.v4";
const PREVIOUS_STORAGE_KEYS = ["hexframe.builds.v3", "hexframe.builds.v2"] as const;
const LEGACY_LOADOUT_KEY = "hexframe.move-loadout.v1";
const OLD_DEFAULT_LOADOUT = Array.from({ length: ACTION_SLOT_COUNT }, (_, slot) => slot + 1);
const OLD_VENOM_LOADOUT = [4, 14, 20, 10, 11, 13, 16, 8, 25, 26, 27, 28, 17, 18, 23, 24];
const OLD_PRISM_LOADOUT = [3, 6, 5, 4, 11, 13, 12, 14, 8, 25, 26, 28, 18, 21, 23, 24];

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

export function loadBuildState(validMoveIds: ReadonlySet<number>): BuildState {
  const defaults = createDefaultBuildState();
  let parsed = readStoredBuild(STORAGE_KEY);
  for (const key of PREVIOUS_STORAGE_KEYS) {
    if (parsed) break;
    parsed = readStoredBuild(key);
  }
  parsed = migrateShippedLoadouts(parsed, defaults);

  const inventory = sanitizeInventory(parsed?.inventory, defaults.inventory);
  const presets = defaults.presets.map((fallback, index) =>
    sanitizePreset(parsed?.presets?.[index], fallback, validMoveIds, new Set(inventory.armor)),
  ) as BuildState["presets"];
  if (!parsed) {
    const legacy = readLegacyLoadout(validMoveIds);
    if (legacy) presets[0].loadout = legacy;
  }
  const activePreset = Number.isInteger(parsed?.activePreset) && Number(parsed?.activePreset) >= 0 && Number(parsed?.activePreset) < 3
    ? Number(parsed?.activePreset)
    : 0;
  return { activePreset, presets, inventory };
}

/** Move only untouched shipped presets to the direction-first layout; custom builds stay exact. */
function migrateShippedLoadouts(parsed: Partial<BuildState> | null, defaults: BuildState): Partial<BuildState> | null {
  if (!parsed?.presets) return parsed;
  const presets = parsed.presets.map((preset, index) => {
    if (!preset || !Array.isArray(preset.loadout)) return preset;
    const shipped = index === 0
      ? preset.name === "The Unbound" && sameLoadout(preset.loadout, OLD_DEFAULT_LOADOUT)
      : index === 1
        ? preset.name === "Venom Engine" && sameLoadout(preset.loadout, OLD_VENOM_LOADOUT)
        : preset.name === "Prism Lock" && sameLoadout(preset.loadout, OLD_PRISM_LOADOUT);
    return shipped ? { ...preset, loadout: defaults.presets[index].loadout.slice() } : preset;
  }) as BuildState["presets"];
  return { ...parsed, presets };
}

function sameLoadout(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((moveId, slot) => moveId === b[slot]);
}

export function persistBuildState(state: BuildState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Builds remain active for the current session when device storage is unavailable.
  }
}

function readStoredBuild(key: string): Partial<BuildState> | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as Partial<BuildState> | null;
  } catch {
    return null;
  }
}

function sanitizePreset(
  value: unknown,
  fallback: BuildPreset,
  validMoveIds: ReadonlySet<number>,
  ownedArmor: ReadonlySet<string>,
): BuildPreset {
  const candidate = typeof value === "object" && value !== null ? value as Partial<BuildPreset> : {};
  const rawLoadout = Array.isArray(candidate.loadout) ? candidate.loadout : [];
  const loadout = Array.from({ length: ACTION_SLOT_COUNT }, (_, slot) => {
    const moveId = rawLoadout[slot];
    return typeof moveId === "number" && (moveId === 0 || validMoveIds.has(moveId)) ? moveId : fallback.loadout[slot];
  });
  const equipment = { ...fallback.equipment };
  const candidateEquipment = typeof candidate.equipment === "object" && candidate.equipment !== null ? candidate.equipment : {};
  for (const slot of ARMOR_SLOTS) {
    const id = (candidateEquipment as Partial<Record<ArmorSlot, unknown>>)[slot];
    const item = typeof id === "string" && ownedArmor.has(id) ? armorById(id) : null;
    if (item?.slot === slot) equipment[slot] = item.id;
  }
  return {
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : fallback.name,
    loadout,
    equipment,
  };
}

function sanitizeInventory(value: unknown, fallback: ArmorInventory): ArmorInventory {
  const candidate = typeof value === "object" && value !== null ? value as Partial<ArmorInventory> : {};
  const validArmor = Array.isArray(candidate.armor)
    ? candidate.armor.filter((id): id is string => typeof id === "string" && armorById(id) !== null)
    : fallback.armor;
  const armor = [...new Set([...fallback.armor, ...validArmor])];
  const rawMaterials = typeof candidate.materials === "object" && candidate.materials !== null ? candidate.materials : {};
  const materials: Record<string, number> = {};
  for (const material of MATERIAL_CATALOG) {
    const count = (rawMaterials as Record<string, unknown>)[material.id];
    materials[material.id] = Number.isInteger(count) && Number(count) >= 0 ? Number(count) : (fallback.materials[material.id] ?? 0);
  }
  return { armor, materials };
}

function readLegacyLoadout(validMoveIds: ReadonlySet<number>): number[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LEGACY_LOADOUT_KEY) ?? "null");
    if (!Array.isArray(value) || value.length !== ACTION_SLOT_COUNT) return null;
    return value.map((moveId, slot) => typeof moveId === "number" && validMoveIds.has(moveId) ? moveId : DEFAULT_MOVE_LOADOUT[slot]);
  } catch {
    return null;
  }
}
