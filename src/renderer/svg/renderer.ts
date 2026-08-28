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
import { drawMoveParticles, styleImpact } from "./move-effects";

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

    this.drawEffects(state, report);
    this.stage.svg.classList.toggle("stage-impact", (report?.contacts.length ?? 0) > 0);
    drawDebug(this.stage.layers.debug, debugBoxes(state, this.chars), state, toggles);

    this.stage.layers.fighters.classList.toggle("show-skeleton", toggles.skeleton);
    this.stage.layers.fighters.classList.toggle("show-bone-names", toggles.boneNames);
  }

  dispose(): void {
    this.stage.svg.remove();
    this.nodes.length = 0;
  }

  private drawEffects(state: SimState, report: FrameReport | null): void {
    this.stage.layers.effects.replaceChildren();
    for (let player = 0; player < state.fighters.length; player++) {
      const fighter = state.fighters[player];
      if (fighter.state !== StateId.Attack) continue;
      const move = this.chars[player].moves.find((candidate) => candidate.id === fighter.moveId);
      if (!move) continue;
      const point = worldToScreen(fighter.x, fighter.y);
      drawMoveParticles(this.stage.layers.effects, move, point.x, point.y, fighter.facing, fighter.moveFrame);
    }
    if (!report) return;
    for (const contact of report.contacts) {
      const point = worldToScreen(contact.x, contact.y);
      const burst = document.createElementNS(SVG_NS, "g");
      const move = this.chars[contact.attacker].moves.find((candidate) => candidate.id === contact.moveId);
      const profile = move ? styleImpact(burst, move) : null;
      if (!move) burst.setAttribute("class", "contact-burst effect-physical");
      burst.setAttribute("transform", `translate(${fmt(point.x)} ${fmt(point.y)})`);
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", fmt(profile ? 7 + profile.radius * 0.15 : 9));
      circle.setAttribute("class", "contact-ring");
      if (profile) circle.setAttribute("stroke", profile.secondary);
      burst.appendChild(circle);
      const rays = profile?.count ?? 4;
      for (let ray = 0; ray < rays; ray++) {
        const line = document.createElementNS(SVG_NS, "line");
        const length = 12 + ((contact.moveId + ray) % 9);
        line.setAttribute("x1", fmt(-length));
        line.setAttribute("x2", fmt(length));
        line.setAttribute("class", "contact-ray");
        if (profile) line.setAttribute("stroke", ray % 2 === 0 ? profile.primary : profile.secondary);
        line.setAttribute("transform", `rotate(${fmt((profile?.rotation ?? 0) + ray * (180 / rays))})`);
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
