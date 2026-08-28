import type { RawBonePose, RawRig, RawRigPart } from "../../content/raw-types";
import { SVG_NS, fmt } from "../svg/stage";

export interface FighterNode {
  readonly root: SVGGElement;
  readonly bones: ReadonlyMap<string, SVGGElement>;
  readonly rig: RawRig;
}

function parseModel(model: string): Map<string, SVGGElement> {
  const documentNode = new DOMParser().parseFromString(model, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) {
    throw new Error("Fighter model is not valid SVG");
  }
  const parts = new Map<string, SVGGElement>();
  for (const node of documentNode.querySelectorAll("g[id]")) {
    const name = node.getAttribute("id");
    if (name) parts.set(name, node as unknown as SVGGElement);
  }
  return parts;
}

function boneTransform(part: RawRigPart, pose: RawBonePose | undefined): string {
  const x = part.pivot.x + (pose?.x ?? 0);
  const y = -(part.pivot.y + (pose?.y ?? 0));
  const rotation = -(pose?.rotation ?? 0);
  return `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(rotation)})`;
}

/** Builds a nested SVG skeleton from authored part pivots and an SVG part library. */
export function buildFighterNode(model: string, rig: RawRig): FighterNode {
  const sourceParts = parseModel(model);
  const root = document.createElementNS(SVG_NS, "g");
  root.classList.add("fighter");

  const bones = new Map<string, SVGGElement>();
  const partsByName = new Map(rig.parts.map((part) => [part.name, part]));
  for (const part of [...rig.parts].sort((a, b) => a.z - b.z)) {
    const source = sourceParts.get(part.name);
    if (!source) throw new Error(`Fighter model is missing rig part ${part.name}`);
    const wrapper = document.createElementNS(SVG_NS, "g");
    wrapper.dataset.bone = part.name;
    wrapper.setAttribute("transform", boneTransform(part, undefined));
    wrapper.appendChild(document.importNode(source, true));
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("class", "bone-name");
    label.setAttribute("x", "3");
    label.setAttribute("y", "-3");
    label.textContent = part.name;
    wrapper.appendChild(label);
    bones.set(part.name, wrapper);
  }

  for (const part of [...rig.parts].sort((a, b) => a.z - b.z)) {
    const node = bones.get(part.name)!;
    if (part.parent === null) root.appendChild(node);
    else {
      if (!partsByName.has(part.parent)) throw new Error(`Unknown rig parent ${part.parent}`);
      bones.get(part.parent)!.appendChild(node);
    }
  }

  if (!bones.has(rig.root)) throw new Error(`Rig root ${rig.root} does not exist`);
  return { root, bones, rig };
}

/** Applies an animation pose without changing the rig's authored hierarchy. */
export function applyPose(
  node: FighterNode,
  pose: Record<string, { rotation?: number; x?: number; y?: number }>,
): void {
  for (const part of node.rig.parts) {
    node.bones.get(part.name)?.setAttribute("transform", boneTransform(part, pose[part.name]));
  }
}
