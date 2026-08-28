import type { CharacterDef, FrameReport, SimState } from "../../combat/types";
import { StateId } from "../../combat/types";
import { debugBoxes } from "../../combat/collision/boxes";
import type { RawAnimation, RawRig } from "../../content/raw-types";
import { animationForState, sampleAnimation } from "../animation/animator";
import { applyPose, buildFighterNode } from "../character/rig";
import type { FighterNode } from "../character/rig";
import type { DebugToggles } from "./debug-overlay";
import { drawDebug } from "./debug-overlay";
import { createStage, fmt, SVG_NS, worldToScreen } from "./stage";

export interface FighterRendererAssets {
  model: string;
  rig: RawRig;
  animations: Record<string, RawAnimation>;
}

export interface RendererAssets {
  fighters: readonly FighterRendererAssets[];
}

export class Renderer {
  private readonly chars: readonly CharacterDef[];
  private readonly assets: readonly FighterRendererAssets[];
  private readonly stage;
  private readonly nodes: FighterNode[] = [];

  constructor(mount: HTMLElement, chars: readonly CharacterDef[], assets: RendererAssets) {
    this.chars = chars;
    this.assets = assets.fighters;
    this.stage = createStage(mount);

    for (let player = 0; player < chars.length; player++) {
      const asset = this.assets[player];
      if (!asset) throw new Error(`Renderer assets are missing player ${player}`);
      const node = buildFighterNode(asset.model, asset.rig);
      node.root.classList.add(`fighter-p${player + 1}`);
      this.stage.layers.fighters.appendChild(node.root);
      this.nodes.push(node);
    }
  }

  render(state: SimState, report: FrameReport | null, toggles: DebugToggles): void {
    for (let player = 0; player < state.fighters.length; player++) {
      const fighter = state.fighters[player];
      const node = this.nodes[player];
      const asset = this.assets[player];
      const clipName = animationForState(fighter, this.chars[player]);
      const clip = asset.animations[clipName] ?? asset.animations["idle"];
      if (clip) {
        const frame = fighter.state === StateId.Attack ? fighter.moveFrame : fighter.stateFrame;
        applyPose(node, sampleAnimation(clip, frame));
      }
      const position = worldToScreen(fighter.x, fighter.y);
      node.root.setAttribute(
        "transform",
        `translate(${fmt(position.x)} ${fmt(position.y)}) scale(${fighter.facing} 1)`,
      );
      node.root.classList.toggle("fighter-hitstop", fighter.hitstop > 0);
    }

    this.drawEffects(report);
    this.stage.svg.classList.toggle("stage-impact", (report?.contacts.length ?? 0) > 0);
    drawDebug(this.stage.layers.debug, debugBoxes(state, this.chars), state, toggles);

    this.stage.layers.fighters.classList.toggle("show-skeleton", toggles.skeleton);
    this.stage.layers.fighters.classList.toggle("show-bone-names", toggles.boneNames);
  }

  dispose(): void {
    this.stage.svg.remove();
    this.nodes.length = 0;
  }

  private drawEffects(report: FrameReport | null): void {
    this.stage.layers.effects.replaceChildren();
    if (!report) return;
    for (const contact of report.contacts) {
      const point = worldToScreen(contact.x, contact.y);
      const burst = document.createElementNS(SVG_NS, "g");
      burst.setAttribute("class", "contact-burst");
      burst.setAttribute("transform", `translate(${fmt(point.x)} ${fmt(point.y)})`);
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", "9");
      circle.setAttribute("class", "contact-ring");
      burst.appendChild(circle);
      for (let ray = 0; ray < 4; ray++) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", "-14");
        line.setAttribute("x2", "14");
        line.setAttribute("class", "contact-ray");
        line.setAttribute("transform", `rotate(${ray * 45})`);
        burst.appendChild(line);
      }
      if (contact.damage > 0) {
        const damage = document.createElementNS(SVG_NS, "text");
        damage.setAttribute("class", "damage-number");
        damage.setAttribute("y", "-18");
        damage.setAttribute("text-anchor", "middle");
        damage.textContent = String(contact.damage);
        burst.appendChild(damage);
      }
      this.stage.layers.effects.appendChild(burst);
    }
  }
}
