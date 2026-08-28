import { px } from "../combat/constants";
import { Simulation } from "../combat/simulation/simulation";
import type {
  CharacterDef,
  FrameReport,
  InputFrame,
  MoveDef,
  SimConfig,
  SimState,
} from "../combat/types";
import { actionBit, ContactKind, HitLevel, InputBit, StateId } from "../combat/types";

export type MoveDemonstrationMode = "demo" | "hit" | "block";
export type MoveDemonstrationPhase =
  | "lead-in"
  | "startup"
  | "active"
  | "contact"
  | "hitstop"
  | "reaction"
  | "recovery"
  | "aftermath";

export interface MoveDemonstrationFrame {
  state: SimState;
  report: FrameReport | null;
  moveFrame: number;
  phase: MoveDemonstrationPhase;
}

export interface MoveDemonstrationScenario {
  character: CharacterDef;
  frames: MoveDemonstrationFrame[];
  contactKind: (typeof ContactKind)[keyof typeof ContactKind] | null;
}

const FINAL_HOLD_FRAMES = 42;
const MAX_SCENARIO_FRAMES = 360;

/**
 * Run one selected move through the production simulation and retain every visible state.
 * The Codex consumes these exact snapshots; it never approximates movement or reactions.
 */
export function buildMoveDemonstrationScenario(
  source: CharacterDef,
  move: MoveDef,
  mode: MoveDemonstrationMode,
): MoveDemonstrationScenario {
  const character = demonstrationCharacter(source, move);
  const config: SimConfig = {
    characters: [character, source],
    startX: [px(-18), px(18)],
    seed: 0x0c0de,
  };
  const sim = new Simulation(config);
  const initial = sim.getState();
  const leadIn = move.airOk ? 3 : 12;

  if (move.airOk) {
    const attacker = initial.fighters[0];
    attacker.y = px(54);
    attacker.vy = 0;
    attacker.airborne = 1;
    attacker.state = StateId.Airborne;
  }

  const frames: MoveDemonstrationFrame[] = [{
    state: cloneState(initial),
    report: null,
    moveFrame: 0,
    phase: "lead-in",
  }];
  let started = false;
  let finishedAt = -1;
  let contactKind: MoveDemonstrationScenario["contactKind"] = null;

  for (let scriptFrame = 0; scriptFrame < MAX_SCENARIO_FRAMES; scriptFrame++) {
    const attacker = sim.getState().fighters[0];
    const attackInput = scriptFrame === leadIn
      ? actionBit(0) | (move.requiresCrouch ? InputBit.Down : 0)
      : move.requiresCrouch && !started ? InputBit.Down : 0;
    const inputs: [InputFrame, InputFrame] = [
      attackInput,
      scriptFrame >= leadIn ? defenderInput(sim.getState(), move, mode) : 0,
    ];
    const report = sim.step(inputs);
    const state = sim.getState();
    if (report.moveStarts.some((event) => event.player === 0 && event.moveId === move.id)) started = true;
    const contact = report.contacts.find((event) => event.attacker === 0 && event.moveId === move.id);
    if (contact) contactKind = contact.kind;

    if (started && attacker.moveId !== move.id && finishedAt < 0) finishedAt = scriptFrame;
    const moveFrame = attacker.moveId === move.id
      ? attacker.moveFrame
      : started ? move.duration - 1 : 0;
    frames.push({
      state: cloneState(state),
      report: cloneReport(report),
      moveFrame,
      phase: phaseFor(move, state, report, started),
    });

    if (finishedAt >= 0 && scriptFrame - finishedAt >= FINAL_HOLD_FRAMES) break;
  }

  return { character, frames, contactKind };
}

function demonstrationCharacter(source: CharacterDef, move: MoveDef): CharacterDef {
  return {
    ...source,
    commands: [{
      moveId: move.id,
      buttons: actionBit(0),
      motion: [],
      motionWindow: 0,
      requiresCrouch: move.requiresCrouch,
      requiresAir: move.airOk,
      priority: 1,
    }],
  };
}

function defenderInput(state: SimState, move: MoveDef, mode: MoveDemonstrationMode): InputFrame {
  if (mode !== "block") return 0;
  const defender = state.fighters[1];
  const attacker = state.fighters[0];
  const away = attacker.x > defender.x ? InputBit.Left : InputBit.Right;
  return move.hitboxes[0]?.level === HitLevel.Low ? away | InputBit.Down : away;
}

function phaseFor(
  move: MoveDef,
  state: SimState,
  report: FrameReport,
  started: boolean,
): MoveDemonstrationPhase {
  if (report.contacts.some((event) => event.attacker === 0 && event.moveId === move.id)) return "contact";
  const attacker = state.fighters[0];
  const defender = state.fighters[1];
  if (!started) return "lead-in";
  if (attacker.hitstop > 0 || defender.hitstop > 0) return "hitstop";
  if (attacker.moveId === move.id) {
    if (attacker.moveFrame < move.startup) return "startup";
    if (attacker.moveFrame < move.startup + move.active) return "active";
    return "recovery";
  }
  if (defender.stun > 0 || defender.airborne === 1) return "reaction";
  return "aftermath";
}

function cloneState(state: SimState): SimState {
  return structuredClone(state);
}

function cloneReport(report: FrameReport): FrameReport {
  return structuredClone(report);
}
