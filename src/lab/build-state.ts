import { ACTION_SLOT_COUNT } from "../combat/types";
import type { GearSlot } from "../content/gear";
import { DEFAULT_EQUIPMENT, GEAR_SLOTS, gearById } from "../content/gear";
import { DEFAULT_MOVE_LOADOUT } from "../content/test-fighter";

export interface BuildPreset {
  name: string;
  loadout: number[];
  equipment: Record<GearSlot, string>;
}

export interface BuildState {
  activePreset: number;
  presets: [BuildPreset, BuildPreset, BuildPreset];
}

const STORAGE_KEY = "hexframe.builds.v2";
const LEGACY_LOADOUT_KEY = "hexframe.move-loadout.v1";

function defaultPresets(): BuildState["presets"] {
  return [
    { name: "The Unbound", loadout: DEFAULT_MOVE_LOADOUT.slice(), equipment: { ...DEFAULT_EQUIPMENT } },
    { name: "Venom Engine", loadout: Array.from({ length: ACTION_SLOT_COUNT }, (_, slot) => 9 + slot), equipment: { ...DEFAULT_EQUIPMENT, focus: "viperglass-eye", sigil: "hemorrhage-rune", charm: "plague-heart" } },
    { name: "Prism Lock", loadout: [3, 6, 5, 4, 11, 13, 12, 14, 18, 21, 19, 20, 7, 22, 23, 24], equipment: { ...DEFAULT_EQUIPMENT, charm: "winterglass-charm", relic: "prismatic-shard" } },
  ];
}

export function loadBuildState(validMoveIds: ReadonlySet<number>): BuildState {
  const defaults = defaultPresets();
  let parsed: Partial<BuildState> | null = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<BuildState> | null;
  } catch {
    parsed = null;
  }
  const presets = defaults.map((fallback, index) => sanitizePreset(parsed?.presets?.[index], fallback, validMoveIds)) as BuildState["presets"];
  if (!parsed) {
    const legacy = readLegacyLoadout(validMoveIds);
    if (legacy) presets[0].loadout = legacy;
  }
  const activePreset = Number.isInteger(parsed?.activePreset) && Number(parsed?.activePreset) >= 0 && Number(parsed?.activePreset) < 3
    ? Number(parsed?.activePreset)
    : 0;
  return { activePreset, presets };
}

export function persistBuildState(state: BuildState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A loadout still works for the current session when device storage is unavailable.
  }
}

function sanitizePreset(value: unknown, fallback: BuildPreset, validMoveIds: ReadonlySet<number>): BuildPreset {
  const candidate = typeof value === "object" && value !== null ? value as Partial<BuildPreset> : {};
  const rawLoadout = Array.isArray(candidate.loadout) ? candidate.loadout : [];
  const loadout = Array.from({ length: ACTION_SLOT_COUNT }, (_, slot) => {
    const moveId = rawLoadout[slot];
    return typeof moveId === "number" && validMoveIds.has(moveId) ? moveId : fallback.loadout[slot];
  });
  const equipment = { ...fallback.equipment };
  const candidateEquipment = typeof candidate.equipment === "object" && candidate.equipment !== null ? candidate.equipment : {};
  for (const slot of GEAR_SLOTS) {
    const id = (candidateEquipment as Partial<Record<GearSlot, unknown>>)[slot];
    const item = typeof id === "string" ? gearById(id) : null;
    if (item?.slot === slot) equipment[slot] = item.id;
  }
  return { name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : fallback.name, loadout, equipment };
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
