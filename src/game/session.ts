import { BLACK_BELFRY } from "../content/black-belfry";
import type { StageDef } from "../combat/types";
import { px } from "../combat/constants";

export type GameMode = "campaign" | "fight" | "training";
export type StageId = "black-belfry-campaign" | "black-belfry-arena" | "training-grid";
export type OpponentId = "bell-warden" | "training-dummy";

export interface GameSession {
  mode: GameMode;
  playerLoadoutId: string;
  opponentId: OpponentId;
  stageId: StageId;
  options: {
    hazards: boolean;
    developerTools: boolean;
    tutorial: boolean;
  };
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
    description: "Cross the ruined belfry, unlock its forge, and confront the Bell Warden.",
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

export function defaultSession(mode: GameMode, loadoutId = "loadout-01", developerTools = false): GameSession {
  if (mode === "campaign") {
    return {
      mode,
      playerLoadoutId: loadoutId,
      opponentId: "bell-warden",
      stageId: "black-belfry-campaign",
      options: { hazards: true, developerTools, tutorial: false },
    };
  }
  if (mode === "fight") {
    return {
      mode,
      playerLoadoutId: loadoutId,
      opponentId: "bell-warden",
      stageId: "black-belfry-arena",
      options: { hazards: false, developerTools, tutorial: false },
    };
  }
  return {
    mode,
    playerLoadoutId: loadoutId,
    opponentId: "training-dummy",
    stageId: "training-grid",
    options: { hazards: false, developerTools, tutorial: false },
  };
}

export function readGameSession(url: URL): GameSession | null {
  const rawMode = url.searchParams.get("mode");
  const developerTools = url.pathname.startsWith("/training") && url.searchParams.get("debug") === "1";
  const mode: GameMode | null = rawMode === "campaign" || rawMode === "fight" || rawMode === "training"
    ? rawMode
    : developerTools ? "training" : null;
  if (!mode) return null;

  const fallback = defaultSession(mode, "loadout-01", developerTools);
  const loadout = url.searchParams.get("loadout");
  const stage = url.searchParams.get("stage");
  const opponent = url.searchParams.get("opponent");
  const compatibleOpponent = mode === "training" ? "training-dummy" : "bell-warden";
  return {
    ...fallback,
    playerLoadoutId: /^loadout-0[1-3]$/.test(loadout ?? "") ? loadout! : fallback.playerLoadoutId,
    stageId: stage && stage in STAGE_CATALOG && STAGE_CATALOG[stage as StageId].variant === mode
      ? stage as StageId
      : fallback.stageId,
    opponentId: opponent === compatibleOpponent ? opponent : fallback.opponentId,
    options: {
      ...fallback.options,
      tutorial: mode === "training" && url.searchParams.get("tutorial") === "1",
    },
  };
}

export function sessionUrl(session: GameSession): string {
  const path = session.mode === "training" ? "/training/" : "/play/";
  const query = new URLSearchParams({
    mode: session.mode,
    loadout: session.playerLoadoutId,
    opponent: session.opponentId,
    stage: session.stageId,
  });
  if (session.options.developerTools) query.set("debug", "1");
  if (session.options.tutorial) query.set("tutorial", "1");
  return `${path}?${query}`;
}
