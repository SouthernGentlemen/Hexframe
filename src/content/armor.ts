import type { CharacterDef, ElementalResistances } from "../combat/types";

export const ARMOR_SLOTS = ["head", "chest", "arms", "waist", "legs"] as const;
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];

export const ARMOR_GRADES = ["white", "green", "blue", "purple", "orange"] as const;
export type ArmorGrade = (typeof ARMOR_GRADES)[number];

export const ARMOR_SKILL_IDS = [
  "vitality-up",
  "stamina-up",
  "poison-resistance",
  "fire-resistance",
  "frost-resistance",
  "shock-resistance",
] as const;
export type ArmorSkillId = (typeof ARMOR_SKILL_IDS)[number];
export type ResistanceId = keyof ElementalResistances;

export interface SkillEffect {
  vitality?: number;
  stamina?: number;
  resistance?: { type: ResistanceId; value: number };
}

export interface SkillThreshold {
  points: number;
  description: string;
  effect: SkillEffect;
}

export interface ArmorSkillDef {
  id: ArmorSkillId;
  name: string;
  shortName: string;
  description: string;
  thresholds: readonly SkillThreshold[];
}

export interface ArmorSkillGrant {
  id: ArmorSkillId;
  points: number;
}

export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface MaterialCost {
  materialId: string;
  quantity: number;
}

export interface ArmorDef {
  id: string;
  name: string;
  setName: string;
  slot: ArmorSlot;
  grade: ArmorGrade;
  icon: string;
  description: string;
  /** Flat defense shown on the character sheet and consumed by the damage formula. */
  armor: number;
  skills: readonly ArmorSkillGrant[];
  recipe: readonly MaterialCost[];
}

export interface ArmorInventory {
  armor: string[];
  materials: Record<string, number>;
}

export interface ResolvedArmorStats {
  vitality: number;
  stamina: number;
  armor: number;
  resistances: ElementalResistances;
  skillPoints: Record<ArmorSkillId, number>;
}

export const ARMOR_SKILLS: readonly ArmorSkillDef[] = [
  {
    id: "vitality-up",
    name: "Vitality Up",
    shortName: "VIT",
    description: "Raises maximum health when the build reaches a listed point threshold.",
    thresholds: [
      { points: 1, description: "+50 vitality", effect: { vitality: 50 } },
      { points: 3, description: "+100 vitality", effect: { vitality: 100 } },
      { points: 5, description: "+150 vitality", effect: { vitality: 150 } },
    ],
  },
  {
    id: "stamina-up",
    name: "Stamina Up",
    shortName: "STA",
    description: "Raises the stamina pool when the build reaches a listed point threshold.",
    thresholds: [
      { points: 1, description: "+10 stamina", effect: { stamina: 10 } },
      { points: 3, description: "+25 stamina", effect: { stamina: 25 } },
      { points: 5, description: "+50 stamina", effect: { stamina: 50 } },
    ],
  },
  ...(["poison", "fire", "frost", "shock"] as const).map((type): ArmorSkillDef => ({
    id: `${type}-resistance`,
    name: `${title(type)} Resistance`,
    shortName: type.slice(0, 3).toUpperCase(),
    description: `Raises ${type} resistance when the build reaches a listed point threshold.`,
    thresholds: [
      { points: 1, description: `+10 ${type} resistance`, effect: { resistance: { type, value: 10 } } },
      { points: 3, description: `+25 ${type} resistance`, effect: { resistance: { type, value: 25 } } },
    ],
  })),
];

export const MATERIAL_CATALOG: readonly MaterialDef[] = [
  { id: "iron-scrap", name: "Iron Scrap", icon: "Fe", description: "Serviceable metal reclaimed from ruined armories." },
  { id: "grave-thread", name: "Grave Thread", icon: "Gt", description: "Cold thread spun from burial cloth and shadow." },
  { id: "briar-hide", name: "Briar Hide", icon: "Bh", description: "Thorn-tough hide cut from overgrown beasts." },
  { id: "venom-gland", name: "Venom Gland", icon: "Vg", description: "An intact gland used in poison-resistant weave." },
  { id: "stormglass", name: "Stormglass", icon: "Sg", description: "Charged crystal formed where lightning strikes sand." },
  { id: "frost-core", name: "Frost Core", icon: "Fc", description: "A core that stays frozen far from its original host." },
  { id: "umbral-cloth", name: "Umbral Cloth", icon: "Uc", description: "Dense cloth that seems to swallow nearby light." },
  { id: "cinder-heart", name: "Cinder Heart", icon: "Ch", description: "A furnace-hot heart from an elder fire beast." },
];

const SETS: ReadonlyArray<{
  id: string;
  name: string;
  grade: ArmorGrade;
  baseArmor: number;
  material: string;
  secondary: string;
  skills: Readonly<Record<ArmorSlot, readonly ArmorSkillGrant[]>>;
}> = [
  {
    id: "gravecloth", name: "Gravecloth", grade: "white", baseArmor: 8, material: "grave-thread", secondary: "iron-scrap",
    skills: {
      head: [{ id: "vitality-up", points: 1 }],
      chest: [{ id: "poison-resistance", points: 1 }],
      arms: [{ id: "stamina-up", points: 1 }],
      waist: [{ id: "frost-resistance", points: 1 }],
      legs: [{ id: "fire-resistance", points: 1 }],
    },
  },
  {
    id: "briarbone", name: "Briarbone", grade: "green", baseArmor: 14, material: "briar-hide", secondary: "venom-gland",
    skills: {
      head: [{ id: "poison-resistance", points: 2 }],
      chest: [{ id: "poison-resistance", points: 1 }, { id: "vitality-up", points: 1 }],
      arms: [{ id: "stamina-up", points: 2 }],
      waist: [{ id: "stamina-up", points: 1 }],
      legs: [{ id: "vitality-up", points: 1 }],
    },
  },
  {
    id: "stormglass", name: "Stormglass", grade: "blue", baseArmor: 22, material: "stormglass", secondary: "frost-core",
    skills: {
      head: [{ id: "shock-resistance", points: 2 }],
      chest: [{ id: "shock-resistance", points: 1 }, { id: "vitality-up", points: 1 }],
      arms: [{ id: "frost-resistance", points: 2 }],
      waist: [{ id: "frost-resistance", points: 1 }],
      legs: [{ id: "stamina-up", points: 1 }],
    },
  },
  {
    id: "voidwarden", name: "Voidwarden", grade: "purple", baseArmor: 32, material: "umbral-cloth", secondary: "stormglass",
    skills: {
      head: [{ id: "vitality-up", points: 2 }],
      chest: [{ id: "vitality-up", points: 1 }, { id: "poison-resistance", points: 1 }],
      arms: [{ id: "fire-resistance", points: 2 }],
      waist: [{ id: "frost-resistance", points: 2 }],
      legs: [{ id: "stamina-up", points: 3 }],
    },
  },
  {
    id: "crownfire", name: "Crownfire", grade: "orange", baseArmor: 44, material: "cinder-heart", secondary: "umbral-cloth",
    skills: {
      head: [{ id: "fire-resistance", points: 3 }, { id: "vitality-up", points: 1 }],
      chest: [{ id: "vitality-up", points: 3 }],
      arms: [{ id: "shock-resistance", points: 3 }],
      waist: [{ id: "stamina-up", points: 3 }],
      legs: [{ id: "vitality-up", points: 1 }, { id: "stamina-up", points: 2 }],
    },
  },
];

const SLOT_NAMES: Record<ArmorSlot, string> = {
  head: "Helm",
  chest: "Mail",
  arms: "Vambraces",
  waist: "Coil",
  legs: "Greaves",
};

const SLOT_ICONS: Record<ArmorSlot, string> = { head: "H", chest: "C", arms: "A", waist: "W", legs: "L" };

export const ARMOR_CATALOG: readonly ArmorDef[] = SETS.flatMap((set) =>
  ARMOR_SLOTS.map((slot, index): ArmorDef => ({
    id: `${set.id}-${slot}`,
    name: `${set.name} ${SLOT_NAMES[slot]}`,
    setName: set.name,
    slot,
    grade: set.grade,
    icon: SLOT_ICONS[slot],
    description: `${set.name} armor shaped for a ${slot} slot build.`,
    armor: set.baseArmor + index,
    skills: set.skills[slot],
    recipe: [
      { materialId: set.material, quantity: 2 + index },
      { materialId: set.secondary, quantity: 1 + Math.trunc(index / 2) },
    ],
  })),
);

export const DEFAULT_EQUIPMENT: Record<ArmorSlot, string> = equipmentForSet("gravecloth");

export const DEFAULT_ARMOR_INVENTORY: ArmorInventory = {
  armor: ARMOR_CATALOG.filter((item) => ["white", "green", "blue"].includes(item.grade)).map((item) => item.id),
  materials: {
    "iron-scrap": 24,
    "grave-thread": 18,
    "briar-hide": 14,
    "venom-gland": 10,
    stormglass: 12,
    "frost-core": 9,
    "umbral-cloth": 8,
    "cinder-heart": 5,
  },
};

export function equipmentForSet(setId: string): Record<ArmorSlot, string> {
  return Object.fromEntries(ARMOR_SLOTS.map((slot) => [slot, `${setId}-${slot}`])) as Record<ArmorSlot, string>;
}

export function armorById(id: string): ArmorDef | null {
  return ARMOR_CATALOG.find((item) => item.id === id) ?? null;
}

export function materialById(id: string): MaterialDef | null {
  return MATERIAL_CATALOG.find((item) => item.id === id) ?? null;
}

export function armorSkillById(id: ArmorSkillId): ArmorSkillDef {
  const skill = ARMOR_SKILLS.find((candidate) => candidate.id === id);
  if (!skill) throw new Error(`Unknown armor skill: ${id}`);
  return skill;
}

export function activeSkillThreshold(skill: ArmorSkillDef, points: number): SkillThreshold | null {
  let active: SkillThreshold | null = null;
  for (const threshold of skill.thresholds) if (points >= threshold.points) active = threshold;
  return active;
}

export function resolveArmorStats(
  character: Pick<CharacterDef, "health" | "stamina">,
  equipment: Readonly<Partial<Record<ArmorSlot, string>>>,
): ResolvedArmorStats {
  const skillPoints = armorSkillPoints(equipment);
  let armor = 0;
  for (const slot of ARMOR_SLOTS) {
    const item = armorById(equipment[slot] ?? "");
    if (!item || item.slot !== slot) continue;
    armor += item.armor;
  }

  let vitality = character.health;
  let stamina = character.stamina;
  const resistances: ElementalResistances = { poison: 0, fire: 0, frost: 0, shock: 0 };
  for (const skill of ARMOR_SKILLS) {
    const effect = activeSkillThreshold(skill, skillPoints[skill.id])?.effect;
    vitality += effect?.vitality ?? 0;
    stamina += effect?.stamina ?? 0;
    if (effect?.resistance) resistances[effect.resistance.type] += effect.resistance.value;
  }
  return { vitality, stamina, armor, resistances, skillPoints };
}

export function armorSkillPoints(
  equipment: Readonly<Partial<Record<ArmorSlot, string>>>,
): Record<ArmorSkillId, number> {
  const points = Object.fromEntries(ARMOR_SKILL_IDS.map((id) => [id, 0])) as Record<ArmorSkillId, number>;
  for (const slot of ARMOR_SLOTS) {
    const item = armorById(equipment[slot] ?? "");
    if (!item || item.slot !== slot) continue;
    for (const grant of item.skills) points[grant.id] += grant.points;
  }
  return points;
}

/** Resolve device-local armor choices into immutable deterministic match data. */
export function applyArmor(
  character: CharacterDef,
  equipment: Readonly<Partial<Record<ArmorSlot, string>>>,
): CharacterDef {
  const stats = resolveArmorStats(character, equipment);
  return {
    ...character,
    health: stats.vitality,
    stamina: stats.stamina,
    armor: stats.armor,
    resistances: stats.resistances,
  };
}

export function canCraftArmor(item: ArmorDef, inventory: Readonly<ArmorInventory>): boolean {
  return !inventory.armor.includes(item.id) && item.recipe.every((cost) => (inventory.materials[cost.materialId] ?? 0) >= cost.quantity);
}

function title(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
