import type { CharacterDef, CombatPerks, ElementalResistances } from "../combat/types";

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
  "grave-step",
  "venom-edge",
  "static-conductor",
  "void-channel",
  "burning-brand",
] as const;
export type ArmorSkillId = (typeof ARMOR_SKILL_IDS)[number];
export type ResistanceId = keyof ElementalResistances;

export interface SkillEffect {
  vitality?: number;
  stamina?: number;
  resistance?: { type: ResistanceId; value: number };
  perk?: keyof CombatPerks;
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
  source?: string;
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
  /** The set's shared fantasy and the build behavior its three-piece perk enables. */
  setDescription: string;
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
  perks: CombatPerks;
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
  {
    id: "grave-step",
    name: "Grave Step",
    shortName: "STEP",
    description: "Three Gravecloth pieces make backdash startup strike-invulnerable.",
    thresholds: [
      { points: 1, description: "Gravecloth set affinity", effect: {} },
      { points: 3, description: "Backdash frames 1–3 ignore strikes", effect: { perk: "graveStep" } },
    ],
  },
  {
    id: "venom-edge",
    name: "Venom Edge",
    shortName: "VEN",
    description: "Three Briarbone pieces reduce poison-technique stamina costs.",
    thresholds: [
      { points: 1, description: "Briarbone set affinity", effect: {} },
      { points: 3, description: "Poison moves cost 5 less stamina", effect: { perk: "venomEdge" } },
    ],
  },
  {
    id: "static-conductor",
    name: "Static Conductor",
    shortName: "COND",
    description: "Three Stormglass pieces raise the shock stack limit.",
    thresholds: [
      { points: 1, description: "Stormglass set affinity", effect: {} },
      { points: 3, description: "Maximum shock stacks +1", effect: { perk: "staticConductor" } },
    ],
  },
  {
    id: "void-channel",
    name: "Void Channel",
    shortName: "VOID",
    description: "Three Voidwarden pieces make air routes more stamina-efficient.",
    thresholds: [
      { points: 1, description: "Voidwarden set affinity", effect: {} },
      { points: 3, description: "Air moves cost 5 less stamina", effect: { perk: "voidChannel" } },
    ],
  },
  {
    id: "burning-brand",
    name: "Burning Brand",
    shortName: "BRAND",
    description: "Three Crownfire pieces empower cashouts against burning targets.",
    thresholds: [
      { points: 1, description: "Crownfire set affinity", effect: {} },
      { points: 3, description: "Cashouts gain +2 hitstun vs burning", effect: { perk: "burningBrand" } },
    ],
  },
];

export const MATERIAL_CATALOG: readonly MaterialDef[] = [
  { id: "iron-scrap", name: "Iron Scrap", icon: "Fe", description: "Serviceable metal reclaimed from ruined armories.", source: "Black Belfry breakables" },
  { id: "grave-thread", name: "Grave Thread", icon: "Gt", description: "Cold thread spun from burial cloth and shadow.", source: "Black Belfry breakables" },
  { id: "briar-hide", name: "Briar Hide", icon: "Bh", description: "Thorn-tough hide cut from overgrown beasts." },
  { id: "venom-gland", name: "Venom Gland", icon: "Vg", description: "An intact gland used in poison-resistant weave." },
  { id: "stormglass", name: "Stormglass", icon: "Sg", description: "Charged crystal formed where lightning strikes sand.", source: "Bell Warden · Black Belfry" },
  { id: "frost-core", name: "Frost Core", icon: "Fc", description: "A core that stays frozen far from its original host." },
  { id: "umbral-cloth", name: "Umbral Cloth", icon: "Uc", description: "Dense cloth that seems to swallow nearby light." },
  { id: "cinder-heart", name: "Cinder Heart", icon: "Ch", description: "A furnace-hot heart from an elder fire beast." },
  { id: "warden-core", name: "Warden Core", icon: "Wc", description: "The resonant heart of the Bell Warden, still tolling under the metal.", source: "Bell Warden · Black Belfry" },
];

const SETS: ReadonlyArray<{
  id: string;
  name: string;
  grade: ArmorGrade;
  baseArmor: number;
  material: string;
  secondary: string;
  perkId: ArmorSkillId;
  skills: Readonly<Record<ArmorSlot, readonly ArmorSkillGrant[]>>;
}> = [
  {
    id: "gravecloth", name: "Gravecloth", grade: "white", baseArmor: 8, material: "grave-thread", secondary: "iron-scrap", perkId: "grave-step",
    skills: {
      head: [{ id: "vitality-up", points: 1 }],
      chest: [{ id: "poison-resistance", points: 1 }],
      arms: [{ id: "stamina-up", points: 1 }],
      waist: [{ id: "frost-resistance", points: 1 }],
      legs: [{ id: "fire-resistance", points: 1 }],
    },
  },
  {
    id: "briarbone", name: "Briarbone", grade: "green", baseArmor: 14, material: "briar-hide", secondary: "venom-gland", perkId: "venom-edge",
    skills: {
      head: [{ id: "poison-resistance", points: 2 }],
      chest: [{ id: "poison-resistance", points: 1 }, { id: "vitality-up", points: 1 }],
      arms: [{ id: "stamina-up", points: 2 }],
      waist: [{ id: "stamina-up", points: 1 }],
      legs: [{ id: "vitality-up", points: 1 }],
    },
  },
  {
    id: "stormglass", name: "Stormglass", grade: "blue", baseArmor: 22, material: "stormglass", secondary: "frost-core", perkId: "static-conductor",
    skills: {
      head: [{ id: "shock-resistance", points: 2 }],
      chest: [{ id: "shock-resistance", points: 1 }, { id: "vitality-up", points: 1 }],
      arms: [{ id: "frost-resistance", points: 2 }],
      waist: [{ id: "frost-resistance", points: 1 }],
      legs: [{ id: "stamina-up", points: 1 }],
    },
  },
  {
    id: "voidwarden", name: "Voidwarden", grade: "purple", baseArmor: 32, material: "umbral-cloth", secondary: "stormglass", perkId: "void-channel",
    skills: {
      head: [{ id: "vitality-up", points: 2 }],
      chest: [{ id: "vitality-up", points: 1 }, { id: "poison-resistance", points: 1 }],
      arms: [{ id: "fire-resistance", points: 2 }],
      waist: [{ id: "frost-resistance", points: 2 }],
      legs: [{ id: "stamina-up", points: 3 }],
    },
  },
  {
    id: "crownfire", name: "Crownfire", grade: "orange", baseArmor: 44, material: "cinder-heart", secondary: "umbral-cloth", perkId: "burning-brand",
    skills: {
      head: [{ id: "fire-resistance", points: 3 }, { id: "vitality-up", points: 1 }],
      chest: [{ id: "vitality-up", points: 3 }],
      arms: [{ id: "shock-resistance", points: 3 }],
      waist: [{ id: "stamina-up", points: 3 }],
      legs: [{ id: "vitality-up", points: 1 }, { id: "stamina-up", points: 2 }],
    },
  },
];

export const ARMOR_SET_DESCRIPTIONS: Readonly<Record<string, string>> = {
  Gravecloth: "Burial cloth reinforced with scavenged iron and stitched to move without sound. Three pieces awaken Grave Step, granting strike immunity during the opening frames of a backdash.",
  Briarbone: "Thorned hide and venom-treated bone plates built for relentless pressure. Three pieces activate Venom Edge, reducing the stamina cost of poison techniques.",
  Stormglass: "Conductive crystal armor that stores charge instead of dispersing it. Three pieces activate Static Conductor, allowing an additional Shock stack before cashout.",
  Voidwarden: "Umbral armor designed to remain weightless when its wearer leaves the ground. Three pieces activate Void Channel, reducing stamina costs for aerial techniques.",
  Crownfire: "Furnace-forged armor that turns a burning opponent's pain into an opening. Three pieces activate Burning Brand, increasing hitstun when cashing out against burning targets.",
};

const SLOT_NAMES: Record<ArmorSlot, string> = {
  head: "Helm",
  chest: "Mail",
  arms: "Vambraces",
  waist: "Coil",
  legs: "Greaves",
};

const SLOT_ICONS: Record<ArmorSlot, string> = { head: "H", chest: "C", arms: "A", waist: "W", legs: "L" };

const ITEM_DESCRIPTIONS: Readonly<Record<string, Readonly<Record<ArmorSlot, string>>>> = {
  gravecloth: {
    head: "A soot-dark burial hood pinned with an iron brow that never catches the light.",
    chest: "Layered gravecloth mail cut loose at the shoulders so its wearer can vanish mid-step.",
    arms: "Silent iron-thread wraps that keep a retreating guard quick and close.",
    waist: "A whisper-light burial sash weighted just enough to anchor sudden evasive movement.",
    legs: "Soft-soled greaves stitched for a backward step no blade can easily follow.",
  },
  briarbone: {
    head: "A thorn-crowned bone mask lacquered with venom until even its breath tastes bitter.",
    chest: "Overlapping briar hide and rib plates that flex under relentless close-range pressure.",
    arms: "Barbed bone bracers whose toxin channels feed every clawing hand technique.",
    waist: "A knotted hide belt hung with sealed venom glands for long, punishing engagements.",
    legs: "Hooked greaves that dig into the floor while poison pressure drives forward.",
  },
  stormglass: {
    head: "A faceted crystal helm that catches stray charge and cages it behind the eyes.",
    chest: "Conductive crystal mail designed to accumulate electrical charge without grounding the wearer.",
    arms: "Blue-glass vambraces webbed with gold conductors that make every impact crackle twice.",
    waist: "An insulated stormglass coil that keeps gathered voltage circling the core.",
    legs: "Charged crystal greaves that leave a sharp ozone trace across the arena floor.",
  },
  voidwarden: {
    head: "An umbral helm whose hollow crown seems to weigh less whenever the ground falls away.",
    chest: "Layered void-mail that loosens into weightless shadow the instant its wearer takes flight.",
    arms: "Long black vambraces tuned to guide aerial momentum through every reaching strike.",
    waist: "A gravity-thin coil that holds the body centered through impossible airborne turns.",
    legs: "Weightless greaves made to extend an air route without dragging its wearer back to earth.",
  },
  crownfire: {
    head: "A blackened crown whose vents glow hotter as nearby flesh burns.",
    chest: "Furnace-plated mail built to hold heat against the chest rather than shed it.",
    arms: "Heavy ignition bracers that channel violent motion directly through the hands.",
    waist: "A heat-scarred waistguard that anchors the body during committed attacks.",
    legs: "Forged greaves made for advancing through flame instead of away from it.",
  },
};

export const ARMOR_CATALOG: readonly ArmorDef[] = [
  ...SETS.flatMap((set) => ARMOR_SLOTS.map((slot, index): ArmorDef => ({
    id: `${set.id}-${slot}`,
    name: `${set.name} ${SLOT_NAMES[slot]}`,
    setName: set.name,
    slot,
    grade: set.grade,
    icon: SLOT_ICONS[slot],
    description: ITEM_DESCRIPTIONS[set.id]?.[slot] ?? `${set.name} ${SLOT_NAMES[slot].toLowerCase()}.`,
    setDescription: ARMOR_SET_DESCRIPTIONS[set.name] ?? "",
    armor: set.baseArmor + index,
    skills: [...set.skills[slot], { id: set.perkId, points: 1 }],
    recipe: [
      { materialId: set.material, quantity: 2 + index },
      { materialId: set.secondary, quantity: 1 + Math.trunc(index / 2) },
    ],
  }))),
  {
    id: "warden-arms",
    name: "Warden's Vambraces",
    setName: "Stormglass",
    slot: "arms",
    grade: "blue",
    icon: "W",
    description: "Bell-metal vambraces threaded with stormglass conductors and a captive cathedral resonance.",
    setDescription: ARMOR_SET_DESCRIPTIONS.Stormglass,
    armor: 27,
    skills: [{ id: "stamina-up", points: 2 }, { id: "static-conductor", points: 1 }],
    recipe: [{ materialId: "stormglass", quantity: 4 }, { materialId: "warden-core", quantity: 1 }],
  },
];

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
    "warden-core": 1,
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
  character: Pick<CharacterDef, "health" | "stamina" | "perks">,
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
  const perks: CombatPerks = {
    graveStep: false,
    venomEdge: false,
    staticConductor: false,
    voidChannel: false,
    burningBrand: false,
  };
  for (const skill of ARMOR_SKILLS) {
    const effect = activeSkillThreshold(skill, skillPoints[skill.id])?.effect;
    vitality += effect?.vitality ?? 0;
    stamina += effect?.stamina ?? 0;
    if (effect?.resistance) resistances[effect.resistance.type] += effect.resistance.value;
    if (effect?.perk) perks[effect.perk] = true;
  }
  return { vitality, stamina, armor, resistances, perks, skillPoints };
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
    perks: stats.perks,
  };
}

export function canCraftArmor(item: ArmorDef, inventory: Readonly<ArmorInventory>): boolean {
  return !inventory.armor.includes(item.id) && item.recipe.every((cost) => (inventory.materials[cost.materialId] ?? 0) >= cost.quantity);
}

function title(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
