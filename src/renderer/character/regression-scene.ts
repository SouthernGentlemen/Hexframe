import { TEST_FIGHTER_ANIMATIONS, TEST_FIGHTER_MODEL, TEST_FIGHTER_RIG } from "../../content/test-fighter-assets";
import { sampleAnimation } from "../animation/animator";
import { applyPose, buildFighterNode } from "./rig";
import { SVG_NS } from "../svg/stage";

const POSES = [
  ["idle", 0], ["walk_forward", 6], ["crouch_idle", 8], ["jump_apex", 3],
  ["block_stand", 3], ["block_crouch", 3], ["standing_light", 4], ["iron_reversal", 6],
] as const;

/** Side-by-side presentation fixture: mirrored facing changes direction, never anatomy. */
export function mountRigRegressionScene(mount: HTMLElement): void {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 640 ${POSES.length * 125 + 30}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Player rig poses facing right and left");
  for (const [row, [clipName, frame]] of POSES.entries()) {
    const clip = TEST_FIGHTER_ANIMATIONS[clipName];
    if (!clip) continue;
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", "18");
    label.setAttribute("y", String(row * 125 + 68));
    label.setAttribute("class", "rig-scene-label");
    label.textContent = clipName.replaceAll("_", " ").toUpperCase();
    svg.appendChild(label);
    for (const [column, facing] of [1, -1].entries()) {
      const node = buildFighterNode(TEST_FIGHTER_MODEL, TEST_FIGHTER_RIG);
      applyPose(node, sampleAnimation(clip, frame));
      node.root.setAttribute("transform", `translate(${285 + column * 220} ${row * 125 + 112}) scale(${facing * 1.15} 1.15)`);
      svg.appendChild(node.root);
    }
  }
  mount.replaceChildren(svg);
}
