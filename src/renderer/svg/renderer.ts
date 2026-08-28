import type { CharacterDef, EntityState, FrameReport, SimState, StageDef } from "../../combat/types";
import { ContactKind, EntityKind, InteractableKind, StateId } from "../../combat/types";
import { debugBoxes } from "../../combat/collision/boxes";
import type { RawAnimation, RawRig } from "../../content/raw-types";
import type { AnimationPlayback } from "../animation/animator";
import { animationForState, animationFrameForState, sampleAnimation } from "../animation/animator";
import { applyPose, boneAnchor, buildFighterNode } from "../character/rig";
import type { FighterNode } from "../character/rig";
import type { DebugToggles } from "./debug-overlay";
import { drawDebug } from "./debug-overlay";
import { createStage, fmt, SVG_NS, worldToScreen } from "./stage";
import { drawMoveParticles, moveVisualDefinition, styleImpact } from "./move-effects";

export interface FighterRendererAssets {
  model: string;
  rig: RawRig;
  animations: Record<string, RawAnimation>;
  playback?: Readonly<Record<string, AnimationPlayback>>;
  presentationScale?: number;
}

export interface RendererAssets {
  fighters: readonly FighterRendererAssets[];
  stage?: StageDef;
}

export class Renderer {
  private readonly chars: readonly CharacterDef[];
  private readonly assets: readonly FighterRendererAssets[];
  private readonly stage;
  private readonly nodes: FighterNode[] = [];

  constructor(mount: HTMLElement, chars: readonly CharacterDef[], assets: RendererAssets) {
    this.chars = chars;
    this.assets = assets.fighters;
    this.stage = createStage(mount, assets.stage);

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
    const leadX = state.fighters[0]?.x ?? 0;
    const framed = state.fighters.filter((fighter) => fighter.health > 0 && Math.abs(fighter.x - leadX) <= 90_000);
    const focusX = framed.length > 0
      ? Math.trunc((Math.min(...framed.map((fighter) => fighter.x)) + Math.max(...framed.map((fighter) => fighter.x))) / 2)
      : leadX;
    this.stage.setCamera(focusX, state);
    for (let player = 0; player < state.fighters.length; player++) {
      const fighter = state.fighters[player];
      const node = this.nodes[player];
      const asset = this.assets[player];
      const clipName = animationForState(fighter, this.chars[player]);
      const clip = asset.animations[clipName] ?? asset.animations["idle"];
      if (clip) {
        const frame = animationFrameForState(
          fighter,
          this.chars[player],
          clipName,
          clip,
          asset.playback?.[clipName],
        );
        applyPose(node, sampleAnimation(clip, frame));
      }
      const position = worldToScreen(fighter.x, fighter.y);
      const scale = asset.presentationScale ?? 1;
      node.root.setAttribute(
        "transform",
        `translate(${fmt(position.x)} ${fmt(position.y)}) scale(${fmt(fighter.facing * scale)} ${fmt(scale)})`,
      );
      node.root.classList.toggle("fighter-hitstop", fighter.hitstop > 0);
    }

    this.drawEntities(state);
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
      const asset = this.assets[player];
      const point = worldToScreen(fighter.x, fighter.y);
      const anchor = this.effectAnchor(player, move);
      const scale = asset.presentationScale ?? 1;
      const anchored = {
        x: point.x + fighter.facing * anchor.x * scale,
        y: point.y + anchor.y * scale,
      };
      this.drawTelegraph(move, fighter.moveFrame, point.x, point.y, fighter.facing, state, player);
      drawMoveParticles(this.stage.layers.effects, move, anchored.x, anchored.y, fighter.facing, fighter.moveFrame, scale);
    }
    if (!report) return;
    for (const contact of report.contacts) {
      const point = worldToScreen(contact.x, contact.y);
      const burst = document.createElementNS(SVG_NS, "g");
      const move = this.chars[contact.attacker].moves.find((candidate) => candidate.id === contact.moveId);
      const profile = move ? styleImpact(burst, move) : null;
      if (!move) burst.setAttribute("class", "contact-burst effect-physical");
      if (contact.kind === ContactKind.Block) {
        burst.setAttribute("class", `contact-burst block-burst${contact.perfectGuard ? " perfect-guard-burst" : ""}${contact.guardBreak ? " guard-break-burst" : ""}`);
      }
      burst.setAttribute("transform", `translate(${fmt(point.x)} ${fmt(point.y)})`);
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", fmt(profile ? 7 + profile.radius * 0.15 : 9));
      circle.setAttribute("class", "contact-ring");
      if (contact.perfectGuard) circle.setAttribute("stroke", "#fff4bf");
      else if (contact.kind === ContactKind.Block) circle.setAttribute("stroke", "#92a1ad");
      else if (profile) circle.setAttribute("stroke", profile.secondary);
      burst.appendChild(circle);
      const rays = profile?.count ?? 4;
      for (let ray = 0; ray < rays; ray++) {
        const line = document.createElementNS(SVG_NS, "line");
        const length = 12 + (profile ? Math.trunc(profile.radius * .35) : 0) + (ray % 3) * 3;
        line.setAttribute("x1", fmt(-length));
        line.setAttribute("x2", fmt(length));
        line.setAttribute("class", "contact-ray");
        if (contact.perfectGuard) line.setAttribute("stroke", ray % 2 === 0 ? "#ffffff" : "#e8bf5d");
        else if (contact.kind === ContactKind.Block) line.setAttribute("stroke", ray % 2 === 0 ? "#62717e" : "#c2ccd3");
        else if (profile) line.setAttribute("stroke", ray % 2 === 0 ? profile.primary : profile.secondary);
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

  private effectAnchor(player: number, move: CharacterDef["moves"][number]): { x: number; y: number } {
    const visual = moveVisualDefinition(move.key);
    if (visual.anchor === "ground") return { x: 0, y: 0 };
    if (visual.anchor === "hitbox_center") {
      const hitbox = move.hitboxes[0];
      return hitbox ? { x: (hitbox.box.x + hitbox.box.w / 2) / 100, y: -(hitbox.box.y + hitbox.box.h / 2) / 100 } : { x: 0, y: -48 };
    }
    const bone = {
      hand_near: "hand_r", hand_far: "hand_l", foot_near: "foot_r", foot_far: "foot_l",
      head: "head", chest: "torso", pelvis: "pelvis",
    }[visual.anchor];
    const point = boneAnchor(this.nodes[player], bone);
    if (visual.anchor === "chest") point.y -= 28;
    if (visual.anchor === "head") point.y -= 10;
    return point;
  }

  private drawEntities(state: SimState): void {
    this.stage.layers.entities.replaceChildren();
    for (const entity of state.entities) {
      if (entity.life === 0) continue;
      const point = worldToScreen(entity.x, entity.y);
      const node = document.createElementNS(SVG_NS, "g");
      node.setAttribute("class", `stage-entity entity-kind-${entity.kind}${entity.owner < 0 ? " entity-warning" : ""}${entity.hitFlags ? " entity-used" : ""}`);
      node.setAttribute("transform", `translate(${fmt(point.x)} ${fmt(point.y)})`);
      const body = document.createElementNS(SVG_NS, "rect");
      body.setAttribute("x", fmt(-entity.w / 200));
      body.setAttribute("y", fmt(-entity.h / 100));
      body.setAttribute("width", fmt(entity.w / 100));
      body.setAttribute("height", fmt(entity.h / 100));
      body.setAttribute("rx", entity.kind === EntityKind.MaterialPickup ? "8" : "2");
      node.appendChild(body);
      if (entity.kind === EntityKind.Interactable) {
        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("y", fmt(-entity.h / 100 - 10));
        label.textContent = entity.owner === InteractableKind.BossGate
          ? (state.stage.arenaLocked ? "SEALED" : "E / RB · ENTER")
          : entity.owner === InteractableKind.Checkpoint
            ? "CHECKPOINT"
            : entity.owner === InteractableKind.BossReward
                ? "E / RB · CLAIM"
                : "E / RB";
        node.appendChild(label);
      }
      this.stage.layers.entities.appendChild(node);
    }
  }

  private drawTelegraph(
    move: CharacterDef["moves"][number],
    frame: number,
    x: number,
    y: number,
    facing: number,
    state: SimState,
    attacker: number,
  ): void {
    const telegraph = move.telegraph;
    if (!telegraph || frame < telegraph.startFrame || frame > telegraph.endFrame) return;
    const warning = document.createElementNS(SVG_NS, "g");
    warning.setAttribute("class", `boss-telegraph telegraph-${telegraph.shape} pattern-${telegraph.pattern}`);
    const progress = (frame - telegraph.startFrame + 1) / Math.max(1, telegraph.endFrame - telegraph.startFrame + 1);
    warning.style.setProperty("--telegraph-progress", String(progress));
    if (telegraph.shape === "vertical-sigil") {
      const mark = document.createElementNS(SVG_NS, "rect");
      mark.setAttribute("x", fmt(x + facing * 18 - 42));
      mark.setAttribute("y", "-245");
      mark.setAttribute("width", "84");
      mark.setAttribute("height", "245");
      warning.appendChild(mark);
    } else if (telegraph.shape === "tracking-line") {
      const source = state.fighters[attacker];
      const target = state.fighters
        .map((fighter, index) => ({ fighter, index }))
        .filter(({ fighter, index }) => index !== attacker && fighter.health > 0)
        .sort((a, b) => Math.abs(a.fighter.x - source.x) - Math.abs(b.fighter.x - source.x) || a.index - b.index)[0]?.fighter;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", fmt(x));
      line.setAttribute("y1", fmt(y - 72));
      line.setAttribute("x2", fmt((target?.x ?? source.x) / 100));
      line.setAttribute("y2", "-42");
      warning.appendChild(line);
    } else {
      const band = document.createElementNS(SVG_NS, "rect");
      band.setAttribute("x", fmt(x + (facing < 0 ? -370 : -20)));
      band.setAttribute("y", telegraph.shape === "floor-pulse" ? "-22" : "-34");
      band.setAttribute("width", telegraph.shape === "floor-pulse" ? "390" : "350");
      band.setAttribute("height", telegraph.shape === "floor-pulse" ? "22" : "34");
      warning.appendChild(band);
    }
    this.stage.layers.effects.appendChild(warning);
  }
}
