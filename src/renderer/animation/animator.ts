import type { CharacterDef, FighterState } from "../../combat/types";
import { StateId } from "../../combat/types";
import { moveOf } from "../../combat/commands/resolve";
import type { RawAnimation, RawBonePose } from "../../content/raw-types";

export type Pose = Record<string, RawBonePose>;
type PoseKey = keyof RawBonePose;

const POSE_KEYS: readonly PoseKey[] = ["rotation", "x", "y"];

function animationFrame(anim: RawAnimation, frame: number): number {
  if (anim.duration <= 0) return 0;
  if (anim.loop) return ((frame % anim.duration) + anim.duration) % anim.duration;
  return Math.max(0, Math.min(frame, anim.duration));
}

/** Samples sparse keyframes, interpolating each authored bone property independently. */
export function sampleAnimation(anim: RawAnimation, frame: number): Pose {
  const at = animationFrame(anim, Math.max(0, frame));
  const boneNames = new Set<string>();
  for (const keyframe of anim.keyframes) {
    for (const name of Object.keys(keyframe.bones)) boneNames.add(name);
  }

  const pose: Pose = {};
  for (const name of boneNames) {
    const bone: RawBonePose = {};
    for (const property of POSE_KEYS) {
      let beforeFrame = 0;
      let beforeValue = 0;
      let afterFrame = -1;
      let afterValue = 0;

      for (const keyframe of anim.keyframes) {
        const value = keyframe.bones[name]?.[property];
        if (value === undefined) continue;
        if (keyframe.frame <= at && keyframe.frame >= beforeFrame) {
          beforeFrame = keyframe.frame;
          beforeValue = value;
        } else if (keyframe.frame > at && (afterFrame < 0 || keyframe.frame < afterFrame)) {
          afterFrame = keyframe.frame;
          afterValue = value;
        }
      }

      if (afterFrame < 0 || afterFrame === beforeFrame) {
        bone[property] = beforeValue;
      } else {
        const progress = (at - beforeFrame) / (afterFrame - beforeFrame);
        bone[property] = beforeValue + (afterValue - beforeValue) * progress;
      }
    }
    pose[name] = bone;
  }
  return pose;
}

/** Presentation clip for a combat state. Combat never reads this choice back. */
export function animationForState(f: FighterState, c: CharacterDef): string {
  if (f.state === StateId.Attack) return moveOf(c, f.moveId)?.animation ?? "idle";
  if (f.airborne === 1 || f.state === StateId.JumpSquat || f.state === StateId.Landing) {
    return "jump";
  }
  if (
    f.state === StateId.Crouch ||
    f.state === StateId.HitstunCrouch ||
    f.state === StateId.BlockstunCrouch
  ) {
    return "crouch";
  }
  if (f.state === StateId.WalkForward) return "walk_forward";
  if (f.state === StateId.WalkBackward) return "walk_backward";
  return "idle";
}
