import { toPixels } from "../combat/constants";
import type { CharacterDef, MoveDef } from "../combat/types";
import type { RawAnimation, RawRig } from "../content/raw-types";
import { sampleAnimation } from "../renderer/animation/animator";
import { applyPose, buildFighterNode } from "../renderer/character/rig";
import type { FighterNode } from "../renderer/character/rig";
import { drawMoveParticles } from "../renderer/svg/move-effects";
import { fmt, SVG_NS } from "../renderer/svg/stage";
import { moveLevel, moveName, primaryHitbox } from "./move-presentation";

export interface MoveDemonstrationAssets {
  model: string;
  rig: RawRig;
  animations: Record<string, RawAnimation>;
}

export type MoveDemonstrationMode = "demo" | "hit" | "block";

export interface MoveDemonstrationState {
  frame: number;
  move: MoveDef;
  playing: boolean;
  speed: number;
  mode: MoveDemonstrationMode;
}

/** A frame-exact, data-driven attacker/dummy demonstration for Armory and the Moves Codex. */
export class MoveDemonstration {
  private readonly character: CharacterDef;
  private readonly animations: Record<string, RawAnimation>;
  private readonly svg: SVGSVGElement;
  private readonly effects: SVGGElement;
  private readonly geometry: SVGGElement;
  private readonly annotations: SVGGElement;
  private readonly attacker: FighterNode;
  private readonly dummy: FighterNode;
  private readonly onState?: (state: MoveDemonstrationState) => void;
  private move: MoveDef | null = null;
  private mode: MoveDemonstrationMode = "demo";
  private speed = 0.5;
  private playing = true;
  private frame = 0;
  private lastNow = 0;
  private accumulator = 0;

  constructor(
    mount: HTMLElement,
    character: CharacterDef,
    assets: MoveDemonstrationAssets,
    onState?: (state: MoveDemonstrationState) => void,
  ) {
    this.character = character;
    this.animations = assets.animations;
    this.onState = onState;
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("viewBox", "-125 -170 250 200");
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "Move demonstration with attacker and training dummy");

    const backdrop = document.createElementNS(SVG_NS, "g");
    backdrop.setAttribute("class", "showcase-backdrop");
    const floor = document.createElementNS(SVG_NS, "line");
    floor.setAttribute("x1", "-112"); floor.setAttribute("x2", "112"); floor.setAttribute("y1", "0"); floor.setAttribute("y2", "0");
    backdrop.appendChild(floor);
    this.svg.appendChild(backdrop);

    this.geometry = document.createElementNS(SVG_NS, "g");
    this.geometry.setAttribute("class", "demonstration-geometry");
    this.svg.appendChild(this.geometry);
    this.effects = document.createElementNS(SVG_NS, "g");
    this.effects.setAttribute("class", "showcase-effects");
    this.svg.appendChild(this.effects);

    this.attacker = buildFighterNode(assets.model, assets.rig);
    this.attacker.root.classList.add("fighter-p1", "showcase-fighter", "demo-attacker");
    this.svg.appendChild(this.attacker.root);
    this.dummy = buildFighterNode(assets.model, assets.rig);
    this.dummy.root.classList.add("fighter-p2", "showcase-fighter", "demo-dummy");
    this.svg.appendChild(this.dummy.root);

    this.annotations = document.createElementNS(SVG_NS, "g");
    this.annotations.setAttribute("class", "demonstration-annotations");
    this.svg.appendChild(this.annotations);
    mount.appendChild(this.svg);
  }

  select(moveId: number): void {
    const next = this.character.moves.find((candidate) => candidate.id === moveId) ?? null;
    if (!next) return;
    this.move = next;
    this.frame = 0;
    this.accumulator = 0;
    this.lastNow = 0;
    this.playing = true;
    this.svg.setAttribute("aria-label", `Demonstration: ${moveName(next)}, ${this.mode} mode`);
    this.renderFrame();
    this.emit();
  }

  setMode(mode: MoveDemonstrationMode): void {
    this.mode = mode;
    this.frame = 0;
    this.accumulator = 0;
    this.playing = true;
    this.svg.setAttribute("aria-label", `Demonstration: ${this.move ? moveName(this.move) : "move"}, ${mode} mode`);
    this.renderFrame();
    this.emit();
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.5, Math.min(2, speed));
    this.emit();
  }

  toggle(): void {
    this.playing = !this.playing;
    this.lastNow = 0;
    this.emit();
  }

  step(delta: number): void {
    if (!this.move) return;
    this.playing = false;
    this.seek(this.frame + delta);
  }

  seek(frame: number): void {
    if (!this.move) return;
    this.frame = Math.max(0, Math.min(this.move.duration - 1, Math.trunc(frame)));
    this.accumulator = 0;
    this.lastNow = 0;
    this.renderFrame();
    this.emit();
  }

  render(now: number): void {
    if (!this.move) return;
    if (this.lastNow === 0) this.lastNow = now;
    const elapsed = Math.min(100, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    if (this.playing && document.documentElement.dataset.motion !== "reduced") {
      this.accumulator += elapsed * 60 / 1000 * this.speed;
      const frames = Math.trunc(this.accumulator);
      if (frames > 0) {
        this.accumulator -= frames;
        this.frame = (this.frame + frames) % this.move.duration;
        this.renderFrame();
        this.emit();
      }
    }
  }

  dispose(): void {
    this.svg.remove();
  }

  private renderFrame(): void {
    const move = this.move;
    if (!move) return;
    const hitbox = primaryHitbox(move);
    const firstActive = hitbox?.startFrame ?? move.startup;
    const contact = this.frame >= firstActive;
    const contactProgress = clamp((this.frame - firstActive + 1) / Math.max(1, move.duration - firstActive));
    const clip = this.animations[move.animation] ?? this.animations.idle;
    if (!clip) return;
    const poseFrame = Math.min(clip.duration, Math.trunc((this.frame / Math.max(1, move.duration - 1)) * clip.duration));
    applyPose(this.attacker, sampleAnimation(clip, poseFrame));

    const positions = this.positions(move, contactProgress);
    this.attacker.root.setAttribute("transform", `translate(${fmt(positions.attackerX)} ${fmt(positions.attackerY)}) scale(${fmt(positions.attackerFacing * 0.82)} .82)`);
    this.dummy.root.setAttribute("transform", `translate(${fmt(positions.dummyX)} ${fmt(positions.dummyY)}) scale(-.82 .82)`);

    const dummyAnimation = this.dummyAnimation(move, contact);
    const dummyClip = this.animations[dummyAnimation] ?? this.animations.idle;
    if (dummyClip) {
      const dummyFrame = contact ? Math.min(dummyClip.duration, Math.trunc(contactProgress * dummyClip.duration)) : 0;
      applyPose(this.dummy, sampleAnimation(dummyClip, dummyFrame));
    }

    this.effects.replaceChildren();
    if (this.frame >= Math.max(0, firstActive - 2)) {
      drawMoveParticles(this.effects, move, positions.attackerX, positions.attackerY - 42, positions.attackerFacing, this.frame, 0.82);
    }
    this.drawGeometry(move, positions.attackerX, positions.attackerY, positions.attackerFacing, contact);
    this.drawAnnotations(move, positions, contact, contactProgress);
  }

  private positions(move: MoveDef, progress: number): {
    attackerX: number; attackerY: number; attackerFacing: number; dummyX: number; dummyY: number;
  } {
    let attackerX = -48;
    let attackerY = move.airOk ? -42 : 0;
    let attackerFacing = 1;
    let dummyX = 46;
    let dummyY = 0;
    for (const movement of move.movement) {
      if (this.frame < movement.frame) continue;
      const elapsed = this.frame - movement.frame + 1;
      attackerX += clamp(toPixels(movement.vx) * elapsed * 0.45, -36, 60);
      attackerY -= clamp(toPixels(movement.vy) * elapsed * 0.38, -45, 58);
    }
    if (this.mode === "demo" && move.tags.includes("crossup") && progress > 0) {
      attackerX += progress * 82;
      attackerFacing = progress > 0.58 ? -1 : 1;
    }
    const hitbox = primaryHitbox(move);
    if (this.mode !== "block" && progress > 0) {
      if ((hitbox?.launchVelocityY ?? 0) > 0) dummyY -= progress * Math.min(62, 28 + toPixels(hitbox!.launchVelocityY) * 4);
      else if ((hitbox?.pushbackHitDefender ?? 0) < 0) dummyX -= progress * 27;
      else dummyX += progress * Math.min(18, Math.max(5, toPixels(hitbox?.pushbackHitDefender ?? 0) * 2));
    } else if (this.mode === "block" && progress > 0) {
      dummyX += progress * 6;
    }
    return { attackerX, attackerY, attackerFacing, dummyX, dummyY };
  }

  private dummyAnimation(move: MoveDef, contact: boolean): string {
    if (this.mode === "block") return moveLevel(move) === "low" ? "block_crouch" : "block_stand";
    if (!contact) return this.mode === "demo" && moveLevel(move) === "overhead" ? "crouch_idle" : "idle";
    if ((primaryHitbox(move)?.launchVelocityY ?? 0) > 0 || move.airOk) return "hit_air";
    return moveLevel(move) === "overhead" && this.mode === "demo" ? "hit_crouch" : "hit_stand";
  }

  private drawGeometry(move: MoveDef, attackerX: number, attackerY: number, facing: number, active: boolean): void {
    this.geometry.replaceChildren();
    for (const hitbox of move.hitboxes) {
      const rect = document.createElementNS(SVG_NS, "rect");
      const x = toPixels(hitbox.box.x);
      const y = toPixels(hitbox.box.y);
      const width = toPixels(hitbox.box.w);
      const height = toPixels(hitbox.box.h);
      rect.setAttribute("class", `demonstration-hitbox${active && this.frame >= hitbox.startFrame && this.frame <= hitbox.endFrame ? " active" : ""}`);
      rect.setAttribute("x", fmt(attackerX + (facing === 1 ? x : -x - width) * 0.82));
      rect.setAttribute("y", fmt(attackerY - (y + height) * 0.82));
      rect.setAttribute("width", fmt(width * 0.82));
      rect.setAttribute("height", fmt(height * 0.82));
      this.geometry.appendChild(rect);
    }
  }

  private drawAnnotations(
    move: MoveDef,
    positions: { attackerX: number; attackerY: number; dummyX: number; dummyY: number },
    contact: boolean,
    progress: number,
  ): void {
    this.annotations.replaceChildren();
    this.annotations.appendChild(label(-108, -151, "PLAYER", "demo-fighter-label"));
    this.annotations.appendChild(label(64, -151, "DUMMY", "demo-fighter-label"));
    this.annotations.appendChild(label(-108, 18, featureLabel(move, this.mode), "demo-feature-label"));
    if (contact) {
      this.annotations.appendChild(label(positions.dummyX - 18, positions.dummyY - 118, this.mode === "block" ? "BLOCK" : "HIT", `demo-contact-label ${this.mode}`));
      const status = move.tags.find((tag) => ["burn", "poison", "freeze", "shock", "bleed", "void"].includes(tag));
      if (status && this.mode !== "block") this.annotations.appendChild(label(positions.dummyX - 19, positions.dummyY - 103, `+ ${status.toUpperCase()}`, `demo-status-label status-${status}`));
    }
    const invulnerable = move.invulWindows.some((window) => this.frame >= window.startFrame && this.frame <= window.endFrame);
    const armored = move.armorWindows.some((window) => this.frame >= window.startFrame && this.frame <= window.endFrame);
    if (this.mode === "demo" && (invulnerable || armored)) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("class", `demo-threat ${invulnerable ? "miss" : "armor"}`);
      line.setAttribute("x1", "48"); line.setAttribute("y1", "-66"); line.setAttribute("x2", "-27"); line.setAttribute("y2", "-66");
      this.annotations.appendChild(line);
      this.annotations.appendChild(label(-24, -72, invulnerable ? "MISS · INVUL" : "ABSORBED · ARMOR", "demo-window-label"));
    }
    const cancel = move.cancelWindows.find((window) => this.frame >= window.startFrame && this.frame <= window.endFrame);
    if (cancel) {
      const suggestions = cancel.into.slice(0, 4).map((id) => this.character.moves.find((candidate) => candidate.id === id)).filter((candidate): candidate is MoveDef => candidate !== undefined);
      this.annotations.appendChild(label(-108, -132, `CANCEL → ${suggestions.map((candidate) => moveName(candidate).toUpperCase()).join(" · ")}`, "demo-cancel-label"));
    }
    if (this.mode === "demo" && move.tags.includes("crossup") && progress > 0.35) this.annotations.appendChild(label(-10, -118, "CROSSUP", "demo-window-label"));
  }

  private emit(): void {
    if (!this.move) return;
    this.onState?.({ frame: this.frame, move: this.move, playing: this.playing, speed: this.speed, mode: this.mode });
  }
}

function label(x: number, y: number, value: string, className: string): SVGTextElement {
  const node = document.createElementNS(SVG_NS, "text");
  node.setAttribute("x", fmt(x)); node.setAttribute("y", fmt(y)); node.setAttribute("class", className);
  node.textContent = value;
  return node;
}

function featureLabel(move: MoveDef, mode: MoveDemonstrationMode): string {
  if (mode === "hit") return `${moveLevel(move).toUpperCase()} · NORMAL HIT`;
  if (mode === "block") return `${moveLevel(move).toUpperCase()} · BLOCK INTERACTION`;
  if (move.armorWindows.length > 0) return "HYPER ARMOR ABSORBS A STRIKE";
  if (move.invulWindows.length > 0 && (primaryHitbox(move)?.launchVelocityY ?? 0) > 0) return "INVULNERABLE LAUNCH → AERIAL CANCEL";
  if (move.invulWindows.length > 0) return "INVULNERABLE STARTUP → REVERSAL HIT";
  if ((primaryHitbox(move)?.pushbackHitDefender ?? 0) < 0) return "CONTACT PULLS THE DUMMY INWARD";
  if (move.tags.includes("crossup")) return "FRONT + REAR COVERAGE";
  if (move.airOk && moveLevel(move) === "overhead") return "AIRBORNE DESCENT → OVERHEAD";
  if ((primaryHitbox(move)?.launchVelocityY ?? 0) > 0) return "CONTACT LAUNCHES THE DUMMY";
  const status = move.tags.find((tag) => ["burn", "poison", "freeze", "shock", "bleed"].includes(tag));
  return `${moveLevel(move).toUpperCase()} · ${status ? `${status.toUpperCase()} ROUTE` : "CANONICAL FEATURE"}`;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}
