import type { CharacterDef } from "../combat/types";

export const GEAR_SLOTS = ["focus", "ward", "sigil", "mantle", "charm", "relic"] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

export type GearRarity = "rare" | "epic" | "legendary";

export interface GearDef {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: GearRarity;
  icon: string;
  tags: string[];
  description: string;
  healthBonus: number;
  damageTag: string | null;
  damagePercent: number;
  hitstunTag: string | null;
  hitstunBonus: number;
}

export const GEAR_CATALOG: readonly GearDef[] = [
  { id: "cinder-crown", name: "Cinder Crown", slot: "focus", rarity: "legendary", icon: "C", tags: ["fire", "burn"], description: "Amplifies fire routes and makes every ignition hit harder.", healthBonus: 0, damageTag: "burn", damagePercent: 12, hitstunTag: null, hitstunBonus: 0 },
  { id: "viperglass-eye", name: "Viperglass Eye", slot: "focus", rarity: "epic", icon: "V", tags: ["chaos", "poison"], description: "Sharpens poison attacks for stacking damage-over-time routes.", healthBonus: 0, damageTag: "poison", damagePercent: 10, hitstunTag: null, hitstunBonus: 0 },
  { id: "hoarfrost-ward", name: "Hoarfrost Ward", slot: "ward", rarity: "epic", icon: "H", tags: ["cold", "freeze"], description: "Adds vitality and extends the advantage of freeze attacks.", healthBonus: 80, damageTag: null, damagePercent: 0, hitstunTag: "freeze", hitstunBonus: 3 },
  { id: "iron-aegis", name: "Iron Aegis", slot: "ward", rarity: "rare", icon: "I", tags: ["physical", "armour"], description: "A dependable ward that increases maximum health.", healthBonus: 130, damageTag: null, damagePercent: 0, hitstunTag: null, hitstunBonus: 0 },
  { id: "tempest-seal", name: "Tempest Seal", slot: "sigil", rarity: "legendary", icon: "T", tags: ["lightning", "shock"], description: "Empowers shock primers before a heavy cash-out hit.", healthBonus: 0, damageTag: "shock", damagePercent: 12, hitstunTag: null, hitstunBonus: 0 },
  { id: "hemorrhage-rune", name: "Hemorrhage Rune", slot: "sigil", rarity: "epic", icon: "B", tags: ["physical", "bleed"], description: "Strengthens bleed routes and execute setup.", healthBonus: 0, damageTag: "bleed", damagePercent: 10, hitstunTag: null, hitstunBonus: 0 },
  { id: "voidweave-mantle", name: "Voidweave Mantle", slot: "mantle", rarity: "legendary", icon: "N", tags: ["void", "control"], description: "Turns void control attacks into credible route anchors.", healthBonus: 50, damageTag: "void", damagePercent: 9, hitstunTag: "control", hitstunBonus: 2 },
  { id: "ashwalker-coat", name: "Ashwalker Coat", slot: "mantle", rarity: "rare", icon: "A", tags: ["fire", "mobility"], description: "A lighter mantle tuned for mobile fire builds.", healthBonus: 40, damageTag: "fire", damagePercent: 7, hitstunTag: null, hitstunBonus: 0 },
  { id: "plague-heart", name: "Plague Heart", slot: "charm", rarity: "legendary", icon: "P", tags: ["poison", "sustain"], description: "Raises poison damage without giving up survivability.", healthBonus: 45, damageTag: "poison", damagePercent: 8, hitstunTag: null, hitstunBonus: 0 },
  { id: "winterglass-charm", name: "Winterglass Charm", slot: "charm", rarity: "epic", icon: "W", tags: ["freeze", "control"], description: "Makes cold links hold opponents longer.", healthBonus: 25, damageTag: null, damagePercent: 0, hitstunTag: "freeze", hitstunBonus: 2 },
  { id: "executioners-obol", name: "Executioner's Obol", slot: "relic", rarity: "legendary", icon: "E", tags: ["execute", "bleed"], description: "Rewards ending a bleed route with an execute-tagged finisher.", healthBonus: 0, damageTag: "execute", damagePercent: 16, hitstunTag: null, hitstunBonus: 0 },
  { id: "prismatic-shard", name: "Prismatic Shard", slot: "relic", rarity: "epic", icon: "R", tags: ["elemental", "burn", "freeze", "shock"], description: "A flexible relic for mixed elemental decks.", healthBonus: 0, damageTag: "elemental", damagePercent: 12, hitstunTag: null, hitstunBonus: 0 },
];

export const DEFAULT_EQUIPMENT: Record<GearSlot, string> = {
  focus: "cinder-crown",
  ward: "hoarfrost-ward",
  sigil: "tempest-seal",
  mantle: "voidweave-mantle",
  charm: "plague-heart",
  relic: "executioners-obol",
};

export function gearById(id: string): GearDef | null {
  return GEAR_CATALOG.find((item) => item.id === id) ?? null;
}

/** Build a deterministic combat definition from device-local equipment choices. */
export function applyEquipment(
  character: CharacterDef,
  equipment: Readonly<Partial<Record<GearSlot, string>>>,
): CharacterDef {
  const items = GEAR_SLOTS.map((slot) => gearById(equipment[slot] ?? "")).filter(
    (item): item is GearDef => item !== null,
  );
  const healthBonus = items.reduce((sum, item) => sum + item.healthBonus, 0);
  const moves = character.moves.map((move) => {
    let damagePercent = 0;
    let hitstunBonus = 0;
    for (const item of items) {
      if (item.damageTag && move.tags.includes(item.damageTag)) damagePercent += item.damagePercent;
      if (item.hitstunTag && move.tags.includes(item.hitstunTag)) hitstunBonus += item.hitstunBonus;
    }
    return {
      ...move,
      hitboxes: move.hitboxes.map((hitbox) => ({
        ...hitbox,
        damage: Math.trunc((hitbox.damage * (100 + damagePercent)) / 100),
        hitstun: hitbox.hitstun + hitstunBonus,
      })),
    };
  });
  return { ...character, health: character.health + healthBonus, moves };
}
