import type { CharacterDef, MoveDef } from "../combat/types";
import { ContactKind } from "../combat/types";
import type { RawAnimation, RawRig } from "../content/raw-types";
import type { AnimationPlayback } from "../renderer/animation/animator";
import type { DebugToggles } from "../renderer/svg/debug-overlay";
import { Renderer } from "../renderer/svg/renderer";
import { buildMoveDemonstrationScenario } from "./move-demonstration-scenario";
import type {
  MoveDemonstrationMode,
  MoveDemonstrationPhase,
  MoveDemonstrationScenario,
} from "./move-demonstration-scenario";
import { moveName } from "./move-presentation";

export type { MoveDemonstrationMode } from "./move-demonstration-scenario";

export interface MoveDemonstrationAssets {
  model: string;
  rig: RawRig;
  animations: Record<string, RawAnimation>;
  playback?: Readonly<Record<string, AnimationPlayback>>;
}

export interface MoveDemonstrationState {
  frame: number;
  move: MoveDef;
  playing: boolean;
  speed: number;
  mode: MoveDemonstrationMode;
  phase: MoveDemonstrationPhase;
}

const NO_DEBUG: DebugToggles = {
  hitboxes: false,
  hurtboxes: false,
  pushboxes: false,
  origins: false,
  skeleton: false,
  boneNames: false,
  velocity: false,
};

/** A deterministic mini-match rendered from real SimState and FrameReport snapshots. */
export class MoveDemonstration {
  private readonly character: CharacterDef;
  private readonly renderer: Renderer;
  private readonly annotation: HTMLOutputElement;
  private readonly onState?: (state: MoveDemonstrationState) => void;
  private move: MoveDef | null = null;
  private scenario: MoveDemonstrationScenario | null = null;
  private mode: MoveDemonstrationMode = "demo";
  private speed = 0.5;
  private playing = false;
  private active = false;
  private cursor = 0;
  private lastNow = 0;
  private accumulator = 0;

  constructor(
    mount: HTMLElement,
    character: CharacterDef,
    assets: MoveDemonstrationAssets,
    onState?: (state: MoveDemonstrationState) => void,
  ) {
    this.character = character;
    this.onState = onState;
    mount.classList.add("simulation-demonstration");
    this.renderer = new Renderer(mount, [character, character], {
      fighters: [0, 1].map(() => ({
        model: assets.model,
        rig: assets.rig,
        animations: assets.animations,
        playback: assets.playback,
      })),
    });
    const stage = mount.querySelector<SVGSVGElement>("svg");
    stage?.setAttribute("viewBox", "-128 -178 256 218");
    stage?.setAttribute("aria-label", "Authoritative move demonstration with attacker and dummy");
    this.annotation = document.createElement("output");
    this.annotation.className = "demonstration-event";
    this.annotation.setAttribute("aria-live", "polite");
    mount.appendChild(this.annotation);
  }

  select(moveId: number, autoplay = true): void {
    const next = this.character.moves.find((candidate) => candidate.id === moveId) ?? null;
    if (!next) return;
    this.move = next;
    this.rebuild(autoplay);
  }

  setMode(mode: MoveDemonstrationMode, autoplay = true): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.rebuild(autoplay);
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.5, Math.min(2, speed));
    this.emit();
  }

  /** Opening a visible panel restarts its demo; closing it stops all hidden work. */
  setActive(active: boolean, autoplay = true): void {
    if (this.active === active) return;
    this.active = active;
    this.cursor = 0;
    this.accumulator = 0;
    this.lastNow = 0;
    this.playing = active && autoplay;
    this.renderFrame();
    this.emit();
  }

  /** Explicit playback is always honoured, including under reduced-motion settings. */
  toggle(): void {
    if (!this.scenario || !this.active) return;
    this.playing = !this.playing;
    this.lastNow = 0;
    this.emit();
  }

  step(delta: number): void {
    if (!this.move) return;
    this.playing = false;
    this.seek(this.currentFrame() + delta);
  }

  seek(frame: number): void {
    const move = this.move;
    const scenario = this.scenario;
    if (!move || !scenario) return;
    const target = Math.max(0, Math.min(move.duration - 1, Math.trunc(frame)));
    const exact = scenario.frames.findIndex((item) =>
      item.moveFrame === target && item.state.fighters[0].moveId === move.id,
    );
    this.cursor = exact >= 0 ? exact : closestFrame(scenario, target);
    this.accumulator = 0;
    this.lastNow = 0;
    this.renderFrame();
    this.emit();
  }

  render(now: number): void {
    const scenario = this.scenario;
    if (!this.active || !scenario) return;
    if (this.lastNow === 0) this.lastNow = now;
    const elapsed = Math.min(100, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    if (!this.playing) return;

    this.accumulator += elapsed * 60 / 1000 * this.speed;
    const frames = Math.trunc(this.accumulator);
    if (frames <= 0) return;
    this.accumulator -= frames;
    this.cursor = (this.cursor + frames) % scenario.frames.length;
    this.renderFrame();
    this.emit();
  }

  dispose(): void {
    this.renderer.dispose();
    this.annotation.remove();
  }

  private rebuild(autoplay = true): void {
    if (!this.move) return;
    this.scenario = buildMoveDemonstrationScenario(this.character, this.move, this.mode);
    this.cursor = 0;
    this.accumulator = 0;
    this.lastNow = 0;
    this.playing = this.active && autoplay;
    this.renderFrame();
    this.emit();
  }

  private renderFrame(): void {
    const move = this.move;
    const item = this.scenario?.frames[this.cursor];
    if (!move || !item) return;
    this.renderer.render(item.state, item.report, NO_DEBUG);
    const contact = item.report?.contacts.find((event) => event.attacker === 0 && event.moveId === move.id);
    this.annotation.className = `demonstration-event phase-${item.phase}`;
    this.annotation.textContent = contact
      ? contact.kind === ContactKind.Block ? "BLOCK" : "HIT"
      : `${phaseLabel(item.phase)} · ${moveName(move).toUpperCase()}`;
  }

  private currentFrame(): number {
    return this.scenario?.frames[this.cursor]?.moveFrame ?? 0;
  }

  private emit(): void {
    if (!this.move || !this.scenario) return;
    this.onState?.({
      frame: this.currentFrame(),
      move: this.move,
      playing: this.playing,
      speed: this.speed,
      mode: this.mode,
      phase: this.scenario.frames[this.cursor]?.phase ?? "lead-in",
    });
  }
}

function closestFrame(scenario: MoveDemonstrationScenario, target: number): number {
  let index = 0;
  let distance = Number.POSITIVE_INFINITY;
  scenario.frames.forEach((frame, candidate) => {
    const next = Math.abs(frame.moveFrame - target);
    if (next < distance) {
      distance = next;
      index = candidate;
    }
  });
  return index;
}

function phaseLabel(phase: MoveDemonstrationPhase): string {
  if (phase === "lead-in") return "READY";
  if (phase === "hitstop") return "HITSTOP";
  if (phase === "reaction") return "REACTION";
  if (phase === "aftermath") return "RESULT";
  return phase.toUpperCase();
}
