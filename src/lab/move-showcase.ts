import type { CharacterDef, MoveDef } from "../combat/types";
import type { RawAnimation, RawRig } from "../content/raw-types";
import { sampleAnimation } from "../renderer/animation/animator";
import { applyPose, buildFighterNode } from "../renderer/character/rig";
import type { FighterNode } from "../renderer/character/rig";
import { drawMoveParticles } from "../renderer/svg/move-effects";
import { SVG_NS } from "../renderer/svg/stage";

export interface MoveShowcaseAssets {
  model: string;
  rig: RawRig;
  animations: Record<string, RawAnimation>;
}

/** Replays the authored presentation clip for whichever move owns hover or focus. */
export class MoveShowcase {
  private readonly character: CharacterDef;
  private readonly animations: Record<string, RawAnimation>;
  private readonly svg: SVGSVGElement;
  private readonly effects: SVGGElement;
  private readonly fighter: FighterNode;
  private move: MoveDef | null = null;
  private startedAt = performance.now();

  constructor(mount: HTMLElement, character: CharacterDef, assets: MoveShowcaseAssets) {
    this.character = character;
    this.animations = assets.animations;
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("viewBox", "-125 -170 250 200");
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "Move animation preview");

    const backdrop = document.createElementNS(SVG_NS, "g");
    backdrop.setAttribute("class", "showcase-backdrop");
    const floor = document.createElementNS(SVG_NS, "line");
    floor.setAttribute("x1", "-104"); floor.setAttribute("x2", "104"); floor.setAttribute("y1", "0"); floor.setAttribute("y2", "0");
    backdrop.appendChild(floor);
    this.svg.appendChild(backdrop);

    this.effects = document.createElementNS(SVG_NS, "g");
    this.effects.setAttribute("class", "showcase-effects");
    this.svg.appendChild(this.effects);

    this.fighter = buildFighterNode(assets.model, assets.rig);
    this.fighter.root.classList.add("fighter-p1", "showcase-fighter");
    this.fighter.root.setAttribute("transform", "translate(-10 0) scale(1.18)");
    this.svg.appendChild(this.fighter.root);
    mount.appendChild(this.svg);
  }

  select(moveId: number): void {
    const next = this.character.moves.find((candidate) => candidate.id === moveId) ?? null;
    if (!next) return;
    this.move = next;
    this.startedAt = performance.now();
    this.svg.setAttribute("aria-label", `Animation preview: ${next.key.replaceAll("_", " ")}`);
  }

  render(now: number): void {
    if (!this.move) return;
    const clip = this.animations[this.move.animation] ?? this.animations.idle;
    if (!clip) return;
    const reduced = document.documentElement.dataset.motion === "reduced";
    const loopMs = Math.max(720, this.move.duration * 34);
    const progress = reduced ? 0.5 : ((now - this.startedAt) % loopMs) / loopMs;
    const frame = Math.min(clip.duration, Math.trunc(progress * (clip.duration + 1)));
    applyPose(this.fighter, sampleAnimation(clip, frame));
    this.effects.replaceChildren();
    drawMoveParticles(this.effects, this.move, -2, -42, 1, frame, 1.3);
  }

  dispose(): void {
    this.svg.remove();
  }
}
