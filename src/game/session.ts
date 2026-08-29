import { BLACK_BELFRY } from "../content/black-belfry";
import type { StageDef } from "../combat/types";
import { px } from "../combat/constants";

export type GameMode = "campaign" | "fight" | "training";
export type StageId = "black-belfry-campaign" | "black-belfry-arena" | "training-grid";
export type EncounterId = "bell-warden" | "training-dummy";
export type PartyController = "human" | "ai";
export type AiDifficulty = "apprentice" | "standard" | "master";

/** Presentation-independent knobs used by the deterministic loadout controller. */
export interface AiProfile {
  difficulty: AiDifficulty;
  reactionDelay: number;
  predictionHorizon: number;
  routeDepth: number;
  defensiveConsistency: number;
  spacingAccuracy: number;
  /** Number of top-scored moves considered when no intentional mistake is made. */
  choiceBreadth: number;
  mistakeFrequency: number;
  aggression: number;
}

/** A controller occupies a party slot; authored loadouts remain the character authority. */
export interface PartySlot {
  id: string;
  controller: PartyController;
  loadoutId: string;
  aiProfile?: AiProfile;
}

export interface SessionOptions {
  hazards: boolean;
  developerTools: boolean;
  tutorial: boolean;
  friendlyFire: boolean;
}

export interface GameSession {
  mode: GameMode;
  party: PartySlot[];
  encounterId: EncounterId;
  stageId: StageId;
  options: SessionOptions;
}

export interface StageCatalogEntry {
  id: StageId;
  familyId: "black-belfry" | "training";
  name: string;
  variant: "campaign" | "fight" | "training";
  description: string;
  size: "Compact" | "Large";
  hazards: boolean;
  terrain: "Static" | "Scrolling";
  stage: StageDef;
}

const LOADOUT_ID = /^loadout-0[1-3]$/;
const MAX_PARTY_SIZE = 3;

const BLACK_BELFRY_CAMPAIGN: StageDef = { ...BLACK_BELFRY, id: "black-belfry-campaign" };

const BLACK_BELFRY_ARENA: StageDef = {
  id: "black-belfry-arena",
  width: px(760),
  spawnX: px(-220),
  cameraBounds: { minX: px(-380), maxX: px(380) },
  bossArena: { gateX: px(-380), minX: px(-380), maxX: px(380) },
  checkpoints: [],
  interactables: [],
  breakables: [],
  hazards: [],
  backdrop: "black-belfry",
};

const TRAINING_GRID: StageDef = {
  id: "training-grid",
  width: px(960),
  spawnX: 0,
  cameraBounds: { minX: px(-480), maxX: px(480) },
  bossArena: { gateX: px(-480), minX: px(-480), maxX: px(480) },
  checkpoints: [],
  interactables: [],
  breakables: [],
  hazards: [],
  backdrop: "training-grid",
};

export const STAGE_CATALOG: Readonly<Record<StageId, StageCatalogEntry>> = {
  "black-belfry-campaign": {
    id: "black-belfry-campaign",
    familyId: "black-belfry",
    name: "Black Belfry",
    variant: "campaign",
    description: "Cross the ruined belfry and confront the Bell Warden.",
    size: "Large",
    hazards: true,
    terrain: "Scrolling",
    stage: BLACK_BELFRY_CAMPAIGN,
  },
  "black-belfry-arena": {
    id: "black-belfry-arena",
    familyId: "black-belfry",
    name: "Warden Arena",
    variant: "fight",
    description: "A duel-only Black Belfry variant with campaign traversal removed.",
    size: "Compact",
    hazards: false,
    terrain: "Static",
    stage: BLACK_BELFRY_ARENA,
  },
  "training-grid": {
    id: "training-grid",
    familyId: "training",
    name: "Training Grid",
    variant: "training",
    description: "A neutral deterministic space for recording, playback, and frame study.",
    size: "Compact",
    hazards: false,
    terrain: "Static",
    stage: TRAINING_GRID,
  },
};

export function aiProfile(difficulty: AiDifficulty = "standard"): AiProfile {
  if (difficulty === "apprentice") {
    return {
      difficulty,
      reactionDelay: 18,
      predictionHorizon: 4,
      routeDepth: 1,
      defensiveConsistency: 42,
      spacingAccuracy: 58,
      choiceBreadth: 6,
      mistakeFrequency: 22,
      aggression: 48,
    };
  }
  if (difficulty === "master") {
    return {
      difficulty,
      reactionDelay: 4,
      predictionHorizon: 18,
      routeDepth: 4,
      defensiveConsistency: 92,
      spacingAccuracy: 94,
      choiceBreadth: 1,
      mistakeFrequency: 3,
      aggression: 78,
    };
  }
  return {
    difficulty,
    reactionDelay: 9,
    predictionHorizon: 10,
    routeDepth: 3,
    defensiveConsistency: 72,
    spacingAccuracy: 78,
    choiceBreadth: 3,
    mistakeFrequency: 10,
    aggression: 64,
  };
}

export function humanSlot(loadoutId = "loadout-01"): PartySlot {
  return { id: "party-1", controller: "human", loadoutId };
}

export function aiSlot(loadoutId: string, index = 2, difficulty: AiDifficulty = "standard"): PartySlot {
  return { id: `party-${index}`, controller: "ai", loadoutId, aiProfile: aiProfile(difficulty) };
}

export function defaultSession(mode: GameMode, loadoutId = "loadout-01", developerTools = false): GameSession {
  const common = {
    mode,
    party: [humanSlot(loadoutId)],
    options: { hazards: mode === "campaign", developerTools, tutorial: false, friendlyFire: false },
  };
  if (mode === "campaign") {
    return { ...common, encounterId: "bell-warden", stageId: "black-belfry-campaign" };
  }
  if (mode === "fight") {
    return { ...common, encounterId: "bell-warden", stageId: "black-belfry-arena" };
  }
  return { ...common, encounterId: "training-dummy", stageId: "training-grid" };
}

export function readGameSession(url: URL): GameSession | null {
  const rawMode = url.searchParams.get("mode");
  const developerTools = (url.pathname.startsWith("/play") || url.pathname.startsWith("/training")) && url.searchParams.get("debug") === "1";
  const mode: GameMode | null = rawMode === "campaign" || rawMode === "fight" || rawMode === "training"
    ? rawMode
    : developerTools ? "training" : null;
  if (!mode) return null;

  const legacyLoadout = validLoadout(url.searchParams.get("loadout")) ?? "loadout-01";
  const fallback = defaultSession(mode, legacyLoadout, developerTools);
  const stage = url.searchParams.get("stage");
  const encounter = url.searchParams.get("encounter") ?? url.searchParams.get("opponent");
  return {
    ...fallback,
    party: readParty(url.searchParams.get("party"), legacyLoadout, mode),
    stageId: stage && stage in STAGE_CATALOG && STAGE_CATALOG[stage as StageId].variant === mode
      ? stage as StageId
      : fallback.stageId,
    encounterId: encounter === (mode === "training" ? "training-dummy" : "bell-warden")
      ? encounter
      : fallback.encounterId,
    options: {
      ...fallback.options,
      tutorial: mode === "training" && url.searchParams.get("tutorial") === "1",
      friendlyFire: mode !== "training" && url.searchParams.get("friendlyFire") === "1",
    },
  };
}

export function sessionUrl(session: GameSession): string {
  const query = new URLSearchParams({
    mode: session.mode,
    party: writeParty(session.party),
    encounter: session.encounterId,
    stage: session.stageId,
  });
  if (session.options.developerTools) query.set("debug", "1");
  if (session.options.tutorial) query.set("tutorial", "1");
  if (session.options.friendlyFire) query.set("friendlyFire", "1");
  const route = session.mode === "training" ? "play" : session.mode;
  return `/${route}/?${query}`;
}

function readParty(value: string | null, legacyLoadout: string, mode: GameMode): PartySlot[] {
  if (!value) return [humanSlot(legacyLoadout)];
  const slots: PartySlot[] = [];
  for (const token of value.split(",").slice(0, MAX_PARTY_SIZE)) {
    const [controllerCode, rawLoadout, rawDifficulty] = token.split(".");
    const loadoutId = validLoadout(rawLoadout);
    if (!loadoutId) continue;
    if (slots.length === 0) {
      slots.push(humanSlot(loadoutId));
      continue;
    }
    if (mode !== "training" && controllerCode === "a") {
      const difficulty = isDifficulty(rawDifficulty) ? rawDifficulty : "standard";
      slots.push(aiSlot(loadoutId, slots.length + 1, difficulty));
    }
  }
  return slots.length > 0 ? slots : [humanSlot(legacyLoadout)];
}

function writeParty(party: readonly PartySlot[]): string {
  return party.slice(0, MAX_PARTY_SIZE).map((slot, index) => {
    const controller = index === 0 ? "h" : slot.controller === "ai" ? "a" : "h";
    const difficulty = slot.aiProfile?.difficulty ?? "standard";
    return `${controller}.${validLoadout(slot.loadoutId) ?? "loadout-01"}.${difficulty}`;
  }).join(",");
}

function validLoadout(value: string | null | undefined): string | null {
  return value && LOADOUT_ID.test(value) ? value : null;
}

function isDifficulty(value: string | undefined): value is AiDifficulty {
  return value === "apprentice" || value === "standard" || value === "master";
}
